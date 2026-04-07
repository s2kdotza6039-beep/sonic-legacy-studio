import { corsHeaders } from "@supabase/supabase-js/cors";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

// Soccer sport keys for major leagues
const SPORT_KEYS = [
  "soccer_epl",           // Premier League
  "soccer_spain_la_liga",  // La Liga
  "soccer_italy_serie_a",  // Serie A
  "soccer_germany_bundesliga", // Bundesliga
  "soccer_france_ligue_one",   // Ligue 1
  "soccer_uefa_champs_league", // Champions League
];

const LEAGUE_NAMES: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_france_ligue_one: "Ligue 1",
  soccer_uefa_champs_league: "Champions League",
};

interface OddsOutcome {
  name: string;
  price: number;
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  markets: OddsMarket[];
}

interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get("THE_ODDS_API_KEY");
    if (!API_KEY) {
      throw new Error("THE_ODDS_API_KEY is not configured");
    }

    const body = await req.json().catch(() => ({}));
    const requestedLeagues: string[] = body.leagues || SPORT_KEYS;
    const markets = "h2h,totals,btts"; // head-to-head, over/under, both teams to score

    const allEvents: any[] = [];
    let quotaUsed = 0;
    let quotaRemaining = 0;

    // Fetch odds for each league
    for (const sportKey of requestedLeagues) {
      try {
        const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${API_KEY}&regions=uk,eu&markets=${markets}&oddsFormat=decimal`;
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`Failed to fetch ${sportKey}: ${response.status}`);
          continue;
        }

        // Track quota
        const remaining = response.headers.get("x-requests-remaining");
        const used = response.headers.get("x-requests-used");
        if (remaining) quotaRemaining = parseInt(remaining);
        if (used) quotaUsed = parseInt(used);

        const events: OddsEvent[] = await response.json();

        for (const event of events) {
          if (!event.bookmakers?.length) continue;

          // Average odds across bookmakers for h2h
          const h2hMarkets = event.bookmakers
            .map((b) => b.markets.find((m) => m.key === "h2h"))
            .filter(Boolean) as OddsMarket[];

          const totalsMarkets = event.bookmakers
            .map((b) => b.markets.find((m) => m.key === "totals"))
            .filter(Boolean) as OddsMarket[];

          // Calculate average h2h probabilities
          let homeOdds = 0, drawOdds = 0, awayOdds = 0, count = 0;
          for (const market of h2hMarkets) {
            const home = market.outcomes.find((o) => o.name === event.home_team);
            const draw = market.outcomes.find((o) => o.name === "Draw");
            const away = market.outcomes.find((o) => o.name === event.away_team);
            if (home && draw && away) {
              homeOdds += home.price;
              drawOdds += draw.price;
              awayOdds += away.price;
              count++;
            }
          }

          if (count === 0) continue;

          homeOdds /= count;
          drawOdds /= count;
          awayOdds /= count;

          // Convert decimal odds to implied probabilities
          const winProb = Math.round((1 / homeOdds) * 100);
          const drawProb = Math.round((1 / drawOdds) * 100);
          const loseProb = Math.round((1 / awayOdds) * 100);

          // Extract over/under data
          let over15Prob = 0, over25Prob = 0;
          for (const market of totalsMarkets) {
            const over25 = market.outcomes.find((o) => o.name === "Over" && o.price);
            if (over25) {
              over25Prob = Math.round((1 / over25.price) * 100);
              // Estimate over 1.5 as higher probability
              over15Prob = Math.min(95, over25Prob + 20);
            }
          }

          // Estimate BTTS probability from odds spread
          const bttsProb = Math.round(Math.min(winProb + loseProb, 80) * 0.7 + 15);

          const kickoff = new Date(event.commence_time);
          const kickoffStr = `${kickoff.getUTCHours().toString().padStart(2, "0")}:${kickoff.getUTCMinutes().toString().padStart(2, "0")}`;

          allEvents.push({
            id: event.id,
            home: event.home_team,
            away: event.away_team,
            league: LEAGUE_NAMES[event.sport_key] || event.sport_key,
            sport_key: event.sport_key,
            kickoff: kickoffStr,
            commence_time: event.commence_time,
            home_odds: parseFloat(homeOdds.toFixed(2)),
            draw_odds: parseFloat(drawOdds.toFixed(2)),
            away_odds: parseFloat(awayOdds.toFixed(2)),
            win_prob: winProb,
            draw_prob: drawProb,
            lose_prob: loseProb,
            over15_prob: over15Prob,
            over25_prob: over25Prob,
            btts_prob: bttsProb,
          });
        }
      } catch (err) {
        console.warn(`Error fetching ${sportKey}:`, err);
      }
    }

    // Sort by commence time
    allEvents.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());

    return new Response(
      JSON.stringify({
        events: allEvents,
        meta: {
          total: allEvents.length,
          quota_used: quotaUsed,
          quota_remaining: quotaRemaining,
          fetched_at: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error fetching odds:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
