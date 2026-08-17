// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticate } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    // Auth is optional — we generate details regardless

    const { productName, category } = await req.json();

    const safe = (v: unknown, max = 200) =>
      String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, max);
    const safeName = safe(productName, 200);
    const safeCategory = safe(category, 100);

    if (!safeName || !safeCategory) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    if (!apiKey) {
      // Return sensible defaults when no AI key is configured
      const fallback = {
        description: `Discover our ${safeName} from the ${safeCategory} collection. Crafted with quality materials and attention to detail, this piece combines style with everyday comfort.`,
        sizes: safeCategory.toLowerCase().includes("shoe") ? "38, 39, 40, 41, 42, 43, 44" : "S, M, L, XL",
        features: "• Premium quality materials\n• Comfortable everyday wear\n• Modern and stylish design\n• Easy care and maintenance",
        materials_info: "Composition: High-quality blend\nCare: Follow label instructions",
        size_fit_info: "Fit: True to size. Please refer to our size guide for best results.",
      };
      return new Response(
        JSON.stringify(fallback),
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
            content: `You are a professional e-commerce product detail generator. Given a product name and category, generate the following product details. Output strictly as a JSON object with the following keys:
- description: A short, engaging product description (50-100 words).
- sizes: A comma-separated string of typical sizes for this type of product (e.g., "S, M, L, XL"). If not applicable, return an empty string.
- features: A string with 3-4 bullet points highlighting key features, with each point separated by a newline character.
- materials_info: A short description of typical materials and care instructions (e.g., "Composition: 100% Cotton\\nMachine wash cold").
- size_fit_info: A short sentence on size and fit (e.g., "Fit: true to size.").

Ensure the response is ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Product Name: ${safeName}\nCategory: ${safeCategory}`,
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
    let content = data.choices?.[0]?.message?.content || "";
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI JSON response:", content);
      throw new Error("Invalid response format from AI");
    }

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-generate-product-details:", error);
    // Return fallback details instead of error so the frontend always gets usable data
    const fallback = {
      description: "A stylish and high-quality product crafted with care. Perfect for adding to your wardrobe collection.",
      sizes: "S, M, L, XL",
      features: "• Premium quality materials\n• Comfortable everyday wear\n• Modern and stylish design\n• Easy care and maintenance",
      materials_info: "Composition: High-quality blend\nCare: Follow label instructions",
      size_fit_info: "Fit: True to size. Please refer to our size guide for best results.",
    };
    return new Response(
      JSON.stringify(fallback),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
