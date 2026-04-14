import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

async function verifySignature(
  secret: string,
  webhookId: string,
  timestamp: string,
  body: string,
  signature: string
): Promise<boolean> {
  // Decode the base64 secret (remove "whsec_" prefix if present)
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = base64Decode(secretKey);

  // Create the signed content
  const signedContent = `${webhookId}.${timestamp}.${body}`;
  const encoder = new TextEncoder();

  // HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const computedSig = base64Encode(new Uint8Array(sig));

  // Fathom sends "v1,<base64sig>" — may have multiple signatures separated by spaces
  const signatures = signature.split(" ");
  for (const s of signatures) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[0] === "v1") {
      if (computedSig === parts[1]) return true;
    }
  }

  return false;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get webhook ID from query param
    const url = new URL(req.url);
    const webhookId = url.searchParams.get("id");

    if (!webhookId) {
      return new Response(JSON.stringify({ error: "Missing webhook id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read raw body
    const body = await req.text();

    // Look up webhook record
    const { data: webhook, error: whError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", webhookId)
      .single();

    if (whError || !webhook) {
      return new Response(JSON.stringify({ error: "Webhook not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (webhook.status !== "active") {
      return new Response(JSON.stringify({ error: "Webhook is paused" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract signature headers
    const whId = req.headers.get("webhook-id") || "";
    const whTimestamp = req.headers.get("webhook-timestamp") || "";
    const whSignature = req.headers.get("webhook-signature") || "";

    // Verify signature if secret exists
    if (webhook.webhook_secret && whSignature) {
      // Timestamp tolerance check (5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(whTimestamp, 10);
      if (Math.abs(now - ts) > 300) {
        console.error("Webhook timestamp too old:", { now, ts, diff: now - ts });
        return new Response(JSON.stringify({ error: "Timestamp too old" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = await verifySignature(
        webhook.webhook_secret,
        whId,
        whTimestamp,
        body,
        whSignature
      );

      if (!valid) {
        console.error("Webhook signature verification failed");
        // Store as failed event
        await supabase.from("webhook_events").insert({
          webhook_id: webhookId,
          event_type: "signature_failed",
          payload: null,
          headers: { "webhook-id": whId, "webhook-timestamp": whTimestamp },
          status: "failed",
          error_message: "Signature verification failed",
        });
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = { raw: body };
    }

    let meetingId: string | null = null;

    // Store the event
    const { data: event } = await supabase
      .from("webhook_events")
      .insert({
        webhook_id: webhookId,
        event_type: payload.type || "meeting_content_ready",
        payload,
        headers: {
          "webhook-id": whId,
          "webhook-timestamp": whTimestamp,
        },
        status: "processing",
      })
      .select()
      .single();

    // Upsert meeting data into fathom_meetings
    const recordingId = payload.recording_id?.toString() || payload.id?.toString();
    if (recordingId) {
      const meetingData: Record<string, unknown> = {
        fathom_call_id: recordingId,
        title: payload.title || payload.meeting_title || "Untitled Meeting",
        meeting_date: payload.scheduled_start_time || payload.created_at || new Date().toISOString(),
        recording_start: payload.recording_start_time,
        recording_end: payload.recording_end_time,
        fathom_url: payload.url,
        share_url: payload.share_url,
        recorded_by_name: payload.recorded_by?.name,
        recorded_by_email: payload.recorded_by?.email,
      };

      // Duration
      if (payload.recording_start_time && payload.recording_end_time) {
        const start = new Date(payload.recording_start_time).getTime();
        const end = new Date(payload.recording_end_time).getTime();
        meetingData.duration_minutes = Math.round((end - start) / 60000);
      }

      // Attendees
      if (payload.calendar_invitees) {
        meetingData.attendees = payload.calendar_invitees;
        meetingData.attendee_emails = payload.calendar_invitees
          .map((inv: { email?: string }) => inv.email)
          .filter(Boolean);

        // Figure out company
        const external = payload.calendar_invitees.find(
          (inv: { is_external?: boolean }) => inv.is_external
        );
        if (external) {
          meetingData.company_domain = external.email_domain;
          meetingData.company_name = external.email_domain
            ?.replace(".com", "")
            .replace(".ai", "")
            .replace(".io", "")
            .replace(".ca", "");
          if (typeof meetingData.company_name === "string") {
            meetingData.company_name =
              meetingData.company_name.charAt(0).toUpperCase() +
              (meetingData.company_name as string).slice(1);
          }
          meetingData.meeting_type = "external";
        } else {
          meetingData.meeting_type = "internal";
        }
      }

      // Transcript
      if (payload.transcript) {
        meetingData.transcript = payload.transcript;
        if (Array.isArray(payload.transcript)) {
          meetingData.transcript_text = payload.transcript
            .map((e: { text?: string }) => e.text || "")
            .join(" ");
        }
      }

      // Summary
      if (payload.default_summary) {
        meetingData.summary_markdown =
          typeof payload.default_summary === "object"
            ? payload.default_summary.markdown_formatted
            : payload.default_summary;
        meetingData.summary_template =
          typeof payload.default_summary === "object"
            ? payload.default_summary.template_name
            : null;
      }

      // Action items
      if (payload.action_items) {
        meetingData.action_items = payload.action_items;
      }

      // Auto-tag new meetings as needs_analysis so agents know which ones are new
      meetingData.tags = ["needs_analysis"];

      // Upsert
      const { data: upsertedMeeting } = await supabase
        .from("fathom_meetings")
        .upsert(meetingData, { onConflict: "fathom_call_id" })
        .select("id")
        .single();

      meetingId = upsertedMeeting?.id || null;
    }

    // Look up active functions (store references for future AI execution)
    const { data: functions } = await supabase
      .from("webhook_functions")
      .select("id, name, prompt")
      .eq("webhook_id", webhookId)
      .eq("is_active", true)
      .order("execution_order");

    // Update event to completed
    if (event?.id) {
      await supabase
        .from("webhook_events")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
    }

    // Update webhook stats
    await supabase
      .from("webhooks")
      .update({
        last_received_at: new Date().toISOString(),
        event_count: (webhook.event_count || 0) + 1,
      })
      .eq("id", webhookId);

    // SPEC 5: Fire callback URL if configured
    if (webhook.callback_url && meetingId) {
      try {
        await fetch(webhook.callback_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "new_meeting_ingested",
            meeting_id: meetingId,
            webhook_id: webhookId,
            title: payload.title || payload.meeting_title,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (cbErr) {
        console.error("Callback URL error:", cbErr);
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        event_id: event?.id,
        meeting_id: meetingId,
        functions_matched: functions?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
