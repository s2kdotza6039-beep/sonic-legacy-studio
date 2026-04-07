import { corsHeaders } from "@supabase/supabase-js/cors";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SPORT_KEYS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
];

const LEAGUE_NAMES: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_france_ligue_one: "Ligue 1",
  soccer_uefa_champs_league: "Champions League",
};

interface LiveMatch {
  id: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  commence_time: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  win_prob: number;
  draw_prob: number;
  lose_prob: number;
  over15_prob: number;
  over25_prob: number;
  btts_prob: number;
}

async function fetchLiveOdds(apiKey: string): Promise<LiveMatch[]> {
  const allEvents: LiveMatch[] = [];
  const markets = "h2h,totals";

  for (const sportKey of SPORT_KEYS) {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=uk,eu&markets=${markets}&oddsFormat=decimal`;
      const response = await fetch(url);
      if (!response.ok) { console.warn(`Odds API ${sportKey}: ${response.status}`); continue; }

      const events = await response.json();
      for (const event of events) {
        if (!event.bookmakers?.length) continue;

        const h2hMarkets = event.bookmakers
          .map((b: any) => b.markets.find((m: any) => m.key === "h2h"))
          .filter(Boolean);

        const totalsMarkets = event.bookmakers
          .map((b: any) => b.markets.find((m: any) => m.key === "totals"))
          .filter(Boolean);

        let homeOdds = 0, drawOdds = 0, awayOdds = 0, count = 0;
        for (const market of h2hMarkets) {
          const home = market.outcomes.find((o: any) => o.name === event.home_team);
          const draw = market.outcomes.find((o: any) => o.name === "Draw");
          const away = market.outcomes.find((o: any) => o.name === event.away_team);
          if (home && draw && away) {
            homeOdds += home.price; drawOdds += draw.price; awayOdds += away.price; count++;
          }
        }
        if (count === 0) continue;

        homeOdds /= count; drawOdds /= count; awayOdds /= count;
        const winProb = Math.round((1 / homeOdds) * 100);
        const drawProb = Math.round((1 / drawOdds) * 100);
        const loseProb = Math.round((1 / awayOdds) * 100);

        let over15Prob = 0, over25Prob = 0;
        for (const market of totalsMarkets) {
          const over = market.outcomes.find((o: any) => o.name === "Over");
          if (over) {
            over25Prob = Math.round((1 / over.price) * 100);
            over15Prob = Math.min(95, over25Prob + 20);
          }
        }
        const bttsProb = Math.round(Math.min(winProb + loseProb, 80) * 0.7 + 15);

        const kickoff = new Date(event.commence_time);
        const kickoffStr = `${kickoff.getUTCHours().toString().padStart(2, "0")}:${kickoff.getUTCMinutes().toString().padStart(2, "0")}`;

        allEvents.push({
          id: event.id,
          home: event.home_team,
          away: event.away_team,
          league: LEAGUE_NAMES[sportKey] || sportKey,
          kickoff: kickoffStr,
          commence_time: event.commence_time,
          home_odds: parseFloat(homeOdds.toFixed(2)),
          draw_odds: parseFloat(drawOdds.toFixed(2)),
          away_odds: parseFloat(awayOdds.toFixed(2)),
          win_prob: winProb, draw_prob: drawProb, lose_prob: loseProb,
          over15_prob: over15Prob, over25_prob: over25Prob, btts_prob: bttsProb,
        });
      }
    } catch (err) {
      console.warn(`Error fetching ${sportKey}:`, err);
    }
  }

  allEvents.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
  return allEvents;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ODDS_API_KEY = Deno.env.get("THE_ODDS_API_KEY");
    if (!ODDS_API_KEY) {
      throw new Error("THE_ODDS_API_KEY is not configured");
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body = await req.json().catch(() => ({}));
    const budget = body.budget || 100;
    const slipCount = body.slipCount || 8;

    // Step 1: Fetch live odds from The Odds API
    console.log("Fetching live odds...");
    const liveMatches = await fetchLiveOdds(ODDS_API_KEY);
    console.log(`Fetched ${liveMatches.length} live matches`);

    if (liveMatches.length === 0) {
      return new Response(
        JSON.stringify({ error: "No upcoming matches found. Try again closer to match day." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Send real odds data to AI for analysis and slip generation
    const matchSummary = liveMatches.map((m, i) => ({
      id: i + 1,
      home: m.home, away: m.away, league: m.league, kickoff: m.kickoff,
      home_odds: m.home_odds, draw_odds: m.draw_odds, away_odds: m.away_odds,
      win_prob: m.win_prob, draw_prob: m.draw_prob, lose_prob: m.lose_prob,
      over15_prob: m.over15_prob, over25_prob: m.over25_prob, btts_prob: m.btts_prob,
    }));

    const prompt = `You are an AI sports betting analysis engine. Analyze the following REAL football match odds data and generate betting slips.

REAL MATCH DATA (from live bookmaker odds):
${JSON.stringify(matchSummary, null, 2)}

INSTRUCTIONS:
1. Analyze ALL ${matchSummary.length} matches above. These are REAL matches with REAL odds.
2. For each match, assess confidence as LOW/MEDIUM/HIGH based on the probability margins.
3. Mark the strongest predictions as "is_core": true (pick 4-6 core picks).
4. Identify patterns like "Strong home favorite", "Defensive match", "High scoring expected" etc.
5. Generate ${slipCount + 1} betting slips:
   - Slip 1: DAILY_SAFE — ALL high-confidence picks (Double Chance, Over 1.5, safe markets). Most selections.
   - Slips 2-4: SAFE (Double Chance, Over 1.5, 3-5 matches, mostly CORE)
   - Slips 5-7: BALANCED (Win, Over 2.5, BTTS, 4-6 matches, mix of CORE + others)
   - Slips 8-${slipCount + 1}: HIGH_RISK (Correct Score, Underdog Win, Over 3.5, 2-4 matches)
6. Each selection MUST include "kickoff" and "league" from the data.
7. Budget: R${budget}, stake per slip: R${(budget / (slipCount + 1)).toFixed(0)}

Return valid JSON with this exact structure:
{
  "date": "${new Date().toISOString().split("T")[0]}",
  "matches": [
    {
      "id": 1, "home": "...", "away": "...", "league": "...", "kickoff": "...",
      "win_prob": 65, "draw_prob": 20, "lose_prob": 15,
      "over15_prob": 82, "over25_prob": 58, "btts_prob": 67,
      "confidence": "HIGH", "is_core": true,
      "pattern": "Strong home team, high scoring"
    }
  ],
  "core_picks": [
    { "match_id": 1, "market": "Home Win", "reason": "Strong home form" }
  ],
  "slips": [
    {
      "id": 1, "category": "DAILY_SAFE",
      "stake": ${(budget / (slipCount + 1)).toFixed(0)},
      "estimated_odds": 3.5, "potential_return": 35,
      "selections": [
        { "match_id": 1, "home": "...", "away": "...", "market": "Over 1.5 Goals", "probability": 82, "is_core": true, "kickoff": "15:00", "league": "Premier League" }
      ]
    }
  ],
  "bankroll": {
    "budget": ${budget}, "total_slips": ${slipCount + 1},
    "stake_per_slip": ${(budget / (slipCount + 1)).toFixed(0)}
  },
  "data_source": "live_odds_api"
}`;

    console.log("Sending to AI for analysis...");
    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a football betting analysis AI. You receive REAL match odds data and must generate intelligent betting slips. Return ONLY valid JSON, no markdown." },
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
    // Tag as live data
    slipData.data_source = "live_odds_api";
    slipData.matches_fetched = liveMatches.length;

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
