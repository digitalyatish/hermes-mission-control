import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default email templates when agent hasn't personalized
function getDefaultBody(type: string, name: string, company: string, meetingTime: string, meetingLink: string): string {
  const firstName = name?.split(" ")[0] || "there";
  const mtg = new Date(meetingTime);
  const dateStr = mtg.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeStr = mtg.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const templates: Record<string, string> = {
    welcome: `<p>Hi ${firstName},</p>
<p>Thanks for booking time with me — looking forward to our conversation on <strong>${dateStr} at ${timeStr}</strong>.</p>
<p>This will be a no-pressure chat to understand your business and explore whether we can help. I've worked with 13+ businesses across healthcare, real estate, e-commerce, and more — so I'll have relevant context no matter your industry.</p>
${company ? `<p>I'll do some homework on ${company} before our call so we can make the most of our time together.</p>` : ""}
<p>Here's your meeting link for quick reference: <a href="${meetingLink}">${meetingLink}</a></p>
<p>Talk soon,<br>${Deno.env.get("DEFAULT_FROM_NAME")?.split(" ")[0] || "Team"}</p>`,

    value_1: `<p>Hi ${firstName},</p>
<p>Wanted to share a quick case study before our call.</p>
<p>We recently helped a business deploy an AI system that <strong>reduced their manual workload by 70%</strong> and added <strong>$50,000 in revenue within 30 days</strong>. The entire build took 6 weeks from kickoff to live.</p>
<p>The key was identifying the highest-leverage processes first — not trying to automate everything at once.</p>
<p>I'll share more about how this could apply to ${company || "your business"} on our call.</p>
<p>Best,<br>${Deno.env.get("DEFAULT_FROM_NAME")?.split(" ")[0] || "Team"}</p>`,

    value_2: `<p>Hi ${firstName},</p>
<p>One more thing I thought you'd find interesting.</p>
<p>A common pattern we see: businesses spend 15-20 hours per week on tasks that AI can handle in minutes — scheduling, data entry, follow-ups, report generation. The teams that move fastest are the ones that start with <strong>one specific workflow</strong> rather than a big overhaul.</p>
<p>When we talk on ${dateStr}, I'd love to understand what's taking up most of your team's time right now. That usually points straight to the highest-ROI opportunity.</p>
<p>See you soon,<br>${Deno.env.get("DEFAULT_FROM_NAME")?.split(" ")[0] || "Team"}</p>`,

    value_3: `<p>Hi ${firstName},</p>
<p>Quick thought — I've been looking into ${company || "businesses in your space"} and I see some interesting opportunities for automation.</p>
<p>I'll walk through my observations on our call, but the short version: there's likely $30-50K in annual value sitting in processes that could be streamlined with the right AI setup.</p>
<p>Looking forward to ${dateStr}.</p>
<p>${Deno.env.get("DEFAULT_FROM_NAME")?.split(" ")[0] || "Team"}</p>`,

    reminder_24h: `<p>Hi ${firstName},</p>
<p>Quick reminder — we're on for <strong>tomorrow at ${timeStr}</strong>.</p>
<p><a href="${meetingLink}">Join the call here</a></p>
<p>If you have any specific pain points or numbers in mind, it helps us make the most of our 30 minutes. But no prep needed — I'll come with questions and ideas based on what I know about ${company || "your business"}.</p>
<p>See you tomorrow,<br>${Deno.env.get("DEFAULT_FROM_NAME")?.split(" ")[0] || "Team"}</p>`,

    reminder_1h: `<p>Hi ${firstName},</p>
<p>We're starting in 1 hour.</p>
<p><strong><a href="${meetingLink}">Join here</a></strong></p>
<p>Looking forward to it.</p>
<p>${Deno.env.get("DEFAULT_FROM_NAME")?.split(" ")[0] || "Team"}</p>`,
  };

  return templates[type] || templates.welcome;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get emails due to send
    const { data: dueEmails, error } = await supabase
      .from("nurture_emails")
      .select("*, nurture_sequences!inner(prospect_name, prospect_email, prospect_company, meeting_time, meeting_link, status)")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(20);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const email of (dueEmails || [])) {
      const seq = email.nurture_sequences as Record<string, unknown>;

      // Skip if sequence is cancelled
      if (seq.status === "cancelled" || seq.status === "paused") {
        await supabase.from("nurture_emails").update({ status: "skipped" }).eq("id", email.id);
        skipped++;
        continue;
      }

      // Use agent-personalized content, or fall back to default template
      const bodyHtml = email.body_html || getDefaultBody(
        email.email_type,
        seq.prospect_name as string,
        seq.prospect_company as string || "",
        seq.meeting_time as string,
        seq.meeting_link as string || ""
      );
      const subject = email.subject || `Update from Growth Creators`;

      // Send via Resend
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "${Deno.env.get("DEFAULT_FROM_NAME") || "Your Name"} <${Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com"}>",
            to: [seq.prospect_email],
            reply_to: Deno.env.get("DEFAULT_REPLY_TO") || "your-email@example.com",
            subject,
            html: bodyHtml,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`Resend error for ${email.id}:`, errText);
          continue;
        }

        const result = await resp.json();

        // Update email record
        await supabase.from("nurture_emails").update({
          status: "sent",
          resend_id: result.id,
          sent_at: new Date().toISOString(),
          body_html: bodyHtml,
        }).eq("id", email.id);

        // Increment sequence emails_sent
        const { data: seqData } = await supabase.from("nurture_sequences").select("emails_sent").eq("id", email.sequence_id).single();
        await supabase.from("nurture_sequences").update({ emails_sent: (seqData?.emails_sent || 0) + 1 }).eq("id", email.sequence_id);

        // Check if this was the last email → mark sequence complete
        const { count } = await supabase
          .from("nurture_emails")
          .select("*", { count: "exact", head: true })
          .eq("sequence_id", email.sequence_id)
          .eq("status", "scheduled");

        if (count === 0) {
          await supabase.from("nurture_sequences").update({ status: "completed" }).eq("id", email.sequence_id);
        }

        sent++;
      } catch (sendErr) {
        console.error(`Send error for ${email.id}:`, sendErr);
      }
    }

    // Log activity
    if (sent > 0 || skipped > 0) {
      await supabase.from("agent_activity_log").insert({
        activity_type: "email_sent",
        source: "nurture_sender",
        summary: sent > 0 ? `Sent ${sent} nurture email(s)${skipped > 0 ? `, skipped ${skipped}` : ""}` : `Processed ${skipped} skipped email(s)`,
        details: { processed: (dueEmails || []).length, sent, skipped },
        status: sent > 0 ? "success" : "silent",
      });
    }

    return new Response(JSON.stringify({
      status: "ok",
      processed: (dueEmails || []).length,
      sent,
      skipped,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Nurture sender error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
