import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, hasRole, SUPABASE_URL, SERVICE_ROLE_KEY } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await authenticate(req);
    if (!ctx) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = await hasRole(ctx.userId, "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate Limiting (10 delete attempts per 10 minutes)
    const clientId = getClientIdentifier(req, ctx.userId);
    const rateCheck = await checkGlobalRateLimitAsync(ctx.client, "admin-delete-user", clientId, { maxRequests: 10, windowMs: 10 * 60 * 1000 });
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Too many delete requests. Please wait." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": rateCheck.resetInSec.toString() },
      });
    }

    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === ctx.userId) {
      return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Clean up rows that may not cascade automatically.
    await admin.from("user_roles").delete().eq("user_id", user_id);
    await admin.from("seller_profiles").delete().eq("user_id", user_id);
    await admin.from("profiles").delete().eq("id", user_id);

    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
