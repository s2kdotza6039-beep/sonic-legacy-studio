// Shared auth helpers for edge functions that must restrict access.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface CallerInfo {
  userId: string | null;
  role: string | null; // claim "role" - e.g. "authenticated", "service_role", "anon"
}

/** Parse the Authorization header and return claims. Returns nulls if no/invalid token. */
export async function resolveCaller(req: Request): Promise<CallerInfo> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return { userId: null, role: null };
  const token = auth.replace("Bearer ", "");
  try {
    const u = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await u.auth.getClaims(token);
    const claims = data?.claims as Record<string, unknown> | undefined;
    return {
      userId: (claims?.sub as string) ?? null,
      role: (claims?.role as string) ?? null,
    };
  } catch {
    return { userId: null, role: null };
  }
}

/** True if the caller has the given role row in public.user_roles. */
export async function callerHasRole(userId: string | null, role: string): Promise<boolean> {
  if (!userId) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", role).maybeSingle();
  return !!data;
}

/** Guard: founder-only. Returns a Response on failure, or null to proceed. */
export async function requireFounder(req: Request): Promise<Response | null> {
  const caller = await resolveCaller(req);
  if (caller.role === "service_role") return null; // server-to-server allowed
  if (await callerHasRole(caller.userId, "founder")) return null;
  return new Response(
    JSON.stringify({ error: "forbidden: founder role required" }),
    { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
}

/** Guard: service-role only. */
export async function requireServiceRole(req: Request): Promise<Response | null> {
  const caller = await resolveCaller(req);
  if (caller.role === "service_role") return null;
  return new Response(
    JSON.stringify({ error: "forbidden: service role required" }),
    { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
}

/** Guard: founder OR service role. */
export async function requireFounderOrService(req: Request): Promise<Response | null> {
  const caller = await resolveCaller(req);
  if (caller.role === "service_role") return null;
  if (await callerHasRole(caller.userId, "founder")) return null;
  return new Response(
    JSON.stringify({ error: "forbidden" }),
    { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
}
