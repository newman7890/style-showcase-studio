import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, SUPABASE_URL, ANON_KEY } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate Limiting by IP (30 queries per 10 minutes)
  const ipClientId = getClientIdentifier(req, null);
  const ipCheck = checkRateLimit("ai-product-search", ipClientId, { maxRequests: 30, windowMs: 10 * 60 * 1000 });
  if (!ipCheck.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit reached for AI search. Please wait a moment.", products: [] }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": ipCheck.resetInSec.toString(),
        },
      }
    );
  }

  try {
    // Require an authenticated user — protects AI quota from anonymous abuse.
    const auth = await authenticate(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate Limiting by User (20 queries per 10 minutes)
    const userClientId = getClientIdentifier(req, auth.userId);
    const userCheck = checkRateLimit("ai-product-search", userClientId, { maxRequests: 20, windowMs: 10 * 60 * 1000 });
    if (!userCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Search rate limit exceeded for your account. Please wait a moment.", products: [] }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": userCheck.resetInSec.toString(),
          },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawQuery = typeof body?.query === "string" ? body.query : "";
    // Sanitize and cap user-supplied prompt to mitigate prompt injection / abuse.
    const query = rawQuery.replace(/[\r\n]+/g, " ").trim().slice(0, 300);
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Invalid query", products: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    if (!apiKey) {
      throw new Error("Neither OPENAI_API_KEY nor LOVABLE_API_KEY is configured");
    }

    // Use anon key — products are publicly readable; service role is unnecessary.
    const supabase = createClient(SUPABASE_URL, ANON_KEY);

    // Fetch all in-stock products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, category, price, description, image, stock")
      .gt("stock", 0);

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiEndpoint = OPENAI_API_KEY 
      ? "https://api.openai.com/v1/chat/completions" 
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = OPENAI_API_KEY ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `You are a product search assistant. Given a user's natural language query and a list of products, return the IDs of products that best match the query.

Products:
${products.map(p => `ID: ${p.id} | Name: ${p.name} | Category: ${p.category} | Price: GH₵${p.price} | Description: ${p.description || 'No description'}`).join('\n')}

Return ONLY a JSON array of product IDs that match the query, ordered by relevance. Maximum 6 products. Example: ["id1", "id2", "id3"]
If no products match, return an empty array: []`,
          },
          {
            role: "user",
            content: query,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", products: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const matchedIds: string[] = JSON.parse(jsonMatch[0]);
    const matchedProducts = matchedIds
      .map(id => products.find(p => p.id === id))
      .filter(Boolean);

    return new Response(
      JSON.stringify({ products: matchedProducts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-product-search:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", products: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
