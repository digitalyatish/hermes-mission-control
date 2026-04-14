import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cal-signature-256",
};

// Calculate nurture email schedule based on time until call
function calculateEmailSchedule(meetingTime: Date, prospectTz: string): Array<{ type: string; scheduledAt: Date }> {
  const now = new Date();
  const msUntil = meetingTime.getTime() - now.getTime();
  const hoursUntil = msUntil / (1000 * 60 * 60);

  const emails: Array<{ type: string; scheduledAt: Date }> = [];

  // Welcome always goes now
  if (hoursUntil > 2) {
    emails.push({ type: "welcome", scheduledAt: new Date(now.getTime() + 60000) }); // 1 min from now
  }

  if (hoursUntil > 96) {
    // 4+ days: value_1 day 2, value_2 day 4
    emails.push({ type: "value_1", scheduledAt: addDaysAt9am(now, 2, prospectTz) });
    emails.push({ type: "value_2", scheduledAt: addDaysAt9am(now, 4, prospectTz) });
    if (hoursUntil > 168) {
      // 7+ days: add value_3 day 6
      emails.push({ type: "value_3", scheduledAt: addDaysAt9am(now, 6, prospectTz) });
    }
  } else if (hoursUntil > 48) {
    // 2-4 days: value_1 at midpoint
    const midpoint = new Date(now.getTime() + msUntil / 2);
    emails.push({ type: "value_1", scheduledAt: midpoint });
  }

  // MANDATORY: 24h and 1h reminders
  const reminder24h = new Date(meetingTime.getTime() - 24 * 60 * 60 * 1000);
  const reminder1h = new Date(meetingTime.getTime() - 60 * 60 * 1000);

  if (reminder24h > now) {
    emails.push({ type: "reminder_24h", scheduledAt: reminder24h });
  }
  if (reminder1h > now) {
    emails.push({ type: "reminder_1h", scheduledAt: reminder1h });
  }

  return emails.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

function addDaysAt9am(from: Date, days: number, _tz: string): Date {
  const d = new Date(from.getTime() + days * 86400000);
  d.setUTCHours(17, 0, 0, 0); // 9am PST = 17:00 UTC (approximate)
  return d;
}

function getDefaultSubject(type: string, firstName: string, _company: string): string {
  const subjects: Record<string, string> = {
    welcome: `Looking forward to our call, ${firstName}`,
    value_1: `How we helped a business like yours`,
    value_2: `What others achieved in 6 weeks`,
    value_3: `Quick thought about your business`,
    reminder_24h: `Tomorrow: Our call`,
    reminder_1h: `Starting in 1 hour — here's your link`,
  };
  return subjects[type] || `Update from Growth Creators`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.text();
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400, headers: corsHeaders }); }

    const triggerEvent = payload.triggerEvent as string;
    const data = (payload.payload || payload) as Record<string, unknown>;

    console.log(`Cal.com event: ${triggerEvent}`);

    // Log to webhook_events if cal webhook exists
    const { data: calWebhook } = await supabase
      .from("webhooks")
      .select("id, event_count")
      .eq("service", "cal")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (calWebhook) {
      await supabase.from("webhook_events").insert({
        webhook_id: calWebhook.id,
        event_type: triggerEvent,
        payload,
        status: "processing",
      });
      await supabase.from("webhooks").update({
        event_count: (calWebhook.event_count || 0) + 1,
        last_received_at: new Date().toISOString(),
      }).eq("id", calWebhook.id);
    }

    if (triggerEvent === "BOOKING_CREATED") {
      const attendees = data.attendees as Array<{ name: string; email: string; timeZone?: string }>;
      const responses = data.responses as Record<string, { value?: string }> | null;
      const attendee = attendees?.[0];

      if (!attendee?.email) {
        return new Response(JSON.stringify({ error: "No attendee email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const firstName = attendee.name?.split(" ")[0] || attendee.name || "there";
      const prospectCompany = responses?.company?.value || null;
      const prospectNotes = responses?.notes?.value || (data.additionalNotes as string) || null;
      const prospectTz = attendee.timeZone || "America/Vancouver";
      const meetingTime = new Date(data.startTime as string);
      const bookingUid = data.uid as string || `cal-${Date.now()}`;

      // Create or update lead
      const { data: existingLead } = await supabase.from("leads").select("id").eq("email", attendee.email).maybeSingle();

      let leadId: string;
      if (existingLead) {
        await supabase.from("leads").update({
          first_name: attendee.name?.split(" ")[0],
          last_name: attendee.name?.split(" ").slice(1).join(" ") || null,
          company_name: prospectCompany || undefined,
          status: "booked",
          source: "cal_booking",
          source_detail: bookingUid,
          custom_data: { cal_payload: data },
          tags: ["nurture_active", "discovery_booked", "new_booking"],
        }).eq("id", existingLead.id);
        leadId = existingLead.id;
      } else {
        const { data: newLead } = await supabase.from("leads").insert({
          email: attendee.email,
          first_name: attendee.name?.split(" ")[0],
          last_name: attendee.name?.split(" ").slice(1).join(" ") || null,
          company_name: prospectCompany,
          status: "booked",
          source: "cal_booking",
          source_detail: bookingUid,
          custom_data: { cal_payload: data },
          tags: ["nurture_active", "discovery_booked", "new_booking"],
        }).select("id").single();
        leadId = newLead!.id;
      }

      // Calculate email schedule
      const schedule = calculateEmailSchedule(meetingTime, prospectTz);

      // Create nurture sequence
      const { data: sequence } = await supabase.from("nurture_sequences").insert({
        lead_id: leadId,
        booking_uid: bookingUid,
        booking_title: data.title as string || "Discovery Call",
        meeting_time: meetingTime.toISOString(),
        meeting_link: data.location as string,
        meeting_duration_minutes: Math.round(((new Date(data.endTime as string).getTime()) - meetingTime.getTime()) / 60000) || 30,
        prospect_name: attendee.name,
        prospect_email: attendee.email,
        prospect_company: prospectCompany,
        prospect_notes: prospectNotes,
        status: "active",
        emails_planned: schedule.length,
      }).select("id").single();

      // Create nurture emails
      for (const email of schedule) {
        await supabase.from("nurture_emails").insert({
          sequence_id: sequence!.id,
          lead_id: leadId,
          email_type: email.type,
          scheduled_at: email.scheduledAt.toISOString(),
          subject: getDefaultSubject(email.type, firstName, prospectCompany || ""),
          status: "scheduled",
        });
      }

      // Log activity
      await supabase.from("agent_activity_log").insert({
        activity_type: "nurture_personalized",
        source: "cal_webhook",
        summary: `New booking: ${attendee.name} (${prospectCompany || attendee.email}). Created nurture sequence with ${schedule.length} emails.`,
        details: { lead_id: leadId, sequence_id: sequence!.id, emails_scheduled: schedule.length, meeting_time: meetingTime.toISOString() },
        status: "success",
      });

      return new Response(JSON.stringify({
        status: "ok",
        event: "booking_created",
        lead_id: leadId,
        sequence_id: sequence!.id,
        emails_scheduled: schedule.length,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (triggerEvent === "BOOKING_RESCHEDULED") {
      const bookingUid = data.uid as string;
      const newStartTime = data.startTime as string;

      if (bookingUid && newStartTime) {
        const { data: seq } = await supabase.from("nurture_sequences")
          .select("id, prospect_email, prospect_name, prospect_company")
          .eq("booking_uid", bookingUid)
          .maybeSingle();

        if (seq) {
          const newMeetingTime = new Date(newStartTime);
          // Cancel existing unsent emails
          await supabase.from("nurture_emails")
            .update({ status: "cancelled" })
            .eq("sequence_id", seq.id)
            .eq("status", "scheduled");

          // Recalculate
          const schedule = calculateEmailSchedule(newMeetingTime, "America/Vancouver");
          await supabase.from("nurture_sequences").update({
            meeting_time: newMeetingTime.toISOString(),
            meeting_link: data.location as string,
            status: "active",
            emails_planned: schedule.length,
          }).eq("id", seq.id);

          const firstName = seq.prospect_name?.split(" ")[0] || "there";
          for (const email of schedule) {
            await supabase.from("nurture_emails").insert({
              sequence_id: seq.id,
              lead_id: (await supabase.from("leads").select("id").eq("email", seq.prospect_email).single()).data!.id,
              email_type: email.type,
              scheduled_at: email.scheduledAt.toISOString(),
              subject: getDefaultSubject(email.type, firstName, seq.prospect_company || ""),
              status: "scheduled",
            });
          }
        }
      }

      return new Response(JSON.stringify({ status: "ok", event: "booking_rescheduled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (triggerEvent === "BOOKING_CANCELLED") {
      const bookingUid = data.uid as string;
      if (bookingUid) {
        const { data: seq } = await supabase.from("nurture_sequences").select("id, lead_id").eq("booking_uid", bookingUid).maybeSingle();
        if (seq) {
          await supabase.from("nurture_emails").update({ status: "cancelled" }).eq("sequence_id", seq.id).eq("status", "scheduled");
          await supabase.from("nurture_sequences").update({ status: "cancelled" }).eq("id", seq.id);
          // Update lead
          await supabase.from("leads").update({ status: "cancelled" }).eq("id", seq.lead_id);
          // Remove nurture_active tag
          const { data: lead } = await supabase.from("leads").select("tags").eq("id", seq.lead_id).single();
          const tags = (lead?.tags || []).filter((t: string) => t !== "nurture_active");
          await supabase.from("leads").update({ tags }).eq("id", seq.lead_id);
        }
      }

      return new Response(JSON.stringify({ status: "ok", event: "booking_cancelled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ok", event: triggerEvent, note: "unhandled event type" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Cal webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
