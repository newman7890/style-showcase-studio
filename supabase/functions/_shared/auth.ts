import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export interface AuthContext {
  userId: string;
  token: string;
  client: SupabaseClient;
}

/**
 * Validate the caller's JWT and return an authed context.
 * Returns null if the request is not authenticated.
 */
export async function authenticate(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return { userId: data.user.id, token, client };
  } catch {
    return null;
  }
}

/** Returns true if the user has the requested role. */
export async function hasRole(userId: string, role: "admin" | "rider" | "user"): Promise<boolean> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return !error && !!data;
}

/** Check if Authorization header matches the service role key (for trusted server-to-server calls). */
export function isServiceRoleCall(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "").trim();
  return !!token && token === SERVICE_ROLE_KEY;
}

/** Escape user-supplied values for safe HTML interpolation. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
