// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}


// Simple in-memory token cache to avoid re-authenticating on every request
let cachedToken = null;
let cachedAudience = null;
let tokenExpiry = 0;

const SANDBOX_AUDIENCE = "https://giftcards-sandbox.reloadly.com";
const LIVE_AUDIENCE = "https://giftcards.reloadly.com";

async function requestToken(clientId, clientSecret, audience) {
  const authResponse = await fetch("https://auth.reloadly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      audience,
    }),
  });

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    console.error(`Auth Error (${audience}):`, errorText);
    return null;
  }
  return await authResponse.json();
}

// Tries the preferred audience, then falls back to the other environment
// (Reloadly credentials are environment-specific: sandbox vs live).
async function getAccessToken(clientId, clientSecret, preferredAudience) {
  const now = Date.now();
  if (cachedToken && cachedAudience && now < tokenExpiry) {
    return { token: cachedToken, audience: cachedAudience };
  }

  const candidates = preferredAudience === LIVE_AUDIENCE
    ? [LIVE_AUDIENCE, SANDBOX_AUDIENCE]
    : [preferredAudience || SANDBOX_AUDIENCE, LIVE_AUDIENCE];

  for (const audience of candidates) {
    const authData = await requestToken(clientId, clientSecret, audience);
    if (authData?.access_token) {
      cachedToken = authData.access_token;
      cachedAudience = audience;
      tokenExpiry = now + ((authData.expires_in || 5000) - 60) * 1000;
      return { token: cachedToken, audience };
    }
  }

  throw new Error("Failed to authenticate with Reloadly");
}

const handler = async (req: Request): Promise<Response> => {
  console.log("reloadly-catalog function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const user = await requireUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {

    const env = Deno.env.toObject();
    const findEnv = (...cands: string[]) => {
      for (const c of cands) {
        const hit = Object.keys(env).find((k) => k.toLowerCase() === c.toLowerCase());
        if (hit && env[hit]) return env[hit];
      }
      return undefined;
    };

    const clientId = findEnv("RELOADLY_CLIENT_ID", "API_client_ID");
    const clientSecret = findEnv("RELOADLY_CLIENT_SECRET", "API_client_secret");

    if (!clientId || !clientSecret) {
      console.error("Available env keys:", Object.keys(env).join(","));
      throw new Error("Reloadly credentials not configured");
    }

    const audience = Deno.env.get("RELOADLY_AUDIENCE") || "https://giftcards-sandbox.reloadly.com";

    // Parse request body for pagination / search / filter params
    let page = 1;
    let size = 50;
    let productName = "";
    let countryCode = "";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        page = Math.max(1, parseInt(body.page) || 1);
        size = Math.min(200, Math.max(1, parseInt(body.size) || 50));
        productName = (body.productName || "").trim();
        countryCode = (body.countryCode || "").trim().toUpperCase();
      } catch (_) {
        // If body parsing fails, use defaults
      }
    }

    const { token: accessToken, audience: resolvedAudience } = await getAccessToken(clientId, clientSecret, audience);
    const baseUrl = resolvedAudience;

    // Build the Reloadly products URL with query params
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (productName) {
      params.set("productName", productName);
    }
    if (countryCode) {
      params.set("countryCode", countryCode);
    }

    const productsUrl = `${baseUrl}/products?${params.toString()}`;
    console.log("Fetching:", productsUrl);

    const productsResponse = await fetch(productsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/com.reloadly.giftcards-v1+json",
      },
    });

    if (!productsResponse.ok) {
      const errorText = await productsResponse.text();
      console.error("Products Error:", errorText);
      throw new Error("Failed to fetch products from Reloadly");
    }

    const productsData = await productsResponse.json();

    return new Response(JSON.stringify({ success: true, data: productsData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in reloadly-catalog:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
