import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("Method not allowed. Use POST.", 405);

  // ── Auth ──
  const apiKey = Deno.env.get("HERMES_API_KEY");
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.headers.get("x-api-key");
  if (!apiKey || provided !== apiKey) return err("Invalid or missing API key", 401);

  // ── Parse body ──
  let action: string;
  let params: Record<string, unknown>;
  try {
    const body = await req.json();
    action = body.action;
    params = body.params || {};
  } catch {
    return err("Invalid JSON body. Expected { action: string, params: object }");
  }

  if (!action) return err("Missing 'action' field");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ═══════════════════════════════════════════
    // MEETINGS
    // ═══════════════════════════════════════════

    if (action === "meetings.list") {
      const { search, type, tags, date_from, date_to, limit = 50, offset = 0 } = params as {
        search?: string; type?: string; tags?: string[]; date_from?: string; date_to?: string; limit?: number; offset?: number;
      };
      const clampedLimit = Math.min(Number(limit) || 50, 200);
      const off = Number(offset) || 0;

      let query = supabase
        .from("fathom_meetings")
        .select(
          "id, fathom_call_id, title, meeting_date, duration_minutes, meeting_type, company_name, company_domain, recorded_by_name, recorded_by_email, attendee_emails, tags, fathom_url, share_url, created_at",
          { count: "exact" }
        )
        .order("meeting_date", { ascending: false });

      if (search) query = query.or(`title.ilike.%${search}%,company_name.ilike.%${search}%,company_domain.ilike.%${search}%`);
      if (type) query = query.eq("meeting_type", type);
      if (tags?.length) query = query.overlaps("tags", tags);
      if (date_from) query = query.gte("meeting_date", date_from);
      if (date_to) query = query.lte("meeting_date", date_to);

      query = query.range(off, off + clampedLimit - 1);
      const { data, count, error } = await query;
      if (error) return err(error.message, 500);
      return ok({ meetings: data, total: count, limit: clampedLimit, offset: off });
    }

    if (action === "meetings.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id' param");
      const { data, error } = await supabase.from("fathom_meetings").select("*").eq("id", id).single();
      if (error) return err(error.message, error.code === "PGRST116" ? 404 : 500);
      return ok(data);
    }

    if (action === "meetings.update_notes") {
      const { id, custom_notes } = params as { id: string; custom_notes: string };
      if (!id) return err("Missing 'id' param");
      const { data, error } = await supabase
        .from("fathom_meetings")
        .update({ custom_notes })
        .eq("id", id)
        .select("id, custom_notes")
        .single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "meetings.update_proposal") {
      const { id, proposal_draft } = params as { id: string; proposal_draft: string };
      if (!id) return err("Missing 'id' param");
      const { data, error } = await supabase
        .from("fathom_meetings")
        .update({ proposal_draft })
        .eq("id", id)
        .select("id, proposal_draft")
        .single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "meetings.add_action") {
      const { id, text } = params as { id: string; text: string };
      if (!id || !text) return err("Missing 'id' or 'text' param");
      const { data: meeting } = await supabase
        .from("fathom_meetings")
        .select("custom_action_items")
        .eq("id", id)
        .single();
      const items = Array.isArray(meeting?.custom_action_items) ? meeting.custom_action_items : [];
      items.push({ text, done: false, created_at: new Date().toISOString() });
      const { data, error } = await supabase
        .from("fathom_meetings")
        .update({ custom_action_items: items })
        .eq("id", id)
        .select("id, custom_action_items")
        .single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "meetings.toggle_action") {
      const { id, index } = params as { id: string; index: number };
      if (!id || index === undefined) return err("Missing 'id' or 'index' param");
      const { data: meeting } = await supabase
        .from("fathom_meetings")
        .select("custom_action_items")
        .eq("id", id)
        .single();
      const items = Array.isArray(meeting?.custom_action_items) ? [...meeting.custom_action_items] : [];
      if (index < 0 || index >= items.length) return err("Index out of range");
      items[index] = { ...items[index], done: !items[index].done };
      const { data, error } = await supabase
        .from("fathom_meetings")
        .update({ custom_action_items: items })
        .eq("id", id)
        .select("id, custom_action_items")
        .single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "meetings.delete_action") {
      const { id, index } = params as { id: string; index: number };
      if (!id || index === undefined) return err("Missing 'id' or 'index' param");
      const { data: meeting } = await supabase
        .from("fathom_meetings")
        .select("custom_action_items")
        .eq("id", id)
        .single();
      const items = Array.isArray(meeting?.custom_action_items) ? [...meeting.custom_action_items] : [];
      if (index < 0 || index >= items.length) return err("Index out of range");
      items.splice(index, 1);
      const { data, error } = await supabase
        .from("fathom_meetings")
        .update({ custom_action_items: items })
        .eq("id", id)
        .select("id, custom_action_items")
        .single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "meetings.update_insights") {
      const { id, hermes_insights } = params as { id: string; hermes_insights: Record<string, unknown> };
      if (!id || !hermes_insights) return err("Missing 'id' or 'hermes_insights' param");
      const { data, error } = await supabase
        .from("fathom_meetings")
        .update({ hermes_insights })
        .eq("id", id)
        .select("id, hermes_insights")
        .single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    // ── SPEC 1: Transcript search across all meetings ──
    if (action === "meetings.search_transcript") {
      const { query, type, date_from, date_to, limit = 20, offset = 0 } = params as {
        query: string; type?: string; date_from?: string; date_to?: string; limit?: number; offset?: number;
      };
      if (!query) return err("Missing 'query' param");
      const clampedLimit = Math.min(Number(limit) || 20, 100);
      const off = Number(offset) || 0;

      // Use Postgres full-text search with ts_headline for match snippets
      let sql = `
        WITH matches AS (
          SELECT id, title, meeting_date, company_name, company_domain, meeting_type, transcript,
            ts_rank(to_tsvector('english', COALESCE(transcript_text, '')), plainto_tsquery('english', $1)) as rank
          FROM fathom_meetings
          WHERE to_tsvector('english', COALESCE(transcript_text, '')) @@ plainto_tsquery('english', $1)
      `;
      const sqlParams: unknown[] = [query];
      let paramIdx = 2;

      if (type) { sql += ` AND meeting_type = $${paramIdx}`; sqlParams.push(type); paramIdx++; }
      if (date_from) { sql += ` AND meeting_date >= $${paramIdx}`; sqlParams.push(date_from); paramIdx++; }
      if (date_to) { sql += ` AND meeting_date <= $${paramIdx}`; sqlParams.push(date_to); paramIdx++; }

      sql += ` ORDER BY rank DESC )
        SELECT *, (SELECT count(*) FROM matches) as total_count
        FROM matches
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      sqlParams.push(clampedLimit, off);

      const { data: rows, error: sqlErr } = await supabase.rpc("exec_sql", { query: sql, params: sqlParams }).maybeSingle();

      // Fallback: if RPC doesn't exist, use ILIKE on transcript_text
      if (sqlErr) {
        // Simple ILIKE fallback
        let q = supabase
          .from("fathom_meetings")
          .select("id, title, meeting_date, company_name, company_domain, meeting_type, transcript", { count: "exact" })
          .ilike("transcript_text", `%${query}%`)
          .order("meeting_date", { ascending: false });

        if (type) q = q.eq("meeting_type", type);
        if (date_from) q = q.gte("meeting_date", date_from);
        if (date_to) q = q.lte("meeting_date", date_to);
        q = q.range(off, off + clampedLimit - 1);

        const { data: meetings, count, error: fallbackErr } = await q;
        if (fallbackErr) return err(fallbackErr.message, 500);

        const queryLower = query.toLowerCase();
        const results = (meetings || []).map((m: Record<string, unknown>) => {
          const transcript = Array.isArray(m.transcript) ? m.transcript : [];
          const matches = transcript
            .filter((e: { text?: string }) => e.text?.toLowerCase().includes(queryLower))
            .slice(0, 5)
            .map((e: { speaker?: { display_name?: string }; text?: string; timestamp?: string }) => ({
              speaker: e.speaker?.display_name || "Unknown",
              text: e.text || "",
              timestamp: e.timestamp || "",
            }));
          return {
            meeting_id: m.id,
            title: m.title,
            meeting_date: m.meeting_date,
            company_name: m.company_name,
            matches,
            match_count: transcript.filter((e: { text?: string }) => e.text?.toLowerCase().includes(queryLower)).length,
          };
        });

        return ok({ results, total: count });
      }

      return ok(rows);
    }

    // ── SPEC 2: Meeting tags ──
    if (action === "meetings.add_tag") {
      const { id, tag } = params as { id: string; tag: string };
      if (!id || !tag) return err("Missing 'id' or 'tag' param");
      // Use array_append and ensure no duplicates
      const { data, error } = await supabase.rpc("add_meeting_tag", { meeting_id: id, new_tag: tag });
      if (error) {
        // Fallback: read-modify-write
        const { data: meeting } = await supabase.from("fathom_meetings").select("tags").eq("id", id).single();
        const tags = Array.isArray(meeting?.tags) ? meeting.tags : [];
        if (!tags.includes(tag)) tags.push(tag);
        const { data: updated, error: updErr } = await supabase
          .from("fathom_meetings").update({ tags }).eq("id", id).select("id, tags").single();
        if (updErr) return err(updErr.message, 500);
        return ok(updated);
      }
      return ok(data);
    }

    if (action === "meetings.remove_tag") {
      const { id, tag } = params as { id: string; tag: string };
      if (!id || !tag) return err("Missing 'id' or 'tag' param");
      const { data: meeting } = await supabase.from("fathom_meetings").select("tags").eq("id", id).single();
      const tags = Array.isArray(meeting?.tags) ? meeting.tags.filter((t: string) => t !== tag) : [];
      const { data, error } = await supabase
        .from("fathom_meetings").update({ tags }).eq("id", id).select("id, tags").single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    // ── SPEC 3: Bulk get meetings ──
    if (action === "meetings.bulk_get") {
      const { ids, include_transcript = false } = params as { ids: string[]; include_transcript?: boolean };
      if (!ids?.length) return err("Missing 'ids' array param");
      if (ids.length > 50) return err("Maximum 50 IDs per request");

      const select = include_transcript
        ? "*"
        : "id, fathom_call_id, title, meeting_date, duration_minutes, meeting_type, company_name, company_domain, recorded_by_name, recorded_by_email, attendee_emails, attendees, summary_markdown, summary_template, action_items, custom_notes, proposal_draft, custom_action_items, hermes_insights, tags, fathom_url, share_url, created_at";

      const { data, error } = await supabase
        .from("fathom_meetings")
        .select(select)
        .in("id", ids);
      if (error) return err(error.message, 500);
      return ok({ meetings: data });
    }

    // ═══════════════════════════════════════════
    // WEBHOOKS
    // ═══════════════════════════════════════════

    if (action === "webhooks.list") {
      const { data, error } = await supabase.from("webhooks").select("*").order("created_at", { ascending: false });
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "webhooks.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id' param");
      const { data, error } = await supabase.from("webhooks").select("*").eq("id", id).single();
      if (error) return err(error.message, error.code === "PGRST116" ? 404 : 500);
      return ok(data);
    }

    if (action === "webhooks.register") {
      const { name, service = "custom", config, webhook_secret } = params as {
        name: string; service?: string; config?: Record<string, unknown>; webhook_secret?: string;
      };
      if (!name) return err("Missing 'name' param");

      const webhookId = crypto.randomUUID();
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const endpointUrl = `${supabaseUrl}/functions/v1/fathom-webhook?id=${webhookId}`;

      if (service === "fathom") {
        const fathomKey = Deno.env.get("FATHOM_API_KEY");
        if (!fathomKey) return err("FATHOM_API_KEY not configured", 500);

        const fathomConfig = {
          destination_url: endpointUrl,
          triggered_for: (config?.triggered_for as string[]) || ["my_recordings"],
          include_transcript: config?.include_transcript ?? true,
          include_summary: config?.include_summary ?? true,
          include_action_items: config?.include_action_items ?? true,
        };

        const fResp = await fetch("https://api.fathom.ai/external/v1/webhooks", {
          method: "POST",
          headers: { "X-Api-Key": fathomKey, "Content-Type": "application/json" },
          body: JSON.stringify(fathomConfig),
        });

        if (!fResp.ok) {
          const errText = await fResp.text();
          return err(`Fathom API error: ${errText}`, 502);
        }

        const fResult = await fResp.json();
        const { data, error } = await supabase.from("webhooks").insert({
          id: webhookId, name, service: "fathom", endpoint_url: endpointUrl,
          webhook_secret: fResult.secret, external_webhook_id: fResult.id?.toString(),
          config: fathomConfig, status: "active",
        }).select().single();
        if (error) return err(error.message, 500);
        return ok({ webhook: data, endpoint_url: endpointUrl, secret: fResult.secret });
      }

      // Generic / Resend
      const { data, error } = await supabase.from("webhooks").insert({
        id: webhookId, name, service, endpoint_url: endpointUrl,
        webhook_secret: webhook_secret || null, config: config || { service },
        status: "active",
      }).select().single();
      if (error) return err(error.message, 500);
      return ok({ webhook: data, endpoint_url: endpointUrl });
    }

    if (action === "webhooks.toggle") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id' param");
      const { data: wh } = await supabase.from("webhooks").select("status").eq("id", id).single();
      if (!wh) return err("Webhook not found", 404);
      const newStatus = wh.status === "active" ? "paused" : "active";
      const { data, error } = await supabase.from("webhooks").update({ status: newStatus }).eq("id", id).select("id, status").single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "webhooks.update") {
      const { id, ...updates } = params as { id: string; [key: string]: unknown };
      if (!id) return err("Missing 'id' param");
      const allowed = ["name", "status", "callback_url", "webhook_secret"];
      const clean: Record<string, unknown> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) clean[k] = updates[k];
      }
      if (Object.keys(clean).length === 0) return err("No valid fields to update");
      const { data, error } = await supabase.from("webhooks").update(clean).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "webhooks.delete") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id' param");
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) return err(error.message, 500);
      return ok({ deleted: true });
    }

    // ═══════════════════════════════════════════
    // WEBHOOK FUNCTIONS
    // ═══════════════════════════════════════════

    if (action === "functions.list") {
      const { webhook_id } = params as { webhook_id: string };
      if (!webhook_id) return err("Missing 'webhook_id' param");
      const { data, error } = await supabase
        .from("webhook_functions")
        .select("*")
        .eq("webhook_id", webhook_id)
        .order("execution_order");
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "functions.create") {
      const { webhook_id, name, prompt, description, is_active = true } = params as {
        webhook_id: string; name: string; prompt: string; description?: string; is_active?: boolean;
      };
      if (!webhook_id || !name || !prompt) return err("Missing webhook_id, name, or prompt");

      const { data: existing } = await supabase
        .from("webhook_functions")
        .select("execution_order")
        .eq("webhook_id", webhook_id)
        .order("execution_order", { ascending: false })
        .limit(1);
      const nextOrder = ((existing?.[0] as { execution_order?: number })?.execution_order ?? -1) + 1;

      const { data, error } = await supabase.from("webhook_functions").insert({
        webhook_id, name, prompt, description: description || null,
        is_active, execution_order: nextOrder,
      }).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "functions.update") {
      const { id, ...updates } = params as { id: string; [key: string]: unknown };
      if (!id) return err("Missing 'id' param");
      const allowed = ["name", "description", "prompt", "is_active"];
      const clean: Record<string, unknown> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) clean[k] = updates[k];
      }
      if (Object.keys(clean).length === 0) return err("No valid fields to update");
      const { data, error } = await supabase.from("webhook_functions").update(clean).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "functions.delete") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id' param");
      const { error } = await supabase.from("webhook_functions").delete().eq("id", id);
      if (error) return err(error.message, 500);
      return ok({ deleted: true });
    }

    if (action === "functions.reorder") {
      const { webhook_id, ordered_ids } = params as { webhook_id: string; ordered_ids: string[] };
      if (!webhook_id || !ordered_ids?.length) return err("Missing webhook_id or ordered_ids");
      const updates = ordered_ids.map((fid, i) =>
        supabase.from("webhook_functions").update({ execution_order: i }).eq("id", fid)
      );
      await Promise.all(updates);
      return ok({ reordered: true });
    }

    // ═══════════════════════════════════════════
    // FEEDBACK
    // ═══════════════════════════════════════════

    if (action === "feedback.create") {
      const { meeting_id, source = "user", feedback_type, content, metadata = {} } = params as {
        meeting_id: string; source?: string; feedback_type: string; content: string; metadata?: Record<string, unknown>;
      };
      if (!meeting_id || !feedback_type || !content) return err("Missing meeting_id, feedback_type, or content");

      const { data, error } = await supabase
        .from("meeting_feedback")
        .insert({ meeting_id, source, feedback_type, content, metadata })
        .select()
        .single();
      if (error) return err(error.message, 500);

      // Auto-tag meeting with has_feedback
      const { data: meeting } = await supabase.from("fathom_meetings").select("tags").eq("id", meeting_id).single();
      const tags = Array.isArray(meeting?.tags) ? meeting.tags : [];
      if (!tags.includes("has_feedback")) {
        tags.push("has_feedback");
        await supabase.from("fathom_meetings").update({ tags }).eq("id", meeting_id);
      }

      return ok(data);
    }

    if (action === "feedback.list") {
      const { meeting_id, source, feedback_type, unread_only, limit = 50, offset = 0 } = params as {
        meeting_id?: string; source?: string; feedback_type?: string; unread_only?: boolean; limit?: number; offset?: number;
      };
      const clampedLimit = Math.min(Number(limit) || 50, 200);
      const off = Number(offset) || 0;

      let query = supabase
        .from("meeting_feedback")
        .select("*, fathom_meetings!inner(title)", { count: "exact" })
        .order("created_at", { ascending: false });

      if (meeting_id) query = query.eq("meeting_id", meeting_id);
      if (source) query = query.eq("source", source);
      if (feedback_type) query = query.eq("feedback_type", feedback_type);
      if (unread_only) query = query.eq("is_read", false);
      query = query.range(off, off + clampedLimit - 1);

      const { data, count, error } = await query;
      if (error) {
        // Fallback without join if relation doesn't work
        let q2 = supabase.from("meeting_feedback").select("*", { count: "exact" }).order("created_at", { ascending: false });
        if (meeting_id) q2 = q2.eq("meeting_id", meeting_id);
        if (source) q2 = q2.eq("source", source);
        if (feedback_type) q2 = q2.eq("feedback_type", feedback_type);
        if (unread_only) q2 = q2.eq("is_read", false);
        q2 = q2.range(off, off + clampedLimit - 1);
        const { data: d2, count: c2, error: e2 } = await q2;
        if (e2) return err(e2.message, 500);
        return ok({ feedback: d2, total: c2, limit: clampedLimit, offset: off });
      }

      // Flatten the join
      const feedback = (data || []).map((f: Record<string, unknown>) => {
        const mtg = f.fathom_meetings as { title?: string } | null;
        return { ...f, meeting_title: mtg?.title || null, fathom_meetings: undefined };
      });

      return ok({ feedback, total: count, limit: clampedLimit, offset: off });
    }

    if (action === "feedback.mark_read") {
      const { ids } = params as { ids: string[] };
      if (!ids?.length) return err("Missing 'ids' array");
      const { error } = await supabase
        .from("meeting_feedback")
        .update({ is_read: true })
        .in("id", ids);
      if (error) return err(error.message, 500);
      return ok({ marked: ids.length });
    }

    if (action === "feedback.respond") {
      const { reply_to, meeting_id, content, metadata = {} } = params as {
        reply_to: string; meeting_id: string; content: string; metadata?: Record<string, unknown>;
      };
      if (!reply_to || !meeting_id || !content) return err("Missing reply_to, meeting_id, or content");

      const { data, error } = await supabase
        .from("meeting_feedback")
        .insert({
          meeting_id,
          source: "agent",
          feedback_type: "note",
          content,
          metadata: { ...metadata, reply_to },
        })
        .select()
        .single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "feedback.stats") {
      const { data: all } = await supabase
        .from("meeting_feedback")
        .select("source, feedback_type, is_read, metadata, created_at");

      if (!all) return ok({ total_feedback: 0 });

      const total = all.length;
      const unreadByAgent = all.filter((f) => f.source === "user" && !f.is_read).length;
      const unreadByUser = all.filter((f) => f.source === "agent" && !f.is_read).length;

      const ratings = all.filter((f) => f.feedback_type === "rating");
      const up = ratings.filter((f) => (f.metadata as Record<string, unknown>)?.rating === "up").length;
      const down = ratings.filter((f) => (f.metadata as Record<string, unknown>)?.rating === "down").length;

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const correctionsThisWeek = all.filter((f) => f.feedback_type === "correction" && f.created_at >= weekAgo).length;

      // Top corrected fields
      const fieldCounts: Record<string, number> = {};
      all.filter((f) => f.feedback_type === "correction").forEach((f) => {
        const field = (f.metadata as Record<string, unknown>)?.field as string;
        if (field) fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      });
      const topCorrectedFields = Object.entries(fieldCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([field, count]) => ({ field, count }));

      return ok({
        total_feedback: total,
        unread_by_agent: unreadByAgent,
        unread_by_user: unreadByUser,
        ratings: { up, down },
        corrections_this_week: correctionsThisWeek,
        top_corrected_fields: topCorrectedFields,
      });
    }

    // ═══════════════════════════════════════════
    // SKILLS
    // ═══════════════════════════════════════════

    if (action === "skills.sync") {
      const { skills } = params as { skills: Array<Record<string, unknown>> };
      if (!skills?.length) return err("Missing 'skills' array");

      let newCount = 0, updatedCount = 0, unchangedCount = 0;

      for (const skill of skills) {
        const name = skill.name as string;
        if (!name) continue;

        // Check if exists
        const { data: existing } = await supabase
          .from("agent_skills").select("id, content_hash").eq("name", name).maybeSingle();

        if (!existing) {
          // New skill
          await supabase.from("agent_skills").insert({
            name, category: skill.category || "uncategorized", version: skill.version || "1.0",
            description: skill.description, tags: skill.tags || [], trigger_pattern: skill.trigger_pattern,
            source: skill.source || "builtin", content_hash: skill.content_hash,
            skill_metadata: skill.skill_metadata || {}, status: "active", last_synced_at: new Date().toISOString(),
          });
          // Log creation
          const { data: created } = await supabase.from("agent_skills").select("id").eq("name", name).single();
          if (created) {
            await supabase.from("skill_changelog").insert({
              skill_id: created.id, change_type: "created",
              change_summary: `Skill "${name}" synced for the first time`, triggered_by: "agent",
            });
          }
          newCount++;
        } else if (skill.content_hash && skill.content_hash !== existing.content_hash) {
          // Updated
          await supabase.from("agent_skills").update({
            category: skill.category, version: skill.version, description: skill.description,
            tags: skill.tags, trigger_pattern: skill.trigger_pattern, source: skill.source,
            content_hash: skill.content_hash, skill_metadata: skill.skill_metadata,
            last_synced_at: new Date().toISOString(),
          }).eq("id", existing.id);
          // Log update
          await supabase.from("skill_changelog").insert({
            skill_id: existing.id, change_type: "patched",
            change_summary: `Skill "${name}" content updated (hash changed)`, triggered_by: "agent",
          });
          updatedCount++;
        } else {
          // Unchanged — just update sync time
          await supabase.from("agent_skills").update({ last_synced_at: new Date().toISOString() }).eq("id", existing.id);
          unchangedCount++;
        }
      }

      return ok({ synced: skills.length, new: newCount, updated: updatedCount, unchanged: unchangedCount });
    }

    if (action === "skills.list") {
      const { category, source, tags, status, search, limit = 50, offset = 0 } = params as {
        category?: string; source?: string; tags?: string[]; status?: string; search?: string; limit?: number; offset?: number;
      };
      const clampedLimit = Math.min(Number(limit) || 50, 200);
      const off = Number(offset) || 0;

      let query = supabase.from("agent_skills")
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false });

      if (category) query = query.eq("category", category);
      if (source) query = query.eq("source", source);
      if (status) query = query.eq("status", status);
      if (tags?.length) query = query.overlaps("tags", tags);
      if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      query = query.range(off, off + clampedLimit - 1);

      const { data, count, error } = await query;
      if (error) return err(error.message, 500);

      // Get changelog counts per skill
      const skillIds = (data || []).map((s: { id: string }) => s.id);
      let changelogCounts: Record<string, number> = {};
      if (skillIds.length) {
        const { data: counts } = await supabase
          .from("skill_changelog")
          .select("skill_id")
          .in("skill_id", skillIds);
        if (counts) {
          for (const c of counts) {
            changelogCounts[c.skill_id] = (changelogCounts[c.skill_id] || 0) + 1;
          }
        }
      }

      const skills = (data || []).map((s: Record<string, unknown>) => ({
        ...s,
        changelog_count: changelogCounts[(s as { id: string }).id] || 0,
      }));

      return ok({ skills, total: count });
    }

    if (action === "skills.get") {
      const { name, id } = params as { name?: string; id?: string };
      if (!name && !id) return err("Missing 'name' or 'id' param");

      let query = supabase.from("agent_skills").select("*");
      if (id) query = query.eq("id", id);
      else query = query.eq("name", name);

      const { data: skill, error } = await query.single();
      if (error) return err(error.message, error.code === "PGRST116" ? 404 : 500);

      // Get recent changes
      const { data: changes } = await supabase
        .from("skill_changelog")
        .select("*")
        .eq("skill_id", skill.id)
        .order("created_at", { ascending: false })
        .limit(20);

      return ok({ ...skill, recent_changes: changes || [] });
    }

    if (action === "skills.log_change") {
      const { skill_name, change_type, change_summary, change_details = {}, triggered_by = "agent", meeting_id } = params as {
        skill_name: string; change_type: string; change_summary: string;
        change_details?: Record<string, unknown>; triggered_by?: string; meeting_id?: string;
      };
      if (!skill_name || !change_type || !change_summary) return err("Missing skill_name, change_type, or change_summary");

      const { data: skill } = await supabase.from("agent_skills").select("id").eq("name", skill_name).single();
      if (!skill) return err(`Skill "${skill_name}" not found`, 404);

      const { data, error } = await supabase.from("skill_changelog").insert({
        skill_id: skill.id, change_type, change_summary, change_details,
        triggered_by, meeting_id: meeting_id || null,
      }).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "skills.changelog") {
      const { skill_name, change_type, triggered_by, date_from, limit = 50, offset = 0 } = params as {
        skill_name?: string; change_type?: string; triggered_by?: string; date_from?: string; limit?: number; offset?: number;
      };
      const clampedLimit = Math.min(Number(limit) || 50, 200);
      const off = Number(offset) || 0;

      let query = supabase.from("skill_changelog").select("*", { count: "exact" }).order("created_at", { ascending: false });

      if (skill_name) {
        const { data: skill } = await supabase.from("agent_skills").select("id").eq("name", skill_name).single();
        if (skill) query = query.eq("skill_id", skill.id);
      }
      if (change_type) query = query.eq("change_type", change_type);
      if (triggered_by) query = query.eq("triggered_by", triggered_by);
      if (date_from) query = query.gte("created_at", date_from);
      query = query.range(off, off + clampedLimit - 1);

      const { data, count, error } = await query;
      if (error) return err(error.message, 500);

      // Enrich with skill names
      const skillIds = [...new Set((data || []).map((c: { skill_id: string }) => c.skill_id))];
      const { data: skillData } = await supabase.from("agent_skills").select("id, name, category").in("id", skillIds);
      const skillMap: Record<string, { name: string; category: string }> = {};
      (skillData || []).forEach((s: { id: string; name: string; category: string }) => { skillMap[s.id] = { name: s.name, category: s.category }; });

      const changes = (data || []).map((c: Record<string, unknown>) => ({
        ...c,
        skill_name: skillMap[(c as { skill_id: string }).skill_id]?.name || "Unknown",
        skill_category: skillMap[(c as { skill_id: string }).skill_id]?.category || "",
      }));

      return ok({ changes, total: count });
    }

    if (action === "skills.stats") {
      const { data: allSkills } = await supabase.from("agent_skills").select("id, source, category, name");
      const { data: allChanges } = await supabase.from("skill_changelog").select("skill_id, triggered_by, created_at");

      const skills = allSkills || [];
      const changes = allChanges || [];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const bySource: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      skills.forEach((s) => {
        bySource[s.source] = (bySource[s.source] || 0) + 1;
        byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      });

      const changesThisWeek = changes.filter((c) => c.created_at >= weekAgo).length;

      const skillChangeCounts: Record<string, number> = {};
      changes.forEach((c) => { skillChangeCounts[c.skill_id] = (skillChangeCounts[c.skill_id] || 0) + 1; });
      const skillNameMap: Record<string, string> = {};
      skills.forEach((s) => { skillNameMap[s.id] = s.name; });
      const mostActive = Object.entries(skillChangeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ name: skillNameMap[id] || "Unknown", changes: count }));

      const learningSources: Record<string, number> = {};
      changes.forEach((c) => { learningSources[c.triggered_by] = (learningSources[c.triggered_by] || 0) + 1; });

      return ok({
        total_skills: skills.length,
        by_source: bySource,
        by_category: byCategory,
        total_changes: changes.length,
        changes_this_week: changesThisWeek,
        most_active_skills: mostActive,
        learning_sources: learningSources,
      });
    }

    if (action === "skills.update_metadata") {
      const { name, status, skill_metadata, tags, description } = params as {
        name: string; status?: string; skill_metadata?: Record<string, unknown>; tags?: string[]; description?: string;
      };
      if (!name) return err("Missing 'name' param");

      const updates: Record<string, unknown> = {};
      if (status !== undefined) updates.status = status;
      if (skill_metadata !== undefined) updates.skill_metadata = skill_metadata;
      if (tags !== undefined) updates.tags = tags;
      if (description !== undefined) updates.description = description;
      if (Object.keys(updates).length === 0) return err("No fields to update");

      const { data, error } = await supabase
        .from("agent_skills").update(updates).eq("name", name).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    // ═══════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════

    if (action === "stats.get") {
      const { data: meetings } = await supabase
        .from("fathom_meetings")
        .select("meeting_date, duration_minutes, meeting_type, company_domain");

      if (!meetings) return ok({ total_meetings: 0 });

      const total = meetings.length;
      const external = meetings.filter((m) => m.meeting_type === "external").length;
      const internal = total - external;
      const companies = new Set(meetings.map((m) => m.company_domain).filter(Boolean)).size;
      const totalMinutes = meetings.reduce((s, m) => s + (m.duration_minutes || 0), 0);

      // Weekly trend
      const weeks: Record<string, number> = {};
      for (const m of meetings) {
        if (!m.meeting_date) continue;
        const d = new Date(m.meeting_date);
        const ws = new Date(d);
        ws.setDate(d.getDate() - d.getDay());
        const key = ws.toISOString().slice(5, 10);
        weeks[key] = (weeks[key] || 0) + 1;
      }
      const weeklyTrend = Object.entries(weeks)
        .sort()
        .slice(-7)
        .map(([week, count]) => ({ week, count }));

      // Top companies
      const cc: Record<string, number> = {};
      for (const m of meetings) {
        if (m.company_domain && m.meeting_type === "external") {
          cc[m.company_domain] = (cc[m.company_domain] || 0) + 1;
        }
      }
      const topCompanies = Object.entries(cc)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, count]) => ({ domain, count }));

      return ok({
        total_meetings: total,
        external_meetings: external,
        internal_meetings: internal,
        unique_companies: companies,
        total_hours: Math.round(totalMinutes / 60),
        total_minutes: totalMinutes,
        weekly_trend: weeklyTrend,
        top_companies: topCompanies,
      });
    }

    // ═══════════════════════════════════════════
    // NOTIFY — Agent email utility
    // ═══════════════════════════════════════════

    if (action === "notify.send_email") {
      const { to, subject, body_html, body_text, from_name, from_email } = params as {
        to?: string; subject: string; body_html?: string; body_text?: string; from_name?: string; from_email?: string;
      };
      if (!subject) return err("Missing 'subject'");
      if (!body_html && !body_text) return err("Missing 'body_html' or 'body_text'");

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return err("RESEND_API_KEY not configured", 500);

      const recipient = to || Deno.env.get("DEFAULT_REPLY_TO") || "your-email@example.com";
      const senderName = from_name || Deno.env.get("DEFAULT_FROM_NAME") || "Your Name";
      const senderEmail = from_email || Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com";
      const html = body_html || `<pre style="font-family:monospace;white-space:pre-wrap;color:#e8edf5;background:#0A0A0F;padding:24px;border-radius:8px;">${body_text}</pre>`;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${senderName} <${senderEmail}>`,
          to: [recipient],
          reply_to: Deno.env.get("DEFAULT_REPLY_TO") || "your-email@example.com",
          subject,
          html,
          text: body_text,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return err(`Resend error: ${errText}`, 502);
      }

      const result = await resp.json();
      return ok({ resend_id: result.id, to: recipient, subject });
    }

    // ═══════════════════════════════════════════
    // MEMORY
    // ═══════════════════════════════════════════

    if (action === "memory.sync") {
      const { memory_entries = [], user_entries = [] } = params as {
        memory_entries?: Array<{ memory_type: string; content: string }>;
        user_entries?: Array<{ memory_type: string; content: string }>;
      };
      const allEntries = [...memory_entries, ...user_entries];
      let newCount = 0, updatedCount = 0, removedCount = 0;

      for (const entry of allEntries) {
        const { data: existing } = await supabase
          .from("agent_memory")
          .select("id, content")
          .eq("memory_type", entry.memory_type)
          .eq("content", entry.content)
          .eq("is_active", true)
          .maybeSingle();

        if (!existing) {
          await supabase.from("agent_memory").insert({
            memory_type: entry.memory_type,
            content: entry.content,
            source: "agent",
            is_active: true,
          });
          newCount++;
        }
      }

      // Mark entries not in the incoming set as inactive
      const incomingContents = allEntries.map(e => e.content);
      const { data: active } = await supabase
        .from("agent_memory")
        .select("id, content")
        .eq("is_active", true);

      for (const a of (active || [])) {
        if (!incomingContents.includes(a.content)) {
          await supabase.from("agent_memory").update({ is_active: false }).eq("id", a.id);
          removedCount++;
        }
      }

      return ok({
        memory_synced: memory_entries.length,
        user_synced: user_entries.length,
        new: newCount,
        updated: updatedCount,
        removed: removedCount,
      });
    }

    if (action === "memory.list") {
      const { memory_type, include_inactive = false } = params as { memory_type?: string; include_inactive?: boolean };
      let q = supabase.from("agent_memory").select("*").order("created_at", { ascending: false });
      if (memory_type) q = q.eq("memory_type", memory_type);
      if (!include_inactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ entries: data, total: data?.length || 0 });
    }

    if (action === "memory.history") {
      const { memory_type, limit = 50 } = params as { memory_type?: string; limit?: number };
      let q = supabase.from("agent_memory").select("*").order("created_at", { ascending: false }).limit(Number(limit));
      if (memory_type) q = q.eq("memory_type", memory_type);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "memory.log_daily") {
      const p = params as Record<string, unknown>;
      const today = new Date().toISOString().slice(0, 10);

      const { data: existing } = await supabase
        .from("memory_daily_logs")
        .select("*")
        .eq("log_date", today)
        .maybeSingle();

      if (existing) {
        // Append to existing sections
        const updates: Record<string, unknown> = { last_synced_at: new Date().toISOString(), sync_count: (existing.sync_count || 0) + 1 };
        const appendFields = ["summary", "decisions_made", "things_learned", "context_notes", "active_projects", "blocked_items", "skills_updated"];
        for (const f of appendFields) {
          if (p[f]) {
            updates[f] = existing[f] ? existing[f] + "\n\n---\n\n" + p[f] : p[f];
          }
        }
        if (p.metrics) {
          updates.metrics = { ...(existing.metrics || {}), ...(p.metrics as Record<string, unknown>) };
        }
        const { data, error } = await supabase.from("memory_daily_logs").update(updates).eq("id", existing.id).select().single();
        if (error) return err(error.message, 500);
        return ok(data);
      } else {
        const { data, error } = await supabase.from("memory_daily_logs").insert({
          log_date: today,
          summary: p.summary,
          decisions_made: p.decisions_made,
          things_learned: p.things_learned,
          context_notes: p.context_notes,
          active_projects: p.active_projects,
          blocked_items: p.blocked_items,
          skills_updated: p.skills_updated,
          metrics: p.metrics || {},
          sync_count: 1,
          last_synced_at: new Date().toISOString(),
        }).select().single();
        if (error) return err(error.message, 500);
        return ok(data);
      }
    }

    if (action === "memory.get_daily") {
      const { date } = params as { date: string };
      if (!date) return err("Missing 'date'");
      const { data, error } = await supabase.from("memory_daily_logs").select("*").eq("log_date", date).maybeSingle();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "memory.list_daily") {
      const { date_from, limit = 30 } = params as { date_from?: string; limit?: number };
      let q = supabase.from("memory_daily_logs").select("*").order("log_date", { ascending: false }).limit(Number(limit));
      if (date_from) q = q.gte("log_date", date_from);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "memory.snapshot") {
      const p = params as Record<string, unknown>;
      if (!p.snapshot_type || !p.title) return err("Missing snapshot_type or title");
      const { data, error } = await supabase.from("memory_snapshots").insert({
        snapshot_type: p.snapshot_type,
        session_id: p.session_id,
        title: p.title,
        persistent_memory: p.persistent_memory,
        user_profile: p.user_profile,
        session_summary: p.session_summary,
        key_context: p.key_context,
        open_threads: p.open_threads,
        cron_state: p.cron_state || {},
        skills_state: p.skills_state || {},
        recoverable_items: p.recoverable_items || [],
      }).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "memory.list_snapshots") {
      const { snapshot_type, limit = 20 } = params as { snapshot_type?: string; limit?: number };
      let q = supabase.from("memory_snapshots").select("id, snapshot_type, session_id, title, session_summary, recoverable_items, created_at").order("created_at", { ascending: false }).limit(Number(limit));
      if (snapshot_type) q = q.eq("snapshot_type", snapshot_type);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "memory.get_snapshot") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("memory_snapshots").select("*").eq("id", id).single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "memory.stats") {
      const { data: mem } = await supabase.from("agent_memory").select("memory_type, is_active, content, updated_at");
      const { data: logs } = await supabase.from("memory_daily_logs").select("log_date, sync_count").order("log_date", { ascending: false });
      const { data: snaps } = await supabase.from("memory_snapshots").select("snapshot_type, created_at");

      const active = (mem || []).filter(m => m.is_active);
      const memEntries = active.filter(m => m.memory_type === "memory");
      const userEntries = active.filter(m => m.memory_type === "user");
      const totalChars = active.reduce((s, m) => s + (m.content?.length || 0), 0);
      const lastSynced = active.length > 0 ? active.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at : null;

      const logDates = (logs || []).map(l => l.log_date);
      let streak = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < logDates.length; i++) {
        const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        if (logDates.includes(expected)) streak++;
        else break;
      }

      const snapsByType: Record<string, number> = {};
      (snaps || []).forEach(s => { snapsByType[s.snapshot_type] = (snapsByType[s.snapshot_type] || 0) + 1; });

      return ok({
        persistent_memory: {
          active_entries: active.length,
          total_entries: (mem || []).length,
          memory_entries: memEntries.length,
          user_entries: userEntries.length,
          total_chars: totalChars,
          last_synced: lastSynced,
        },
        daily_logs: {
          total_days: (logs || []).length,
          today_sync_count: logs?.find(l => l.log_date === today)?.sync_count || 0,
          streak_days: streak,
          last_log_date: logDates[0] || null,
        },
        snapshots: {
          total: (snaps || []).length,
          by_type: snapsByType,
          last_snapshot: snaps?.length ? snaps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at : null,
        },
      });
    }

    // ═══════════════════════════════════════════
    // CRON MANAGEMENT
    // ═══════════════════════════════════════════

    if (action === "cron.status") {
      // Get pause states
      const { data: pauses } = await supabase.from("cron_pauses").select("*").order("cron_name");

      // Get last activity per cron from activity log
      const { data: activities } = await supabase.from("agent_activity_log").select("source, status, created_at, summary, duration_seconds").order("created_at", { ascending: false }).limit(500);

      const today = new Date().toISOString().slice(0, 10);
      const crons = (pauses || []).map(p => {
        const srcActivities = (activities || []).filter(a => a.source === p.cron_name);
        const todayActs = srcActivities.filter(a => a.created_at?.startsWith(today));
        const latest = srcActivities[0];
        return {
          name: p.cron_name,
          paused: p.paused,
          pause_reason: p.reason,
          paused_at: p.paused_at,
          paused_by: p.paused_by,
          last_run: latest?.created_at || null,
          last_status: latest?.status || null,
          last_summary: latest?.summary || null,
          runs_today: todayActs.length,
        };
      });

      return ok({ crons });
    }

    if (action === "cron.pause") {
      const { name, reason } = params as { name: string; reason?: string };
      if (!name) return err("Missing 'name'");

      // Handle bulk names
      const names = name === "outreach"
        ? ["campaign_manager", "nurture_personalizer", "sdr_intelligence"]
        : name === "all"
        ? (await supabase.from("cron_pauses").select("cron_name")).data?.map((r: { cron_name: string }) => r.cron_name) || []
        : [name];

      for (const n of names) {
        await supabase.from("cron_pauses").upsert({
          cron_name: n, paused: true, reason: reason || "Paused manually",
          paused_at: new Date().toISOString(), paused_by: "user",
        }, { onConflict: "cron_name" });
      }

      // Log activity
      await supabase.from("agent_activity_log").insert({
        activity_type: "cron_paused", source: "manual",
        summary: `Paused: ${names.join(", ")}${reason ? `. Reason: ${reason}` : ""}`,
        details: { crons: names, reason }, status: "success",
      });

      return ok({ paused: names });
    }

    if (action === "cron.resume") {
      const { name } = params as { name: string };
      if (!name) return err("Missing 'name'");

      const names = name === "outreach"
        ? ["campaign_manager", "nurture_personalizer", "sdr_intelligence"]
        : name === "all"
        ? (await supabase.from("cron_pauses").select("cron_name")).data?.map((r: { cron_name: string }) => r.cron_name) || []
        : [name];

      for (const n of names) {
        await supabase.from("cron_pauses").upsert({
          cron_name: n, paused: false, reason: null, paused_at: null, paused_by: null,
        }, { onConflict: "cron_name" });
      }

      await supabase.from("agent_activity_log").insert({
        activity_type: "cron_resumed", source: "manual",
        summary: `Resumed: ${names.join(", ")}`,
        details: { crons: names }, status: "success",
      });

      return ok({ resumed: names });
    }

    // ═══════════════════════════════════════════
    // SKILL BUILDER
    // ═══════════════════════════════════════════

    if (action === "skill_builder.submit") {
      const { input_type, input_url, input_text, input_title } = params as {
        input_type: string; input_url?: string; input_text?: string; input_title?: string;
      };
      if (!input_type) return err("Missing 'input_type'");
      const row: Record<string, unknown> = { input_type, input_url, input_text, input_title, submitted_by: "user" };
      // Raw text needs no extraction
      if (input_type === "raw_text" && input_text) {
        row.extracted_content = input_text;
        row.extraction_status = "extracted";
      }
      const { data, error } = await supabase.from("skill_submissions").insert(row).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "skill_builder.list") {
      const { processing_status, limit = 20, offset = 0 } = params as { processing_status?: string; limit?: number; offset?: number };
      let q = supabase.from("skill_submissions").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (processing_status) q = q.eq("processing_status", processing_status);
      q = q.range(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 20, 100) - 1);
      const { data, count, error } = await q;
      if (error) return err(error.message, 500);

      // Get proposal counts per submission
      const ids = (data || []).map((s: { id: string }) => s.id);
      let proposalCounts: Record<string, { total: number; approved: number; pending: number; rejected: number }> = {};
      if (ids.length) {
        const { data: props } = await supabase.from("skill_proposals").select("submission_id, status").in("submission_id", ids);
        for (const p of (props || [])) {
          if (!proposalCounts[p.submission_id]) proposalCounts[p.submission_id] = { total: 0, approved: 0, pending: 0, rejected: 0 };
          proposalCounts[p.submission_id].total++;
          if (p.status === "approved") proposalCounts[p.submission_id].approved++;
          else if (p.status === "pending") proposalCounts[p.submission_id].pending++;
          else if (p.status === "rejected") proposalCounts[p.submission_id].rejected++;
        }
      }

      const submissions = (data || []).map((s: Record<string, unknown>) => ({
        ...s,
        proposal_count: proposalCounts[(s as { id: string }).id]?.total || 0,
        approved_count: proposalCounts[(s as { id: string }).id]?.approved || 0,
        pending_count: proposalCounts[(s as { id: string }).id]?.pending || 0,
      }));

      return ok({ submissions, total: count });
    }

    if (action === "skill_builder.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data: sub, error } = await supabase.from("skill_submissions").select("*").eq("id", id).single();
      if (error) return err(error.message, 500);
      const { data: proposals } = await supabase.from("skill_proposals").select("*").eq("submission_id", id).order("created_at");
      return ok({ ...sub, proposals: proposals || [] });
    }

    if (action === "skill_builder.extract") {
      const { id, extracted_content, extraction_status = "extracted", extraction_error } = params as {
        id: string; extracted_content?: string; extraction_status?: string; extraction_error?: string;
      };
      if (!id) return err("Missing 'id'");
      const updates: Record<string, unknown> = { extraction_status };
      if (extracted_content) updates.extracted_content = extracted_content;
      if (extraction_error) updates.extraction_error = extraction_error;
      const { data, error } = await supabase.from("skill_submissions").update(updates).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "skill_builder.propose") {
      const p = params as Record<string, unknown>;
      if (!p.submission_id || !p.skill_name || !p.skill_content) return err("Missing submission_id, skill_name, or skill_content");
      const { data, error } = await supabase.from("skill_proposals").insert({
        submission_id: p.submission_id,
        skill_name: p.skill_name,
        skill_category: p.skill_category || "learned",
        skill_version: p.skill_version || "1.0",
        skill_description: p.skill_description || "",
        skill_tags: p.skill_tags || [],
        skill_trigger: p.skill_trigger,
        skill_content: p.skill_content,
      }).select().single();
      if (error) return err(error.message, 500);
      // Update submission processing_status
      await supabase.from("skill_submissions").update({ processing_status: "completed", processing_notes: p.processing_notes }).eq("id", p.submission_id);
      return ok(data);
    }

    if (action === "skill_builder.approve") {
      const { id, reviewer_notes } = params as { id: string; reviewer_notes?: string };
      if (!id) return err("Missing 'id'");
      const { data: proposal } = await supabase.from("skill_proposals").select("*").eq("id", id).single();
      if (!proposal) return err("Proposal not found", 404);
      const { data, error } = await supabase.from("skill_proposals").update({
        status: "approved", reviewer_notes, created_skill_name: proposal.skill_name,
      }).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "skill_builder.reject") {
      const { id, reviewer_notes } = params as { id: string; reviewer_notes?: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("skill_proposals").update({ status: "rejected", reviewer_notes }).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "skill_builder.edit") {
      const { id, edited_content, reviewer_notes } = params as { id: string; edited_content: string; reviewer_notes?: string };
      if (!id || !edited_content) return err("Missing 'id' or 'edited_content'");
      const { data, error } = await supabase.from("skill_proposals").update({ status: "edited", edited_content, reviewer_notes }).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    // ═══════════════════════════════════════════
    // CALENDAR
    // ═══════════════════════════════════════════

    if (action === "calendar.sync") {
      const { events: evts } = params as { events: Array<Record<string, unknown>> };
      if (!evts?.length) return err("Missing 'events' array");
      let newCount = 0, updatedCount = 0;
      for (const e of evts) {
        if (!e.source || !e.event_id || !e.title || !e.start_time) continue;
        const { data: existing } = await supabase
          .from("calendar_cache")
          .select("id")
          .eq("source", e.source)
          .eq("event_id", e.event_id)
          .maybeSingle();
        if (existing) {
          await supabase.from("calendar_cache").update({
            title: e.title, start_time: e.start_time, end_time: e.end_time,
            color: e.color || "blue", event_type: e.event_type, metadata: e.metadata || {},
            synced_at: new Date().toISOString(),
          }).eq("id", existing.id);
          updatedCount++;
        } else {
          await supabase.from("calendar_cache").insert({
            source: e.source, event_id: e.event_id, title: e.title,
            start_time: e.start_time, end_time: e.end_time,
            color: e.color || "blue", event_type: e.event_type, metadata: e.metadata || {},
          });
          newCount++;
        }
      }
      return ok({ synced: evts.length, new: newCount, updated: updatedCount });
    }

    if (action === "calendar.events") {
      const { date_from, date_to, sources } = params as { date_from?: string; date_to?: string; sources?: string[] };
      const from = date_from || new Date().toISOString().slice(0, 10);
      const to = date_to || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      const allEvents: Array<Record<string, unknown>> = [];

      // 1. Calendar cache (Google events + agent-synced)
      if (!sources || sources.includes("google") || sources.includes("crons")) {
        const { data: cached } = await supabase.from("calendar_cache")
          .select("*")
          .gte("start_time", from)
          .lte("start_time", to + "T23:59:59Z")
          .order("start_time");
        if (cached) allEvents.push(...cached.map(e => ({
          id: e.id, source: e.source, title: e.title, start: e.start_time, end: e.end_time,
          color: e.color, type: e.event_type, metadata: e.metadata,
        })));
      }

      // 2. Nurture sequences (active — show discovery calls + scheduled emails)
      if (!sources || sources.includes("nurture")) {
        const { data: seqs } = await supabase.from("nurture_sequences")
          .select("id, prospect_name, prospect_company, meeting_time, meeting_link")
          .eq("status", "active")
          .gte("meeting_time", from)
          .lte("meeting_time", to + "T23:59:59Z");
        for (const s of (seqs || [])) {
          allEvents.push({
            id: `nurture-call-${s.id}`, source: "nurture",
            title: `Discovery Call \u2014 ${s.prospect_name}${s.prospect_company ? `, ${s.prospect_company}` : ""}`,
            start: s.meeting_time, end: new Date(new Date(s.meeting_time).getTime() + 1800000).toISOString(),
            color: "green", type: "discovery_call", metadata: { sequence_id: s.id, meeting_link: s.meeting_link },
          });
        }

        // Scheduled nurture emails
        const { data: nEmails } = await supabase.from("nurture_emails")
          .select("id, sequence_id, email_type, scheduled_at, nurture_sequences!inner(prospect_name, prospect_company)")
          .eq("status", "scheduled")
          .gte("scheduled_at", from)
          .lte("scheduled_at", to + "T23:59:59Z");
        for (const e of (nEmails || [])) {
          const seq = e.nurture_sequences as { prospect_name?: string; prospect_company?: string } | null;
          allEvents.push({
            id: `nurture-email-${e.id}`, source: "nurture",
            title: `Nurture: ${e.email_type} \u2192 ${seq?.prospect_name || ""}`,
            start: e.scheduled_at, end: new Date(new Date(e.scheduled_at).getTime() + 60000).toISOString(),
            color: "green", type: "nurture_email", metadata: { sequence_id: e.sequence_id, email_type: e.email_type },
          });
        }
      }

      // 3. Active campaigns (send windows)
      if (!sources || sources.includes("campaigns")) {
        const { data: camps } = await supabase.from("campaigns")
          .select("id, name, send_window_start, send_window_end, daily_send_limit")
          .eq("status", "active");
        for (const c of (camps || [])) {
          // Show send window for each day in range
          const startDate = new Date(from);
          const endDate = new Date(to);
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayStr = d.toISOString().slice(0, 10);
            allEvents.push({
              id: `campaign-${c.id}-${dayStr}`, source: "campaign",
              title: `${c.name} \u2014 send window`,
              start: `${dayStr}T${String(c.send_window_start || 9).padStart(2, "0")}:00:00Z`,
              end: `${dayStr}T${String(c.send_window_end || 17).padStart(2, "0")}:00:00Z`,
              color: "orange", type: "campaign_window",
              metadata: { campaign_id: c.id, daily_limit: c.daily_send_limit },
            });
          }
        }
      }

      // Sort by start time
      allEvents.sort((a, b) => new Date(a.start as string).getTime() - new Date(b.start as string).getTime());

      return ok({ events: allEvents });
    }

    // ═══════════════════════════════════════════
    // ACTIVITY LOG
    // ═══════════════════════════════════════════

    if (action === "activity.log") {
      const { activity_type, source, summary, details = {}, status = "success", duration_seconds } = params as {
        activity_type: string; source: string; summary: string; details?: Record<string, unknown>; status?: string; duration_seconds?: number;
      };
      if (!activity_type || !source || !summary) return err("Missing activity_type, source, or summary");
      const { data, error } = await supabase.from("agent_activity_log").insert({
        activity_type, source, summary, details, status, duration_seconds,
      }).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "activity.list") {
      const { source, activity_type, status: actStatus, date_from, limit = 50, offset = 0 } = params as {
        source?: string; activity_type?: string; status?: string; date_from?: string; limit?: number; offset?: number;
      };
      let q = supabase.from("agent_activity_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (source) q = q.eq("source", source);
      if (activity_type) q = q.eq("activity_type", activity_type);
      if (actStatus) q = q.eq("status", actStatus);
      if (date_from) q = q.gte("created_at", date_from);
      q = q.range(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 50, 200) - 1);
      const { data, count, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ activities: data, total: count });
    }

    if (action === "activity.stats") {
      const { data: all } = await supabase.from("agent_activity_log").select("activity_type, source, status, created_at");
      if (!all) return ok({ total_activities: 0 });

      const today = new Date().toISOString().slice(0, 10);
      const todayActivities = all.filter(a => a.created_at?.startsWith(today));

      // By source — last run and runs today
      const bySource: Record<string, { last_run: string | null; runs_today: number; status: string }> = {};
      const sources = [...new Set(all.map(a => a.source))];
      for (const src of sources) {
        const srcActivities = all.filter(a => a.source === src);
        const todaySrc = srcActivities.filter(a => a.created_at?.startsWith(today));
        const latest = srcActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        bySource[src] = { last_run: latest?.created_at || null, runs_today: todaySrc.length, status: latest?.status || "unknown" };
      }

      // By type
      const byType: Record<string, number> = {};
      all.forEach(a => { byType[a.activity_type] = (byType[a.activity_type] || 0) + 1; });

      // Recent errors
      const recentErrors = all.filter(a => a.status === "error").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

      return ok({ total_activities: all.length, today: todayActivities.length, by_source: bySource, by_type: byType, recent_errors: recentErrors });
    }

    // ── campaigns.mark_ready ──
    if (action === "campaigns.mark_ready") {
      const { id, agent_notes } = params as { id: string; agent_notes?: string };
      if (!id) return err("Missing 'id'");
      const updates: Record<string, unknown> = { status: "ready_for_review" };
      if (agent_notes) updates.agent_notes = agent_notes;
      const { data: camp, error } = await supabase.from("campaigns").update(updates).eq("id", id).select().single();
      if (error) return err(error.message, 500);

      // Send notification email
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey && camp) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${Deno.env.get("DEFAULT_FROM_NAME") || "Your Name"} <${Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com"}>`,
              to: [Deno.env.get("DEFAULT_REPLY_TO") || "your-email@example.com"],
              reply_to: Deno.env.get("DEFAULT_REPLY_TO") || "your-email@example.com",
              subject: `Campaign Ready: ${camp.name}`,
              html: `<p>Your campaign <strong>${camp.name}</strong> is ready for review.</p>
<p><strong>${camp.total_leads || 0}</strong> leads, <strong>${camp.sequence_steps || 1}</strong>-email sequence.</p>
${agent_notes ? `<p><em>Agent notes:</em> ${agent_notes}</p>` : ""}
<p><a href="https://localhost:5173/outreach">Review in Mission Control</a></p>`,
            }),
          });
        } catch (e) { console.error("Notification email error:", e); }
      }

      // Log activity
      await supabase.from("agent_activity_log").insert({
        activity_type: "campaign_optimized",
        source: "manual",
        summary: `Campaign "${camp.name}" marked ready for review. ${camp.total_leads || 0} leads.`,
        details: { campaign_id: id, agent_notes },
        status: "success",
      });

      return ok(camp);
    }

    // ═══════════════════════════════════════════
    // NURTURE SEQUENCES
    // ═══════════════════════════════════════════

    if (action === "nurture.list") {
      const { status, limit = 20, offset = 0 } = params as { status?: string; limit?: number; offset?: number };
      let q = supabase.from("nurture_sequences").select("*", { count: "exact" }).order("meeting_time", { ascending: true });
      if (status) q = q.eq("status", status);
      q = q.range(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 20, 100) - 1);
      const { data, count, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ sequences: data, total: count });
    }

    if (action === "nurture.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data: seq, error } = await supabase.from("nurture_sequences").select("*").eq("id", id).single();
      if (error) return err(error.message, 500);
      const { data: emails } = await supabase.from("nurture_emails").select("*").eq("sequence_id", id).order("scheduled_at");
      return ok({ ...seq, emails: emails || [] });
    }

    if (action === "nurture.create") {
      const p = params as Record<string, unknown>;
      if (!p.prospect_email || !p.meeting_time || !p.booking_uid) return err("Missing prospect_email, meeting_time, or booking_uid");

      // Create or find lead
      const { data: existingLead } = await supabase.from("leads").select("id").eq("email", p.prospect_email).maybeSingle();
      let leadId: string;
      if (existingLead) {
        leadId = existingLead.id;
        await supabase.from("leads").update({ status: "booked", tags: ["nurture_active", "discovery_booked"] }).eq("id", leadId);
      } else {
        const { data: newLead } = await supabase.from("leads").insert({
          email: p.prospect_email, first_name: (p.prospect_name as string)?.split(" ")[0],
          last_name: (p.prospect_name as string)?.split(" ").slice(1).join(" "), company_name: p.prospect_company,
          status: "booked", source: "manual", tags: ["nurture_active", "discovery_booked"],
        }).select("id").single();
        leadId = newLead!.id;
      }

      const meetingTime = new Date(p.meeting_time as string);
      // Simple schedule calc
      const now = new Date();
      const hoursUntil = (meetingTime.getTime() - now.getTime()) / 3600000;
      const emailTypes: Array<{ type: string; offset: number }> = [];
      emailTypes.push({ type: "welcome", offset: 0 });
      if (hoursUntil > 96) { emailTypes.push({ type: "value_1", offset: 48 }); emailTypes.push({ type: "value_2", offset: 96 }); }
      else if (hoursUntil > 48) { emailTypes.push({ type: "value_1", offset: hoursUntil / 2 }); }
      if (hoursUntil > 26) emailTypes.push({ type: "reminder_24h", offset: hoursUntil - 24 });
      if (hoursUntil > 2) emailTypes.push({ type: "reminder_1h", offset: hoursUntil - 1 });

      const { data: seq } = await supabase.from("nurture_sequences").insert({
        lead_id: leadId, booking_uid: p.booking_uid, booking_title: p.booking_title || "Discovery Call",
        meeting_time: meetingTime.toISOString(), meeting_link: p.meeting_link,
        prospect_name: p.prospect_name, prospect_email: p.prospect_email,
        prospect_company: p.prospect_company, prospect_notes: p.prospect_notes,
        status: "active", emails_planned: emailTypes.length,
      }).select("id").single();

      for (const e of emailTypes) {
        await supabase.from("nurture_emails").insert({
          sequence_id: seq!.id, lead_id: leadId, email_type: e.type,
          scheduled_at: new Date(now.getTime() + e.offset * 3600000).toISOString(), status: "scheduled",
        });
      }

      return ok({ sequence_id: seq!.id, lead_id: leadId, emails_planned: emailTypes.length });
    }

    if (action === "nurture.update") {
      const { id, ...updates } = params as { id: string; [k: string]: unknown };
      if (!id) return err("Missing 'id'");
      const allowed = ["prospect_industry", "matched_case_studies", "personalization_notes", "industry_vertical", "status"];
      const clean: Record<string, unknown> = {};
      for (const k of allowed) { if (updates[k] !== undefined) clean[k] = updates[k]; }
      const { data, error } = await supabase.from("nurture_sequences").update(clean).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "nurture.cancel") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      await supabase.from("nurture_emails").update({ status: "cancelled" }).eq("sequence_id", id).eq("status", "scheduled");
      const { data } = await supabase.from("nurture_sequences").update({ status: "cancelled" }).eq("id", id).select().single();
      return ok(data);
    }

    if (action === "nurture.reschedule") {
      const { id, new_meeting_time } = params as { id: string; new_meeting_time: string };
      if (!id || !new_meeting_time) return err("Missing 'id' or 'new_meeting_time'");
      // Cancel scheduled emails
      await supabase.from("nurture_emails").update({ status: "cancelled" }).eq("sequence_id", id).eq("status", "scheduled");
      // Update sequence
      const { data } = await supabase.from("nurture_sequences").update({ meeting_time: new_meeting_time, status: "active" }).eq("id", id).select().single();
      return ok(data);
    }

    if (action === "nurture.emails.list") {
      const { sequence_id } = params as { sequence_id: string };
      if (!sequence_id) return err("Missing 'sequence_id'");
      const { data, error } = await supabase.from("nurture_emails").select("*").eq("sequence_id", sequence_id).order("scheduled_at");
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "nurture.emails.update") {
      const { id, ...updates } = params as { id: string; [k: string]: unknown };
      if (!id) return err("Missing 'id'");
      const allowed = ["subject", "body_html", "body_text", "scheduled_at"];
      const clean: Record<string, unknown> = {};
      for (const k of allowed) { if (updates[k] !== undefined) clean[k] = updates[k]; }
      const { data, error } = await supabase.from("nurture_emails").update(clean).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "nurture.emails.send_now") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      // Just set scheduled_at to now — nurture-sender will pick it up, or we send inline
      await supabase.from("nurture_emails").update({ scheduled_at: new Date().toISOString() }).eq("id", id);
      return ok({ queued: true, id });
    }

    if (action === "nurture.emails.skip") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("nurture_emails").update({ status: "skipped" }).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "nurture.queue") {
      const { limit = 20 } = params as { limit?: number };
      const { data, error } = await supabase.from("nurture_emails")
        .select("*, nurture_sequences(prospect_name, prospect_email, prospect_company, meeting_time, meeting_link, personalization_notes, matched_case_studies)")
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(Math.min(Number(limit), 50));
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "nurture.stats") {
      const { data: seqs } = await supabase.from("nurture_sequences").select("status, meeting_time, prospect_name, prospect_company, emails_sent, emails_planned");
      const { data: emails } = await supabase.from("nurture_emails").select("email_type, status, open_count");

      const active = (seqs || []).filter(s => s.status === "active");
      const completed = (seqs || []).filter(s => s.status === "completed");
      const totalSent = (emails || []).filter(e => e.status === "sent").length;
      const totalOpened = (emails || []).filter(e => e.open_count > 0).length;

      const byType: Record<string, { sent: number; opened: number }> = {};
      for (const e of (emails || [])) {
        if (!byType[e.email_type]) byType[e.email_type] = { sent: 0, opened: 0 };
        if (e.status === "sent") byType[e.email_type].sent++;
        if (e.open_count > 0) byType[e.email_type].opened++;
      }

      const upcoming = active
        .sort((a, b) => new Date(a.meeting_time).getTime() - new Date(b.meeting_time).getTime())
        .slice(0, 10)
        .map(s => ({ prospect: s.prospect_name, company: s.prospect_company, meeting_time: s.meeting_time, emails_sent: s.emails_sent, emails_remaining: s.emails_planned - s.emails_sent }));

      return ok({
        active_sequences: active.length,
        completed_sequences: completed.length,
        total_emails_sent: totalSent,
        open_rate: totalSent > 0 ? Number((totalOpened / totalSent * 100).toFixed(1)) : 0,
        emails_by_type: byType,
        upcoming_meetings: upcoming,
      });
    }

    // ═══════════════════════════════════════════
    // OUTREACH — ICP
    // ═══════════════════════════════════════════

    if (action === "icp.create") {
      const { name, ...rest } = params as Record<string, unknown>;
      if (!name) return err("Missing 'name'");
      const { data, error } = await supabase.from("icps").insert({ name, ...rest }).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }
    if (action === "icp.list") {
      const { is_active } = params as { is_active?: boolean };
      let q = supabase.from("icps").select("*").order("created_at", { ascending: false });
      if (is_active !== undefined) q = q.eq("is_active", is_active);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok(data);
    }
    if (action === "icp.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("icps").select("*").eq("id", id).single();
      if (error) return err(error.message, 500);
      return ok(data);
    }
    if (action === "icp.update") {
      const { id, ...updates } = params as { id: string; [k: string]: unknown };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("icps").update(updates).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }
    if (action === "icp.delete") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      await supabase.from("icps").delete().eq("id", id);
      return ok({ deleted: true });
    }

    // ═══════════════════════════════════════════
    // OUTREACH — LEADS
    // ═══════════════════════════════════════════

    if (action === "leads.create") {
      const { email, ...rest } = params as Record<string, unknown>;
      if (!email) return err("Missing 'email'");
      const { data, error } = await supabase.from("leads").insert({ email, ...rest }).select().single();
      if (error) return err(error.message, error.message.includes("duplicate") ? 409 : 500);
      return ok(data);
    }

    if (action === "leads.bulk_create") {
      const { leads: leadsList, source, source_detail, icp_id, auto_enrich } = params as {
        leads: Array<Record<string, unknown>>; source?: string; source_detail?: string; icp_id?: string; auto_enrich?: boolean;
      };
      if (!leadsList?.length) return err("Missing 'leads' array");
      let created = 0, updated = 0, skipped = 0;
      const errors: string[] = [];

      for (const lead of leadsList) {
        if (!lead.email) { errors.push("Missing email"); continue; }
        const { data: existing } = await supabase.from("leads").select("id, do_not_contact").eq("email", lead.email).maybeSingle();
        if (existing?.do_not_contact) { skipped++; continue; }
        const tags = auto_enrich ? ["needs_enrichment"] : [];
        const row = { ...lead, source: source || lead.source || "manual", source_detail: source_detail || lead.source_detail, icp_id: icp_id || lead.icp_id, tags };
        if (existing) {
          await supabase.from("leads").update(row).eq("id", existing.id);
          updated++;
        } else {
          const { error } = await supabase.from("leads").insert(row);
          if (error) errors.push(`${lead.email}: ${error.message}`);
          else created++;
        }
      }
      return ok({ created, updated, skipped, errors });
    }

    if (action === "leads.list") {
      const { status, source, icp_id, tags, search, limit = 50, offset = 0 } = params as {
        status?: string; source?: string; icp_id?: string; tags?: string[]; search?: string; limit?: number; offset?: number;
      };
      let q = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      if (source) q = q.eq("source", source);
      if (icp_id) q = q.eq("icp_id", icp_id);
      if (tags?.length) q = q.overlaps("tags", tags);
      if (search) q = q.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      q = q.range(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 50, 200) - 1);
      const { data, count, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ leads: data, total: count });
    }

    if (action === "leads.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "leads.update") {
      const { id, ...updates } = params as { id: string; [k: string]: unknown };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("leads").update(updates).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "leads.search") {
      const { query, limit = 20 } = params as { query: string; limit?: number };
      if (!query) return err("Missing 'query'");
      const { data, error } = await supabase.from("leads")
        .select("*")
        .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,company_name.ilike.%${query}%,industry.ilike.%${query}%,location.ilike.%${query}%`)
        .limit(Math.min(Number(limit), 100));
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "leads.example_csv") {
      return ok({
        csv_blank: "email,first_name,last_name,company_name,job_title,website,industry,location,phone,notes\n",
        csv_example: "email,first_name,last_name,company_name,job_title,website,industry,location,phone,notes\njohn@acmedental.com,John,Smith,Acme Dental,Managing Partner,https://acmedental.com,Dental,Vancouver BC,,Looking to reduce front desk calls\nsarah@brightsmile.ca,Sarah,Chen,Bright Smile Dentistry,Practice Manager,https://brightsmile.ca,Dental,Toronto ON,416-555-0100,5 locations - needs centralized system\nmike@vanrealtygroup.com,Mike,Johnson,Van Realty Group,Broker/Owner,https://vanrealtygroup.com,Real Estate,Vancouver BC,,Slow lead response times\nlisa@pacificins.com.au,Lisa,Williams,Pacific Insurance,Head of Sales,https://pacificins.com.au,Insurance,Sydney AU,,Scaling cold calling team\nraj@techsolve.ca,Raj,Patel,TechSolve Consulting,CEO,https://techsolve.ca,IT Consulting,Calgary AB,403-555-0200,Manual client onboarding taking too long",
        columns: ["email", "first_name", "last_name", "company_name", "job_title", "website", "industry", "location", "phone", "notes"],
        required_columns: ["email"],
        notes: "Only 'email' is required. Include 'website' for best AI personalization. 'notes' field helps the AI understand their pain points. Extra columns are stored in custom_data.",
      });
    }

    // ═══════════════════════════════════════════
    // OUTREACH — CAMPAIGNS
    // ═══════════════════════════════════════════

    if (action === "campaigns.create") {
      const { name, ...rest } = params as Record<string, unknown>;
      if (!name) return err("Missing 'name'");
      const { data, error } = await supabase.from("campaigns").insert({ name, ...rest }).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "campaigns.list") {
      const { status, limit = 20, offset = 0 } = params as { status?: string; limit?: number; offset?: number };
      let q = supabase.from("campaigns").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      q = q.range(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 20, 100) - 1);
      const { data, count, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ campaigns: data, total: count });
    }

    if (action === "campaigns.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "campaigns.update") {
      const { id, ...updates } = params as { id: string; [k: string]: unknown };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("campaigns").update(updates).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "campaigns.add_leads") {
      const { campaign_id, lead_ids, filter } = params as {
        campaign_id: string; lead_ids?: string[]; filter?: Record<string, unknown>;
      };
      if (!campaign_id) return err("Missing 'campaign_id'");

      let ids = lead_ids || [];
      if (filter && !lead_ids?.length) {
        let q = supabase.from("leads").select("id");
        if (filter.icp_id) q = q.eq("icp_id", filter.icp_id);
        if (filter.status) q = q.eq("status", filter.status);
        if (filter.source) q = q.eq("source", filter.source);
        q = q.eq("do_not_contact", false);
        const { data } = await q;
        ids = (data || []).map((l: { id: string }) => l.id);
      }

      let added = 0;
      for (const lid of ids) {
        const { error } = await supabase.from("campaign_leads").insert({ campaign_id, lead_id: lid });
        if (!error) added++;
      }
      // Update campaign total_leads
      const { count } = await supabase.from("campaign_leads").select("*", { count: "exact", head: true }).eq("campaign_id", campaign_id);
      await supabase.from("campaigns").update({ total_leads: count }).eq("id", campaign_id);
      return ok({ added, total_leads: count });
    }

    if (action === "campaigns.remove_leads") {
      const { campaign_id, lead_ids } = params as { campaign_id: string; lead_ids: string[] };
      if (!campaign_id || !lead_ids?.length) return err("Missing campaign_id or lead_ids");
      await supabase.from("campaign_leads").delete().eq("campaign_id", campaign_id).in("lead_id", lead_ids);
      const { count } = await supabase.from("campaign_leads").select("*", { count: "exact", head: true }).eq("campaign_id", campaign_id);
      await supabase.from("campaigns").update({ total_leads: count }).eq("id", campaign_id);
      return ok({ removed: lead_ids.length, total_leads: count });
    }

    if (action === "campaigns.launch") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data: camp } = await supabase.from("campaigns").select("total_leads, templates").eq("id", id).single();
      if (!camp) return err("Campaign not found", 404);
      if (!camp.total_leads) return err("Campaign has no leads");
      const { data, error } = await supabase.from("campaigns").update({
        status: "active", started_at: new Date().toISOString(),
      }).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "campaigns.pause") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("campaigns").update({ status: "paused" }).eq("id", id).select("id, status").single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "campaigns.resume") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("campaigns").update({ status: "active" }).eq("id", id).select("id, status").single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "campaigns.stats") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data: camp } = await supabase.from("campaigns").select("*").eq("id", id).single();
      if (!camp) return err("Campaign not found", 404);

      const sent = camp.total_sent || 0;
      const rates = sent > 0 ? {
        delivery_rate: Number(((camp.total_delivered || 0) / sent * 100).toFixed(1)),
        open_rate: Number(((camp.total_opened || 0) / sent * 100).toFixed(1)),
        click_rate: Number(((camp.total_clicked || 0) / sent * 100).toFixed(1)),
        reply_rate: Number(((camp.total_replied || 0) / sent * 100).toFixed(1)),
        bounce_rate: Number(((camp.total_bounced || 0) / sent * 100).toFixed(1)),
      } : { delivery_rate: 0, open_rate: 0, click_rate: 0, reply_rate: 0, bounce_rate: 0 };

      return ok({ ...camp, rates });
    }

    // ═══════════════════════════════════════════
    // OUTREACH — EMAILS
    // ═══════════════════════════════════════════

    if (action === "emails.send") {
      const p = params as Record<string, unknown>;
      if (!p.campaign_id || !p.to_email || !p.subject || !p.body_html) return err("Missing required email fields");

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return err("RESEND_API_KEY not configured", 500);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const unsubUrl = `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(p.to_email as string)}&campaign=${p.campaign_id}`;
      const footer = `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;"><p>${p.from_name || Deno.env.get("DEFAULT_FROM_NAME") || "Your Name"} | Growth Creators</p><p><a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a></p></div>`;
      const htmlWithFooter = (p.body_html as string) + footer;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${p.from_name || Deno.env.get("DEFAULT_FROM_NAME") || "Your Name"} <${p.from_email || Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com"}>`,
          to: [p.to_email],
          reply_to: p.reply_to || p.from_email || Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com",
          subject: p.subject,
          html: htmlWithFooter,
          text: p.body_text,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return err(`Resend error: ${errText}`, 502);
      }

      const resendResult = await resp.json();
      const { data: send, error: sendErr } = await supabase.from("email_sends").insert({
        campaign_id: p.campaign_id,
        campaign_lead_id: p.campaign_lead_id,
        lead_id: p.lead_id,
        resend_id: resendResult.id,
        step_number: p.step_number || 1,
        variant_index: p.variant_index || 0,
        subject: p.subject,
        body_html: htmlWithFooter,
        body_text: p.body_text,
        from_email: p.from_email || Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com",
        to_email: p.to_email,
        status: "sent",
        sent_at: new Date().toISOString(),
      }).select().single();
      if (sendErr) return err(sendErr.message, 500);

      // Advance campaign_lead step
      if (p.campaign_lead_id) {
        await supabase.from("campaign_leads").update({
          current_step: p.step_number || 1,
          status: "active",
        }).eq("id", p.campaign_lead_id);
      }

      // Increment campaign sent counter
      const { data: camp } = await supabase.from("campaigns").select("total_sent").eq("id", p.campaign_id).single();
      await supabase.from("campaigns").update({ total_sent: ((camp as Record<string, number>)?.total_sent || 0) + 1 }).eq("id", p.campaign_id);

      // Update lead status
      if (p.lead_id) await supabase.from("leads").update({ status: "contacted" }).eq("id", p.lead_id);

      return ok({ send_id: send?.id, resend_id: resendResult.id });
    }

    if (action === "emails.send_batch") {
      const { emails } = params as { emails: Array<Record<string, unknown>> };
      if (!emails?.length) return err("Missing 'emails' array");
      const results = [];
      for (const e of emails.slice(0, 50)) {
        try {
          const result = await (async () => {
            // Inline send logic
            const resendKey = Deno.env.get("RESEND_API_KEY");
            if (!resendKey) throw new Error("RESEND_API_KEY not configured");
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const unsubUrl = `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(e.to_email as string)}&campaign=${e.campaign_id}`;
            const footer = `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;"><p>${e.from_name || Deno.env.get("DEFAULT_FROM_NAME") || "Your Name"} | Growth Creators</p><p><a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a></p></div>`;
            const resp = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: `${e.from_name || Deno.env.get("DEFAULT_FROM_NAME") || "Your Name"} <${e.from_email || Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com"}>`,
                to: [e.to_email], reply_to: e.reply_to || e.from_email, subject: e.subject, html: (e.body_html as string) + footer,
              }),
            });
            if (!resp.ok) throw new Error(await resp.text());
            const r = await resp.json();
            await supabase.from("email_sends").insert({
              campaign_id: e.campaign_id, campaign_lead_id: e.campaign_lead_id, lead_id: e.lead_id,
              resend_id: r.id, step_number: e.step_number || 1, variant_index: e.variant_index || 0,
              subject: e.subject, body_html: (e.body_html as string) + footer, from_email: e.from_email || Deno.env.get("DEFAULT_FROM_EMAIL") || "your-email@example.com",
              to_email: e.to_email, status: "sent", sent_at: new Date().toISOString(),
            });
            return { to: e.to_email, resend_id: r.id, ok: true };
          })();
          results.push(result);
        } catch (err) {
          results.push({ to: e.to_email, ok: false, error: String(err) });
        }
      }
      return ok({ sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
    }

    if (action === "emails.queue") {
      const { limit = 50 } = params as { limit?: number };
      const { data, error } = await supabase.from("campaign_leads")
        .select("*, leads(*), campaigns!inner(id, name, status, from_name, from_email, reply_to, templates, daily_send_limit, send_window_start, send_window_end)")
        .eq("status", "pending")
        .eq("campaigns.status", "active")
        .order("created_at")
        .limit(Math.min(Number(limit), 100));
      if (error) return err(error.message, 500);
      return ok(data);
    }

    // ═══════════════════════════════════════════
    // OUTREACH — LEAD MAGNETS
    // ═══════════════════════════════════════════

    if (action === "lead_magnets.generate") {
      const { lead_id, campaign_id, magnet_type = "opportunity_brief", title } = params as {
        lead_id: string; campaign_id?: string; magnet_type?: string; title: string;
      };
      if (!lead_id || !title) return err("Missing lead_id or title");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const magnetId = crypto.randomUUID();
      const hostedUrl = `${supabaseUrl}/functions/v1/lead-magnet?id=${magnetId}`;

      const { data, error } = await supabase.from("lead_magnets").insert({
        id: magnetId, lead_id, campaign_id, magnet_type, title,
        content_html: "<p>Content pending generation...</p>", hosted_url: hostedUrl,
      }).select().single();
      if (error) return err(error.message, 500);
      return ok({ ...data, hosted_url: hostedUrl });
    }

    if (action === "lead_magnets.update") {
      const { id, ...updates } = params as { id: string; [k: string]: unknown };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("lead_magnets").update(updates).eq("id", id).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "lead_magnets.get") {
      const { id } = params as { id: string };
      if (!id) return err("Missing 'id'");
      const { data, error } = await supabase.from("lead_magnets").select("*").eq("id", id).single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "lead_magnets.list") {
      const { campaign_id, lead_id, limit = 20 } = params as { campaign_id?: string; lead_id?: string; limit?: number };
      let q = supabase.from("lead_magnets").select("*").order("created_at", { ascending: false }).limit(Math.min(Number(limit), 100));
      if (campaign_id) q = q.eq("campaign_id", campaign_id);
      if (lead_id) q = q.eq("lead_id", lead_id);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok(data);
    }

    // ═══════════════════════════════════════════
    // OUTREACH — SCRAPERS
    // ═══════════════════════════════════════════

    if (action === "scrapers.run") {
      const { scraper_type, query, icp_id, config = {}, max_results = 20, auto_create_campaign, campaign_name } = params as {
        scraper_type: string; query: string; icp_id?: string; config?: Record<string, unknown>;
        max_results?: number; auto_create_campaign?: boolean; campaign_name?: string;
      };
      if (!scraper_type || !query) return err("Missing scraper_type or query");

      // Create scraper run record
      const { data: run, error: runErr } = await supabase.from("scraper_runs").insert({
        scraper_type, query, icp_id, config: { ...config, max_results, auto_create_campaign, campaign_name }, status: "running",
      }).select().single();
      if (runErr) return err(runErr.message, 500);

      // For google_maps, actually run the Apify scraper
      if (scraper_type === "google_maps") {
        const apifyKey = Deno.env.get("APIFY_API_KEY");
        if (!apifyKey) {
          await supabase.from("scraper_runs").update({ status: "failed", error_message: "APIFY_API_KEY not configured" }).eq("id", run.id);
          return err("APIFY_API_KEY not configured", 500);
        }

        try {
          // Start Apify Google Places scraper (wait for finish, max 120s)
          const apifyResp = await fetch(
            "https://api.apify.com/v2/acts/compass~crawler-google-places/runs?waitForFinish=120",
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${apifyKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                searchStringsArray: [query],
                maxCrawledPlacesPerSearch: Math.min(Number(max_results) || 20, 50),
                language: "en",
                maxImages: 0,
                maxReviews: 0,
              }),
            }
          );

          if (!apifyResp.ok) {
            const errText = await apifyResp.text();
            await supabase.from("scraper_runs").update({ status: "failed", error_message: errText }).eq("id", run.id);
            return err(`Apify error: ${errText}`, 502);
          }

          const apifyResult = await apifyResp.json();
          const apifyData = apifyResult.data || apifyResult;
          const datasetId = apifyData.defaultDatasetId;

          if (apifyData.status !== "SUCCEEDED") {
            await supabase.from("scraper_runs").update({
              status: apifyData.status === "RUNNING" ? "running" : "failed",
              error_message: `Apify run status: ${apifyData.status}`,
              config: { ...run.config, apify_run_id: apifyData.id, dataset_id: datasetId },
            }).eq("id", run.id);
            return ok({ run_id: run.id, status: apifyData.status, apify_run_id: apifyData.id, dataset_id: datasetId, message: "Scraper still running. Use scrapers.collect to get results when done." });
          }

          // Fetch results from dataset
          const dataResp = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&limit=${max_results}`,
            { headers: { "Authorization": `Bearer ${apifyKey}` } }
          );
          const places = await dataResp.json();

          // Convert to leads and import
          let leadsCreated = 0;
          const leadIds: string[] = [];
          for (const place of (places || [])) {
            if (!place.title) continue;
            const email = place.email || null;
            const website = place.website || null;
            const leadData = {
              email: email || `${place.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}@placeholder.local`,
              first_name: null,
              last_name: null,
              company_name: place.title,
              job_title: null,
              website,
              phone: place.phone || null,
              industry: place.categoryName || null,
              location: place.address || `${place.city || ""}, ${place.state || ""}`,
              source: "google_maps",
              source_detail: query,
              icp_id: icp_id || null,
              tags: ["scraped", "needs_enrichment"],
              custom_data: {
                google_rating: place.totalScore,
                review_count: place.reviewsCount,
                categories: place.categories,
                google_url: place.url,
                place_id: place.placeId,
                postal_code: place.postalCode,
                neighborhood: place.neighborhood,
              },
              enrichment_data: { scraped_at: new Date().toISOString(), has_website: !!website, has_email: !!email, has_phone: !!place.phone },
            };

            // Upsert by company name + location (since many won't have real emails)
            const { data: existingLead } = await supabase.from("leads").select("id").eq("email", leadData.email).maybeSingle();
            if (existingLead) {
              await supabase.from("leads").update(leadData).eq("id", existingLead.id);
              leadIds.push(existingLead.id);
            } else {
              const { data: newLead } = await supabase.from("leads").insert(leadData).select("id").maybeSingle();
              if (newLead) { leadIds.push(newLead.id); leadsCreated++; }
            }
          }

          // Update scraper run
          await supabase.from("scraper_runs").update({
            status: "completed", results_count: places.length, leads_created: leadsCreated,
            completed_at: new Date().toISOString(),
            config: { ...run.config, apify_run_id: apifyData.id, dataset_id: datasetId, cost_usd: apifyData.usageTotalUsd },
          }).eq("id", run.id);

          // Auto-create campaign if requested
          let campaignId: string | null = null;
          if (auto_create_campaign && leadIds.length > 0) {
            const { data: camp } = await supabase.from("campaigns").insert({
              name: campaign_name || `${query} — Auto Campaign`,
              description: `Auto-generated from Google Maps scrape: "${query}". ${leadsCreated} leads found.`,
              icp_id: icp_id || null,
              ai_level: "full",
              campaign_type: "automated",
              sequence_steps: 3,
              step_delays: [2, 3],
              status: "ai_processing",
              total_leads: leadIds.length,
              agent_notes: `Scraped ${leadsCreated} leads via Google Maps. Query: "${query}". Agent should research websites and generate PAS email sequence.`,
              templates: [{ framework: "pas", guidance: `Leads are ${places[0]?.categoryName || "businesses"} from Google Maps. Personalize based on website analysis.` }],
            }).select("id").single();

            if (camp) {
              campaignId = camp.id;
              for (const lid of leadIds) {
                const { error: clErr } = await supabase.from("campaign_leads").insert({ campaign_id: camp.id, lead_id: lid });
                if (clErr) console.error("campaign_lead insert:", clErr.message);
              }
            }
          }

          // Log activity
          await supabase.from("agent_activity_log").insert({
            activity_type: "cron_run", source: "manual",
            summary: `Scraped ${leadsCreated} leads via Google Maps: "${query}". Cost: $${(apifyData.usageTotalUsd || 0).toFixed(4)}.${campaignId ? " Campaign auto-created." : ""}`,
            details: { query, leads_created: leadsCreated, results: places.length, cost: apifyData.usageTotalUsd, campaign_id: campaignId },
            status: "success",
          });

          return ok({
            run_id: run.id, status: "completed",
            results: places.length, leads_created: leadsCreated,
            lead_ids: leadIds.slice(0, 10),
            campaign_id: campaignId,
            cost_usd: apifyData.usageTotalUsd,
          });
        } catch (apifyErr) {
          await supabase.from("scraper_runs").update({ status: "failed", error_message: String(apifyErr) }).eq("id", run.id);
          return err(`Scraper error: ${apifyErr}`, 500);
        }
      }

      // For other scraper types, just create the record (agent handles execution)
      return ok({ run_id: run.id, status: "pending", message: "Scraper run created. Agent will process." });
    }

    if (action === "scrapers.status") {
      const { run_id } = params as { run_id: string };
      if (!run_id) return err("Missing 'run_id'");
      const { data, error } = await supabase.from("scraper_runs").select("*").eq("id", run_id).single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "scrapers.collect") {
      // Collect results from a completed or running Apify scrape
      const { run_id } = params as { run_id: string };
      if (!run_id) return err("Missing 'run_id'");
      const { data: run } = await supabase.from("scraper_runs").select("*").eq("id", run_id).single();
      if (!run) return err("Run not found", 404);
      const datasetId = (run.config as Record<string, unknown>)?.dataset_id;
      if (!datasetId) return err("No dataset ID found for this run");

      const apifyKey = Deno.env.get("APIFY_API_KEY");
      if (!apifyKey) return err("APIFY_API_KEY not configured", 500);

      const resp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?format=json&limit=100`, {
        headers: { "Authorization": `Bearer ${apifyKey}` },
      });
      const items = await resp.json();
      return ok({ run_id, results: items?.length || 0, items: items || [] });
    }

    if (action === "scrapers.list_sources") {
      return ok({
        sources: [
          { type: "google_maps", name: "Google Maps / Places API", description: "Search for businesses by type and location", required_config: ["api_key"], example_query: "accounting firms in Vancouver BC", fields_extracted: ["company_name", "phone", "website", "location", "rating", "review_count"] },
          { type: "shopify", name: "Shopify Store Finder", description: "Find Shopify stores by niche", required_config: [], example_query: "organic skincare", fields_extracted: ["company_name", "website", "industry", "custom_data"] },
          { type: "custom", name: "Custom Scraper", description: "Agent-defined scraping logic", required_config: ["url_pattern"], example_query: "varies", fields_extracted: ["varies"] },
        ],
      });
    }

    // ═══════════════════════════════════════════
    // OUTREACH — INSIGHTS & STATS
    // ═══════════════════════════════════════════

    if (action === "outreach_insights.create") {
      const { campaign_id, insight_type, finding, action_taken, confidence, metrics } = params as Record<string, unknown>;
      if (!insight_type || !finding) return err("Missing insight_type or finding");
      const { data, error } = await supabase.from("outreach_insights").insert({
        campaign_id, insight_type, finding, action_taken, confidence, metrics,
      }).select().single();
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "outreach_insights.list") {
      const { campaign_id, insight_type, limit = 20 } = params as { campaign_id?: string; insight_type?: string; limit?: number };
      let q = supabase.from("outreach_insights").select("*").order("created_at", { ascending: false }).limit(Math.min(Number(limit), 100));
      if (campaign_id) q = q.eq("campaign_id", campaign_id);
      if (insight_type) q = q.eq("insight_type", insight_type);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok(data);
    }

    if (action === "outreach.stats") {
      const { data: leads } = await supabase.from("leads").select("id", { count: "exact", head: true });
      const { data: campaigns } = await supabase.from("campaigns").select("id, name, status, total_sent, total_opened, total_clicked, total_replied, total_booked");
      const { data: sends } = await supabase.from("email_sends").select("status, sent_at").order("sent_at", { ascending: false }).limit(500);

      const activeCampaigns = (campaigns || []).filter(c => c.status === "active");
      const totalSent = (campaigns || []).reduce((s, c) => s + (c.total_sent || 0), 0);
      const totalOpened = (campaigns || []).reduce((s, c) => s + (c.total_opened || 0), 0);
      const totalClicked = (campaigns || []).reduce((s, c) => s + (c.total_clicked || 0), 0);
      const totalReplied = (campaigns || []).reduce((s, c) => s + (c.total_replied || 0), 0);
      const totalBooked = (campaigns || []).reduce((s, c) => s + (c.total_booked || 0), 0);

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const thisWeekSends = (sends || []).filter(s => s.sent_at && s.sent_at >= weekAgo);

      return ok({
        total_leads: leads,
        total_campaigns: (campaigns || []).length,
        active_campaigns: activeCampaigns.length,
        total_emails_sent: totalSent,
        overall_rates: totalSent > 0 ? {
          open_rate: Number((totalOpened / totalSent * 100).toFixed(1)),
          click_rate: Number((totalClicked / totalSent * 100).toFixed(1)),
          reply_rate: Number((totalReplied / totalSent * 100).toFixed(1)),
          booking_rate: Number((totalBooked / totalSent * 100).toFixed(1)),
        } : { open_rate: 0, click_rate: 0, reply_rate: 0, booking_rate: 0 },
        this_week: { sent: thisWeekSends.length },
        top_campaign: activeCampaigns.sort((a, b) => (b.total_opened || 0) - (a.total_opened || 0))[0] || null,
      });
    }

    return err(`Unknown action: ${action}`);
  } catch (e) {
    console.error("hermes-api error:", e);
    return err(String(e), 500);
  }
});
