import { requireFounderOrService } from "../_shared/authGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SPORT_KEYS = [
  "soccer_epl", "soccer_spain_la_liga", "soccer_italy_serie_a",
  "soccer_germany_bundesliga", "soccer_france_ligue_one",
  "soccer_uefa_champs_league", "soccer_uefa_europa_league", "soccer_uefa_europa_conference_league",
  "soccer_efl_champ", "soccer_england_league1", "soccer_england_league2",
  "soccer_fa_cup", "soccer_england_efl_cup",
  "soccer_spain_segunda_division", "soccer_italy_serie_b",
  "soccer_netherlands_eredivisie", "soccer_portugal_primeira_liga",
  "soccer_turkey_super_league", "soccer_belgium_first_div",
  "soccer_switzerland_superleague", "soccer_austria_bundesliga",
  "soccer_denmark_superliga", "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien", "soccer_finland_veikkausliiga",
  "soccer_greece_super_league", "soccer_poland_ekstraklasa",
  "soccer_league_of_ireland",
  "soccer_fifa_world_cup", "soccer_uefa_european_championship",
  "soccer_conmebol_copa_libertadores", "soccer_africa_cup_of_nations",
  "soccer_concacaf_gold_cup", "soccer_concacaf_leagues_cup",
  "soccer_usa_mls", "soccer_argentina_primera_division",
  "soccer_brazil_campeonato", "soccer_brazil_serie_b",
  "soccer_australia_aleague", "soccer_china_superleague",
  "soccer_japan_j_league", "soccer_korea_kleague1",
];

const LEAGUE_NAMES: Record<string, string> = {
  soccer_epl: "Premier League", soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A", soccer_germany_bundesliga: "Bundesliga",
  soccer_france_ligue_one: "Ligue 1", soccer_uefa_champs_league: "Champions League",
  soccer_uefa_europa_league: "Europa League", soccer_uefa_europa_conference_league: "Conference League",
  soccer_efl_champ: "Championship", soccer_england_league1: "League One",
  soccer_england_league2: "League Two", soccer_fa_cup: "FA Cup",
  soccer_england_efl_cup: "EFL Cup", soccer_spain_segunda_division: "La Liga 2",
  soccer_italy_serie_b: "Serie B", soccer_netherlands_eredivisie: "Eredivisie",
  soccer_portugal_primeira_liga: "Primeira Liga", soccer_turkey_super_league: "Süper Lig",
  soccer_belgium_first_div: "Belgian Pro League", soccer_switzerland_superleague: "Swiss Super League",
  soccer_austria_bundesliga: "Austrian Bundesliga", soccer_denmark_superliga: "Danish Superliga",
  soccer_sweden_allsvenskan: "Allsvenskan", soccer_norway_eliteserien: "Eliteserien",
  soccer_finland_veikkausliiga: "Veikkausliiga", soccer_greece_super_league: "Super League Greece",
  soccer_poland_ekstraklasa: "Ekstraklasa", soccer_league_of_ireland: "League of Ireland",
  soccer_fifa_world_cup: "FIFA World Cup", soccer_uefa_european_championship: "UEFA Euro",
  soccer_conmebol_copa_libertadores: "Copa Libertadores", soccer_africa_cup_of_nations: "Africa Cup of Nations",
  soccer_concacaf_gold_cup: "CONCACAF Gold Cup", soccer_concacaf_leagues_cup: "Leagues Cup",
  soccer_usa_mls: "MLS", soccer_argentina_primera_division: "Argentine Primera",
  soccer_brazil_campeonato: "Brasileirão Série A", soccer_brazil_serie_b: "Brasileirão Série B",
  soccer_australia_aleague: "A-League", soccer_china_superleague: "Chinese Super League",
  soccer_japan_j_league: "J-League", soccer_korea_kleague1: "K-League 1",
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

interface OddsResult {
  events: LiveMatch[];
  quota_used: number;
  quota_remaining: number;
}

async function fetchLiveOdds(apiKey: string): Promise<OddsResult> {
  const allEvents: LiveMatch[] = [];
  const markets = "h2h,totals";
  let quotaUsed = 0;
  let quotaRemaining = 0;

  const results = await Promise.allSettled(
    SPORT_KEYS.map(async (sportKey) => {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=uk&markets=${markets}&oddsFormat=decimal`;
      const response = await fetch(url);
      if (!response.ok) { console.warn(`Odds API ${sportKey}: ${response.status}`); return { events: [], sportKey }; }
      const remaining = response.headers.get("x-requests-remaining");
      const used = response.headers.get("x-requests-used");
      if (remaining) quotaRemaining = Math.min(quotaRemaining || Infinity, parseInt(remaining));
      if (used) quotaUsed = Math.max(quotaUsed, parseInt(used));
      const events = await response.json();
      return { events: events.map((e: any) => ({ ...e, _sportKey: sportKey })), sportKey };
    })
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { events: fetchedEvents } = result.value;
    for (const event of fetchedEvents) {
      if (!event.bookmakers?.length) continue;
      const sportKey = event._sportKey;

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
        id: event.id, home: event.home_team, away: event.away_team,
        league: LEAGUE_NAMES[sportKey] || sportKey,
        kickoff: kickoffStr, commence_time: event.commence_time,
        home_odds: parseFloat(homeOdds.toFixed(2)),
        draw_odds: parseFloat(drawOdds.toFixed(2)),
        away_odds: parseFloat(awayOdds.toFixed(2)),
        win_prob: winProb, draw_prob: drawProb, lose_prob: loseProb,
        over15_prob: over15Prob, over25_prob: over25Prob, btts_prob: bttsProb,
      });
    }
  }

  allEvents.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
  return { events: allEvents, quota_used: quotaUsed, quota_remaining: quotaRemaining };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ODDS_API_KEY = Deno.env.get("THE_ODDS_API_KEY");
    if (!ODDS_API_KEY) throw new Error("THE_ODDS_API_KEY is not configured");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const budget = body.budget || 100;
    const slipCount = body.slipCount || 8;
    const minConfidence = body.minConfidence ?? 60;

    // Step 1: Fetch REAL live odds
    console.log("Fetching live odds...");
    const oddsResult = await fetchLiveOdds(ODDS_API_KEY);
    const totalFetched = oddsResult.events.length;
    console.log(`Fetched ${totalFetched} live matches (quota: ${oddsResult.quota_used} used, ${oddsResult.quota_remaining} remaining)`);

    if (totalFetched === 0) {
      return new Response(
        JSON.stringify({ error: "No upcoming matches found. Try again closer to match day.", quota: { used: oddsResult.quota_used, remaining: oddsResult.quota_remaining } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Select top 20 matches by clearest favorites
    const topMatches = [...oddsResult.events]
      .sort((a, b) => Math.max(b.win_prob, b.lose_prob) - Math.max(a.win_prob, a.lose_prob))
      .slice(0, 20);

    // Build numbered match list for AI — these are the ONLY matches that exist
    const numberedMatches = topMatches.map((m, i) => ({
      id: i + 1,
      home: m.home, away: m.away, league: m.league, kickoff: m.kickoff,
      home_odds: m.home_odds, draw_odds: m.draw_odds, away_odds: m.away_odds,
      win_prob: m.win_prob, draw_prob: m.draw_prob, lose_prob: m.lose_prob,
      over15_prob: m.over15_prob, over25_prob: m.over25_prob, btts_prob: m.btts_prob,
    }));

    // Step 2: Ask AI to ONLY analyze these matches — not invent new ones
    const prompt = `You are an AI sports betting analysis engine. Below are the ONLY real matches available today. You MUST NOT invent, add, or modify any match. Every match_id you reference MUST be from the list below.

MATCH LIST (IDs 1–${numberedMatches.length}):
${JSON.stringify(numberedMatches, null, 2)}

TASKS:
1. For each match above, output an "analysis" entry with:
   - "id" (must match exactly from the list)
   - "confidence": "LOW" | "MEDIUM" | "HIGH"
   - "confidence_score": 0–100
   - "is_core": true/false (pick 4–6 strongest)
   - "pattern": short description e.g. "Strong home favorite"

2. Output "core_picks": array of { "match_id", "market", "reason" }. Only IDs from the list.

3. Generate ${slipCount + 1} betting slips. Each slip has:
   - "id", "category" (DAILY_SAFE | SAFE | BALANCED | HIGH_RISK)
   - "stake": ${(budget / (slipCount + 1)).toFixed(0)}
   - "estimated_odds", "potential_return"
   - "selections": array of { "match_id", "market", "probability", "is_core" }
   
   Slip rules:
   - Slip 1: DAILY_SAFE — all high-confidence picks, safe markets
   - Slips 2–4: SAFE (Double Chance, Over 1.5, 3–5 matches)
   - Slips 5–7: BALANCED (Win, Over 2.5, BTTS, 4–6 matches)
   - Slips 8+: HIGH_RISK (Correct Score, Underdog, Over 3.5, 2–4 matches)
   - Only use matches with confidence_score >= ${minConfidence}

CRITICAL: Every match_id in core_picks and selections MUST be a valid ID (1–${numberedMatches.length}) from the list above. Do NOT create any new matches.

Return ONLY this JSON:
{
  "analysis": [ { "id": 1, "confidence": "HIGH", "confidence_score": 85, "is_core": true, "pattern": "..." } ],
  "core_picks": [ { "match_id": 1, "market": "Home Win", "reason": "..." } ],
  "slips": [ { "id": 1, "category": "DAILY_SAFE", "stake": ${(budget / (slipCount + 1)).toFixed(0)}, "estimated_odds": 3.5, "potential_return": 35, "selections": [ { "match_id": 1, "market": "Over 1.5 Goals", "probability": 82, "is_core": true } ] } ]
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
          { role: "system", content: "You are a football betting analysis AI. You receive REAL match data and must analyze it. You MUST NOT invent or fabricate any matches. Only reference match IDs from the provided list. Return ONLY valid JSON, no markdown." },
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
    if (!content) throw new Error("No content in AI response");

    const aiResult = JSON.parse(content);

    // Step 3: MERGE — build final matches from REAL data + AI analysis
    // The AI cannot change team names, leagues, kickoffs, or odds
    const analysisMap = new Map<number, any>();
    for (const a of (aiResult.analysis || [])) {
      if (a.id >= 1 && a.id <= numberedMatches.length) {
        analysisMap.set(a.id, a);
      }
    }

    const finalMatches = numberedMatches.map((m) => {
      const ai = analysisMap.get(m.id) || {};
      return {
        ...m,
        confidence: ai.confidence || "MEDIUM",
        confidence_score: typeof ai.confidence_score === "number" ? ai.confidence_score : 50,
        is_core: ai.is_core || false,
        pattern: ai.pattern || "",
      };
    });

    // Validate core_picks — strip any with invalid match_id
    const validIds = new Set(numberedMatches.map((m) => m.id));
    const corePicks = (aiResult.core_picks || []).filter((cp: any) => validIds.has(cp.match_id));

    // Validate slips — strip any selection with invalid match_id, and enrich with real match data
    const finalSlips = (aiResult.slips || []).map((slip: any) => {
      const validSelections = (slip.selections || [])
        .filter((sel: any) => validIds.has(sel.match_id))
        .map((sel: any) => {
          const realMatch = numberedMatches.find((m) => m.id === sel.match_id)!;
          return {
            ...sel,
            home: realMatch.home,
            away: realMatch.away,
            kickoff: realMatch.kickoff,
            league: realMatch.league,
          };
        });
      return { ...slip, selections: validSelections };
    });

    const result = {
      date: new Date().toISOString().split("T")[0],
      matches: finalMatches,
      core_picks: corePicks,
      slips: finalSlips,
      bankroll: {
        budget,
        total_slips: slipCount + 1,
        stake_per_slip: Math.round(budget / (slipCount + 1)),
      },
      data_source: "live_odds_api",
      matches_fetched: totalFetched,
      quota: { used: oddsResult.quota_used, remaining: oddsResult.quota_remaining },
    };

    return new Response(JSON.stringify(result), {
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
