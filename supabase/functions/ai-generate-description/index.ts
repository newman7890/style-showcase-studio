import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticate, hasRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin-only endpoint — protect AI quota and prevent prompt-injection abuse.
    const auth = await authenticate(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!(await hasRole(auth.userId, "admin"))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { productName, category, price } = await req.json();

    // Basic input validation/sanitization to prevent prompt injection.
    const safe = (v: unknown, max = 200) =>
      String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, max);
    const safeName = safe(productName, 200);
    const safeCategory = safe(category, 100);
    const safePrice = Number(price);
    if (!safeName || !safeCategory || !Number.isFinite(safePrice)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
            content: `You are a professional e-commerce copywriter. Generate engaging, persuasive product descriptions for a fashion store.

Guidelines:
- Keep descriptions between 50-100 words
- Highlight key features and benefits
- Use sensory and emotional language
- Include relevant keywords for SEO
- Be authentic and avoid clichés
- Focus on quality, style, and comfort`,
          },
          {
            role: "user",
            content: `Write a compelling product description for:
Product Name: ${safeName}
Category: ${safeCategory}
Price: GH₵${safePrice}

Generate ONLY the description text, no titles or headers.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ description: description.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-generate-description:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
