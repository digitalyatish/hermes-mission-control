import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

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
    try { payload = JSON.parse(body); } catch { payload = { raw: body }; }

    const eventType = (payload.type as string) || "unknown";
    const resendData = (payload.data as Record<string, unknown>) || {};
    const resendId = (resendData.email_id as string) || (resendData.id as string) || "";

    // Find the email_send by resend_id
    let emailSendId: string | null = null;
    let campaignId: string | null = null;
    let leadId: string | null = null;
    let campaignLeadId: string | null = null;

    if (resendId) {
      const { data: send } = await supabase
        .from("email_sends")
        .select("id, campaign_id, lead_id, campaign_lead_id")
        .eq("resend_id", resendId)
        .maybeSingle();
      if (send) {
        emailSendId = send.id;
        campaignId = send.campaign_id;
        leadId = send.lead_id;
        campaignLeadId = send.campaign_lead_id;
      }
    }

    // Also check nurture_emails for this resend_id
    if (resendId) {
      const { data: nurtureEmail } = await supabase
        .from("nurture_emails")
        .select("id, sequence_id")
        .eq("resend_id", resendId)
        .maybeSingle();

      if (nurtureEmail) {
        const cleanType = eventType.replace("email.", "");
        const updates: Record<string, unknown> = {};
        if (cleanType === "opened") {
          updates.opened_at = new Date().toISOString();
          const { data: curr } = await supabase.from("nurture_emails").select("open_count").eq("id", nurtureEmail.id).single();
          updates.open_count = (curr?.open_count || 0) + 1;
        }
        if (cleanType === "clicked") {
          updates.clicked_at = new Date().toISOString();
          const { data: curr } = await supabase.from("nurture_emails").select("click_count").eq("id", nurtureEmail.id).single();
          updates.click_count = (curr?.click_count || 0) + 1;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("nurture_emails").update(updates).eq("id", nurtureEmail.id);
        }
      }
    }

    // Store the event
    await supabase.from("email_events").insert({
      resend_id: resendId,
      email_send_id: emailSendId,
      event_type: eventType.replace("email.", ""),
      event_data: payload,
      link_clicked: (resendData.click as Record<string, unknown>)?.link as string || null,
      user_agent: null,
      ip_address: null,
    });

    // Update email_sends status based on event
    if (emailSendId) {
      const cleanType = eventType.replace("email.", "");
      const updates: Record<string, unknown> = {};

      if (cleanType === "delivered") updates.status = "delivered";
      if (cleanType === "opened") {
        updates.status = "opened";
        updates.opened_at = new Date().toISOString();
        // Increment open count
        const { data: current } = await supabase.from("email_sends").select("open_count").eq("id", emailSendId).single();
        updates.open_count = (current?.open_count || 0) + 1;
      }
      if (cleanType === "clicked") {
        updates.status = "clicked";
        updates.clicked_at = new Date().toISOString();
        const { data: current } = await supabase.from("email_sends").select("click_count").eq("id", emailSendId).single();
        updates.click_count = (current?.click_count || 0) + 1;
      }
      if (cleanType === "bounced") {
        updates.status = "bounced";
        updates.bounced_at = new Date().toISOString();
        updates.bounce_type = (resendData.bounce as Record<string, unknown>)?.type || "unknown";
      }
      if (cleanType === "complained") updates.status = "complained";

      if (Object.keys(updates).length > 0) {
        await supabase.from("email_sends").update(updates).eq("id", emailSendId);
      }

      // Update campaign_leads status
      if (campaignLeadId) {
        if (cleanType === "bounced") {
          await supabase.from("campaign_leads").update({ status: "bounced" }).eq("id", campaignLeadId);
        }
        if (cleanType === "opened" || cleanType === "clicked") {
          // Only upgrade status, don't downgrade
          const { data: cl } = await supabase.from("campaign_leads").select("status").eq("id", campaignLeadId).single();
          if (cl?.status === "active" || cl?.status === "pending") {
            await supabase.from("campaign_leads").update({ status: "active" }).eq("id", campaignLeadId);
          }
        }
      }

      // Update lead status
      if (leadId) {
        const statusMap: Record<string, string> = {
          delivered: "contacted",
          opened: "opened",
          clicked: "clicked",
          bounced: "bounced",
        };
        const newStatus = statusMap[cleanType];
        if (newStatus) {
          await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
        }

        // Hard bounce → do_not_contact
        if (cleanType === "bounced") {
          const bounceType = (resendData.bounce as Record<string, unknown>)?.type;
          if (bounceType === "hard") {
            await supabase.from("leads").update({ do_not_contact: true, status: "bounced" }).eq("id", leadId);
          }
        }
      }

      // Update campaign counters
      if (campaignId) {
        const counterMap: Record<string, string> = {
          sent: "total_sent",
          delivered: "total_delivered",
          opened: "total_opened",
          clicked: "total_clicked",
          bounced: "total_bounced",
        };
        const counterField = counterMap[cleanType];
        if (counterField) {
          const { data: camp } = await supabase.from("campaigns").select(counterField).eq("id", campaignId).single();
          if (camp) {
            await supabase.from("campaigns").update({ [counterField]: ((camp as Record<string, number>)[counterField] || 0) + 1 }).eq("id", campaignId);
          }
        }
      }
    }

    // Also store in webhook_events if there's a matching resend webhook
    const { data: resendWebhook } = await supabase
      .from("webhooks")
      .select("id, event_count")
      .eq("service", "resend")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (resendWebhook) {
      await supabase.from("webhook_events").insert({
        webhook_id: resendWebhook.id,
        event_type: eventType,
        payload,
        headers: {
          "svix-id": req.headers.get("svix-id"),
          "svix-timestamp": req.headers.get("svix-timestamp"),
        },
        status: "completed",
        processed_at: new Date().toISOString(),
      });
      await supabase.from("webhooks").update({
        event_count: (resendWebhook.event_count || 0) + 1,
        last_received_at: new Date().toISOString(),
      }).eq("id", resendWebhook.id);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Resend webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
