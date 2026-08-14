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
let tokenExpiry = 0;

async function getAccessToken(clientId, clientSecret, audience) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const authResponse = await fetch("https://auth.reloadly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      audience: audience,
    }),
  });

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    console.error("Auth Error:", errorText);
    throw new Error("Failed to authenticate with Reloadly");
  }

  const authData = await authResponse.json();
  cachedToken = authData.access_token;
  // Cache for slightly less than the token lifetime (default ~5000s)
  tokenExpiry = now + ((authData.expires_in || 5000) - 60) * 1000;
  return cachedToken;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("reloadly-catalog function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("RELOADLY_CLIENT_ID");
    const clientSecret = Deno.env.get("RELOADLY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
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

    const accessToken = await getAccessToken(clientId, clientSecret, audience);
    const baseUrl = audience;

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
