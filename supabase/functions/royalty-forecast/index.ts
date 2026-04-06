import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { income, songs } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are a music industry royalty analyst. Analyze this data and provide revenue forecasts.

INCOME DATA (JSON):
${JSON.stringify(income.slice(0, 50))}

SONGS DATA (JSON):
${JSON.stringify(songs.slice(0, 50))}

Respond using ONLY the tool provided.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional music royalty analyst for a South African music company. Analyze royalty data and provide actionable forecasts. Use ZAR (R) currency." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_forecast",
            description: "Provide structured revenue forecast",
            parameters: {
              type: "object",
              properties: {
                threeMonth: { type: "string", description: "3-month revenue forecast as a formatted ZAR amount like 'R 120,000'" },
                twelveMonth: { type: "string", description: "12-month revenue forecast as a formatted ZAR amount" },
                topSongs: { type: "array", items: { type: "string" }, description: "Top 3 performing songs with brief note" },
                declingSongs: { type: "array", items: { type: "string" }, description: "Songs showing decline with brief note" },
                insights: { type: "string", description: "2-3 actionable insights about revenue trends, gaps, and opportunities" },
              },
              required: ["threeMonth", "twelveMonth", "topSongs", "declingSongs", "insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_forecast" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No forecast generated");

    const forecast = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(forecast), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Forecast error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
