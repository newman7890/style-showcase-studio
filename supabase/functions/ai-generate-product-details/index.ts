// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticate } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Smart dynamic fallback generator when AI API key is not configured or fails
function generateSmartFallback(name: string, category: string) {
  const safeName = name || "Product";
  const safeCategory = category || "Fashion";
  const lowerName = safeName.toLowerCase();
  const lowerCat = safeCategory.toLowerCase();

  let sizes = "S, M, L, XL";
  let materials = "Composition: Premium fabric blend\nCare: Hand wash or machine wash cold";
  let fit = "Fit: Standard true-to-size fit. Choose your normal size.";
  let features = [
    `• High quality crafting and design for ${safeName}`,
    "• Durable and long-lasting construction",
    "• Versatile style for any occasion",
    "• Easy maintenance and care"
  ];

  if (lowerCat.includes("shoe") || lowerCat.includes("footwear") || lowerName.includes("sneaker") || lowerName.includes("boot") || lowerName.includes("shoe") || lowerName.includes("slipper")) {
    sizes = "38, 39, 40, 41, 42, 43, 44, 45";
    materials = "Upper: Premium Leather / Breathable Mesh\nSole: Durable anti-slip rubber";
    fit = "Fit: Comfortable ergonomic fit. Order your standard shoe size.";
    features = [
      `• Cushioned insole for all-day walking comfort`,
      `• Non-slip rubber outsole for traction`,
      `• Stylish ${safeName} silhouette`,
      `• Reinforced stitching for extra durability`
    ];
  } else if (lowerCat.includes("gadget") || lowerCat.includes("tech") || lowerCat.includes("audio") || lowerName.includes("phone") || lowerName.includes("headphone") || lowerName.includes("watch") || lowerName.includes("charger")) {
    sizes = "Standard";
    materials = "Material: Anodized Aluminum / High-grade Polymer\nIncludes: Product, Charging Cable, User Manual";
    fit = "Universal compatibility with iOS and Android devices.";
    features = [
      `• High-performance technology built into ${safeName}`,
      "• Long-lasting battery life & quick charging",
      "• Sleek ergonomic design for portable use",
      "• 1-Year manufacturer warranty included"
    ];
  } else if (lowerCat.includes("art") || lowerCat.includes("home") || lowerName.includes("painting") || lowerName.includes("decor") || lowerName.includes("sculpture")) {
    sizes = "One Size";
    materials = "Craftsmanship: Hand-selected premium materials\nOrigin: Artisanal craftsmanship";
    fit = "Designed to enhance any living space, gallery or office.";
    features = [
      `• Unique artistic creation: ${safeName}`,
      "• Handcrafted with exquisite detail",
      "• Protective finish for color longevity",
      "• Perfect centerpiece for modern spaces"
    ];
  } else if (lowerName.includes("bag") || lowerName.includes("backpack") || lowerName.includes("wallet") || lowerName.includes("purse")) {
    sizes = "One Size";
    materials = "Material: Water-resistant synthetic leather & durable lining\nCare: Wipe clean with damp cloth";
    fit = "Spacious interior with multiple organizational compartments.";
    features = [
      `• Multi-compartment storage for daily essentials`,
      "• Sturdy zips and reinforced shoulder straps",
      "• Elegant finish matching formal & casual wear",
      "• Lightweight yet heavy-duty design"
    ];
  } else if (lowerName.includes("dress") || lowerName.includes("gown") || lowerName.includes("skirt")) {
    sizes = "XS, S, M, L, XL";
    materials = "Fabric: Premium Cotton / Silk blend\nCare: Gentle cycle or dry clean recommended";
    fit = "Fit: Flattering tailored fit. Fits true to size.";
    features = [
      `• Elegant silhouette featuring ${safeName}`,
      "• Breathable, premium soft fabric",
      "• Designed for comfort and grace",
      "• Vibrant color retention"
    ];
  }

  // Generate dynamic, unique description to avoid duplicate text across products
  const hash = safeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const descriptors = [
    `Experience unparalleled elegance with the ${safeName}. Expertly designed for the ${safeCategory} collection, it combines premium materials with a modern aesthetic to elevate your lifestyle.`,
    `The ${safeName} brings together timeless style and modern function. Meticulously created for everyday wear in our ${safeCategory} range, offering outstanding comfort and durability.`,
    `Upgrade your look with ${safeName}. Crafted with superior attention to detail, this piece from our ${safeCategory} lineup delivers a refined look and lasting quality.`,
    `Discover the beauty of ${safeName}. Featuring a contemporary design, premium finish, and ergonomic comfort, it is the perfect addition to your ${safeCategory} collection.`
  ];

  const description = descriptors[hash % descriptors.length];

  return {
    name: safeName,
    description,
    sizes,
    features: features.join("\n"),
    materials_info: materials,
    size_fit_info: fit,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    // Auth is optional — generate details regardless

    const body = await req.json().catch(() => ({}));
    const { productName, category, imageUrl } = body;

    const safeName = String(productName ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
    const safeCategory = String(category ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 100);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    if (!apiKey) {
      const fallback = generateSmartFallback(safeName, safeCategory);
      return new Response(
        JSON.stringify(fallback),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiEndpoint = OPENAI_API_KEY 
      ? "https://api.openai.com/v1/chat/completions" 
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = OPENAI_API_KEY ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    const systemPrompt = `You are an expert e-commerce product analyst & copywriter.
Analyze the product information and image (if provided) to generate specific, realistic product details.

Output MUST be a single valid JSON object with the following exact fields:
- name: A clear, attractive product name. If a name is already provided ("${safeName}"), refine it or use it. If empty or generic, generate a specific title based on what you visually observe in the photo.
- description: An engaging, detailed product description (60-120 words). Focus specifically on the visual features, color tones, materials, cut, and style shown in the image or described by the user.
- sizes: Comma-separated sizes appropriate for this item (e.g., "S, M, L, XL" for apparel, "38, 39, 40, 41, 42, 43, 44" for footwear, or "One Size" for accessories/gadgets).
- features: 4 bullet points highlighting key features observed in the product photo or specs, separated by newlines (e.g. "• Feature 1\n• Feature 2").
- materials_info: Material composition and care instructions matching the product type (e.g. "Material: 100% Genuine Leather\nCare: Wipe clean with soft dry cloth").
- size_fit_info: Concise fit and sizing guidance (e.g. "Fit: Slim fit. Fits true to size.").

Respond ONLY with raw JSON, no markdown formatting or backticks.`;

    let userContent = [];
    let promptText = `Product Name: ${safeName || "Unspecified"}\nCategory: ${safeCategory || "General"}`;

    if (imageUrl && (imageUrl.startsWith("http") || imageUrl.startsWith("data:image"))) {
      promptText += `\n\nIMPORTANT: Examine the attached product photo carefully. Identify the exact item, color, material texture, style, and visual features. Write the description and features specifically based on what you visually see in this image.`;
      
      userContent = [
        { type: "text", text: promptText },
        { type: "image_url", image_url: { url: imageUrl } }
      ];
    } else {
      userContent = promptText;
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
      const fallback = generateSmartFallback(safeName, safeCategory);
      return new Response(
        JSON.stringify(fallback),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response JSON:", content);
      parsedContent = generateSmartFallback(safeName, safeCategory);
    }

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-generate-product-details:", error);
    const fallback = generateSmartFallback("Product", "General");
    return new Response(
      JSON.stringify(fallback),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
