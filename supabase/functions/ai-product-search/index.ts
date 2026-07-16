import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, SUPABASE_URL, ANON_KEY } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
