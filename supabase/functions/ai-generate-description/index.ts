import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticate, hasRole } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const userClientId = getClientIdentifier(req, auth.userId);
    const userCheck = await checkGlobalRateLimitAsync(auth.client, "ai-generate-desc", userClientId, { maxRequests: 30, windowMs: 10 * 60 * 1000 });
    if (!userCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded for description generator. Please wait a moment." }),
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

    const { productName, category, price, imageUrl } = await req.json().catch(() => ({}));

    const safe = (v: unknown, max = 200) =>
      String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, max);
    const safeName = safe(productName, 200);
    const safeCategory = safe(category, 100);
    const safePrice = Number(price);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    if (!apiKey) {
      // Dynamic fallback description
      const desc = `Discover the ${safeName || "new arrival"} from our ${safeCategory || "Store"} collection. Crafted with exceptional quality, modern styling, and comfort for everyday wear.`;
      return new Response(
        JSON.stringify({ description: desc }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiEndpoint = OPENAI_API_KEY 
      ? "https://api.openai.com/v1/chat/completions" 
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = OPENAI_API_KEY ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    const systemPrompt = `You are a professional e-commerce product copywriter.
Generate engaging, persuasive product descriptions based on product information and visual features from the photo if provided.

Guidelines:
- Keep descriptions between 50-100 words
- Specifically describe visual features (color, cut, texture, style) seen in the product image
- Highlight quality, comfort, and craftsmanship
- Return ONLY the description text, no titles or headers.`;

    let userContent = [];
    let textPrompt = `Write a compelling product description for:
Product Name: ${safeName || "Product"}
Category: ${safeCategory || "General"}
${Number.isFinite(safePrice) ? `Price: GH₵${safePrice}` : ""}`;

    if (imageUrl && (imageUrl.startsWith("http") || imageUrl.startsWith("data:image"))) {
      textPrompt += `\n\nAnalyze the attached product image carefully and describe what you visually observe in the photo.`;
      userContent = [
        { type: "text", text: textPrompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ];
    } else {
      userContent = textPrompt;
    }

    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      const desc = `Discover the ${safeName || "new arrival"} from our ${safeCategory || "Store"} collection. Crafted with exceptional quality, modern styling, and comfort for everyday wear.`;
      return new Response(
        JSON.stringify({ description: desc }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
