import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, SUPABASE_URL, ANON_KEY } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Globally Synchronized Rate Limiting by User (20 queries per 10 minutes)
    const userClientId = getClientIdentifier(req, auth.userId);
    const userCheck = await checkGlobalRateLimitAsync(auth.client, "ai-product-search", userClientId, { maxRequests: 20, windowMs: 10 * 60 * 1000 });
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    // Fallback search function using relevance scoring
    const fallbackSearch = () => {
      const tokens = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);
      const scored = products.map((p) => {
        let score = 0;
        const nameLower = (p.name || "").toLowerCase();
        const catLower = (p.category || "").toLowerCase();
        const descLower = (p.description || "").toLowerCase();

        for (const t of tokens) {
          if (nameLower.includes(t)) score += 5;
          if (catLower.includes(t)) score += 3;
          if (descLower.includes(t)) score += 1;
        }
        return { product: p, score };
      });

      const matched = scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((s) => s.product);

      return matched.length > 0 ? matched : products.slice(0, 6);
    };

    if (!apiKey) {
      const results = fallbackSearch();
      return new Response(
        JSON.stringify({ products: results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiEndpoint = OPENAI_API_KEY 
      ? "https://api.openai.com/v1/chat/completions" 
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = OPENAI_API_KEY ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    try {
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

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "[]";
        const jsonMatch = content.match(/\[.*\]/s);
        if (jsonMatch) {
          const matchedIds: string[] = JSON.parse(jsonMatch[0]);
          const matchedProducts = matchedIds
            .map(id => products.find(p => p.id === id))
            .filter(Boolean);

          return new Response(
            JSON.stringify({ products: matchedProducts }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (aiErr) {
      console.warn("AI search error, falling back to keyword search:", aiErr);
    }

    const results = fallbackSearch();
    return new Response(
      JSON.stringify({ products: results }),
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
