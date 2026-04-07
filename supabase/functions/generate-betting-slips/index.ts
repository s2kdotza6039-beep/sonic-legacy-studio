const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body = await req.json().catch(() => ({}));
    const budget = body.budget || 100;
    const slipCount = body.slipCount || 8;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const prompt = `You are an AI sports betting analysis engine. Generate realistic football match analysis and betting slips for ${dateStr}.

INSTRUCTIONS:
1. Create 10-12 fictional but realistic matches from top leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League).
2. For each match calculate: win_prob, draw_prob, lose_prob, over15_prob, over25_prob, btts_prob, confidence (LOW/MEDIUM/HIGH).
3. Filter to only HIGH confidence matches (8-12 matches).
4. Select 5-6 CORE picks (strongest predictions).
5. Generate ${slipCount + 1} betting slips:
   - Slip 1: DAILY_SAFE — includes ALL safe/high-confidence picks of the day (Double Chance, Over 1.5, safe markets only). This slip should have the most selections.
   - Slips 2-4: SAFE (Double Chance, Over 1.5, 3-5 matches, mostly CORE)
   - Slips 5-7: BALANCED (Win, Over 2.5, BTTS, 4-6 matches, CORE + variations)
   - Slips 8-${slipCount + 1}: HIGH_RISK (Correct Score, Underdog Win, Over 3.5, 2-4 matches)
6. Each slip must keep 3-4 CORE picks and vary 1-2 selections.
7. IMPORTANT: Each selection MUST include "kickoff" (match time e.g. "15:00") and "league" (e.g. "Premier League") fields.
8. Budget: R${budget}, stake per slip: R${(budget / (slipCount + 1)).toFixed(0)}

Return valid JSON with this exact structure:
{
  "date": "${dateStr}",
  "matches": [
    {
      "id": 1,
      "home": "Team A",
      "away": "Team B",
      "league": "Premier League",
      "kickoff": "15:00",
      "win_prob": 65,
      "draw_prob": 20,
      "lose_prob": 15,
      "over15_prob": 82,
      "over25_prob": 58,
      "btts_prob": 67,
      "confidence": "HIGH",
      "is_core": true,
      "pattern": "Strong home team, high scoring"
    }
  ],
  "core_picks": [
    { "match_id": 1, "market": "Home Win", "reason": "Strong home form" }
  ],
  "slips": [
    {
      "id": 1,
      "category": "SAFE",
      "stake": ${(budget / slipCount).toFixed(0)},
      "estimated_odds": 3.5,
      "potential_return": 35,
      "selections": [
        { "match_id": 1, "home": "Team A", "away": "Team B", "market": "Over 1.5 Goals", "probability": 82, "is_core": true, "kickoff": "15:00", "league": "Premier League" }
      ]
    }
  ],
  "bankroll": {
    "budget": ${budget},
    "total_slips": ${slipCount},
    "stake_per_slip": ${(budget / slipCount).toFixed(0)}
  }
}`;

    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a football betting analysis AI. Return ONLY valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API call failed [${aiResponse.status}]: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    const slipData = JSON.parse(content);

    return new Response(JSON.stringify(slipData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Error generating betting slips:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
