import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const fathomApiKey = Deno.env.get("FATHOM_API_KEY");
  if (!fathomApiKey) {
    return new Response(
      JSON.stringify({ error: "FATHOM_API_KEY not configured. Set it via: supabase secrets set FATHOM_API_KEY=your_key" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { name, config } = body;

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate webhook ID
    const webhookId = crypto.randomUUID();

    // Build the destination URL for our fathom-webhook Edge Function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const destinationUrl = `${supabaseUrl}/functions/v1/fathom-webhook?id=${webhookId}`;

    // Register with Fathom API
    const fathomConfig = {
      destination_url: destinationUrl,
      triggered_for: config?.triggered_for || ["my_recordings"],
      include_transcript: config?.include_transcript ?? true,
      include_summary: config?.include_summary ?? true,
      include_action_items: config?.include_action_items ?? true,
    };

    const fathomResponse = await fetch("https://api.fathom.ai/external/v1/webhooks", {
      method: "POST",
      headers: {
        "X-Api-Key": fathomApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fathomConfig),
    });

    if (!fathomResponse.ok) {
      const errorText = await fathomResponse.text();
      console.error("Fathom API error:", fathomResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to register with Fathom",
          status: fathomResponse.status,
          details: errorText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fathomResult = await fathomResponse.json();

    // Store in our webhooks table
    const { data: webhook, error: dbError } = await supabase
      .from("webhooks")
      .insert({
        id: webhookId,
        name,
        service: "fathom",
        endpoint_url: destinationUrl,
        webhook_secret: fathomResult.secret || null,
        external_webhook_id: fathomResult.id?.toString() || null,
        config: fathomConfig,
        status: "active",
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save webhook", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        webhook,
        fathom_webhook_id: fathomResult.id,
        endpoint_url: destinationUrl,
        secret: fathomResult.secret,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Registration error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
