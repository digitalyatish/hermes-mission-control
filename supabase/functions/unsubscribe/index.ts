import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const campaignId = url.searchParams.get("campaign");

  if (!email) {
    return new Response(html("Missing email parameter."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    // Mark lead as do_not_contact
    await supabase
      .from("leads")
      .update({ do_not_contact: true, status: "unsubscribed" })
      .eq("email", decodeURIComponent(email));

    // Mark campaign_lead as opted_out if campaign specified
    if (campaignId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .eq("email", decodeURIComponent(email))
        .maybeSingle();
      if (lead) {
        await supabase
          .from("campaign_leads")
          .update({ status: "opted_out" })
          .eq("lead_id", lead.id)
          .eq("campaign_id", campaignId);
      }
    }

    return new Response(html("You've been successfully unsubscribed. You won't receive further emails from us."), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return new Response(html("Something went wrong. Please contact us directly to unsubscribe."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});

function html(message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0A0A0F; color: #e8edf5; }
    .card { max-width: 480px; padding: 48px; text-align: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
    h1 { font-size: 24px; margin-bottom: 16px; color: white; }
    p { font-size: 16px; color: rgba(255,255,255,0.6); line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
