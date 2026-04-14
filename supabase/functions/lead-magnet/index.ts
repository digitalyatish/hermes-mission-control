import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const magnetId = url.searchParams.get("id");

  if (!magnetId) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { data: magnet, error } = await supabase
      .from("lead_magnets")
      .select("*")
      .eq("id", magnetId)
      .single();

    if (error || !magnet) {
      return new Response("Not found", { status: 404 });
    }

    // Track view
    const updates: Record<string, unknown> = {
      view_count: (magnet.view_count || 0) + 1,
    };
    if (!magnet.viewed_at) {
      updates.viewed_at = new Date().toISOString();
    }
    await supabase.from("lead_magnets").update(updates).eq("id", magnetId);

    // Serve the content
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${magnet.title || "Report"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0F; color: #e8edf5; min-height: 100vh; }
    .header { background: linear-gradient(135deg, rgba(0,191,255,0.1), rgba(168,85,247,0.05)); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 40px; text-align: center; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header p { font-size: 14px; color: rgba(255,255,255,0.5); }
    .content { max-width: 760px; margin: 0 auto; padding: 48px 24px; line-height: 1.7; font-size: 16px; color: rgba(255,255,255,0.8); }
    .content h1 { font-size: 28px; margin: 32px 0 16px; color: white; }
    .content h2 { font-size: 22px; margin: 28px 0 12px; color: white; }
    .content h3 { font-size: 18px; margin: 24px 0 8px; color: white; }
    .content p { margin-bottom: 16px; }
    .content ul, .content ol { padding-left: 24px; margin-bottom: 16px; }
    .content li { margin-bottom: 8px; }
    .content strong { color: #00BFFF; }
    .content a { color: #00BFFF; text-decoration: none; }
    .content a:hover { text-decoration: underline; }
    .cta { text-align: center; padding: 48px 24px; }
    .cta a { display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #00BFFF, #0066CC); color: white; font-size: 18px; font-weight: 600; border-radius: 12px; text-decoration: none; }
    .cta a:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 24px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div class="header">
    <p>Growth Creators AI</p>
    <h1>${magnet.title || "Report"}</h1>
  </div>
  <div class="content">${magnet.content_html || "<p>Content not yet generated.</p>"}</div>
  <div class="cta">
    <a href="https://mani.wiki/discovery">Book a Discovery Call</a>
  </div>
  <div class="footer">
    <p>Prepared by Growth Creators AI &bull; Powered by Hermes</p>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Lead magnet error:", err);
    return new Response("Server error", { status: 500 });
  }
});
