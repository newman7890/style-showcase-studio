// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticate } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Intelligent dynamic fallback generator that detects Category, Department, Price and details
function generateSmartFallback(name: string, category: string) {
  const safeName = name || "Product";
  const safeCategory = category || "";
  const lowerName = safeName.toLowerCase();
  const lowerCat = safeCategory.toLowerCase();

  let detectedCategory = safeCategory || "Fashion";
  let detectedDepartment = "fashion";
  let estimatedPrice = "250";
  let sizes = "S, M, L, XL";
  let materials = "Composition: Premium fabric blend\nCare: Hand wash or machine wash cold";
  let fit = "Fit: Standard true-to-size fit. Choose your normal size.";
  let features = [
    `• High quality crafting and design for ${safeName}`,
    "• Durable and long-lasting construction",
    "• Versatile style for any occasion",
    "• Easy maintenance and care"
  ];

  if (lowerCat.includes("shoe") || lowerCat.includes("footwear") || lowerName.includes("sneaker") || lowerName.includes("boot") || lowerName.includes("shoe") || lowerName.includes("slipper") || lowerName.includes("runner") || lowerName.includes("kick")) {
    detectedCategory = "Shoes & Sneakers";
    detectedDepartment = "fashion";
    estimatedPrice = lowerName.includes("leather") || lowerName.includes("boot") ? "450" : "320";
    sizes = "39, 40, 41, 42, 43, 44, 45";
    materials = "Upper: Premium Leather / Breathable Mesh\nSole: Durable anti-slip rubber";
    fit = "Fit: Comfortable ergonomic fit. Order your standard shoe size.";
    features = [
      `• Cushioned insole for all-day walking comfort`,
      `• Non-slip rubber outsole for traction`,
      `• Stylish ${safeName} silhouette`,
      `• Reinforced stitching for extra durability`
    ];
  } else if (lowerCat.includes("gadget") || lowerCat.includes("tech") || lowerCat.includes("audio") || lowerName.includes("phone") || lowerName.includes("headphone") || lowerName.includes("earbud") || lowerName.includes("watch") || lowerName.includes("charger") || lowerName.includes("laptop") || lowerName.includes("speaker")) {
    detectedCategory = lowerName.includes("headphone") || lowerName.includes("earbud") || lowerName.includes("speaker") ? "Audio & Headphones" : lowerName.includes("watch") ? "Wearables" : "Gadgets & Tech";
    detectedDepartment = "gadgets";
    estimatedPrice = lowerName.includes("phone") || lowerName.includes("laptop") ? "2800" : lowerName.includes("watch") ? "650" : "350";
    sizes = "Standard";
    materials = "Material: Anodized Aluminum / High-grade Polymer\nIncludes: Product, Charging Cable, User Manual";
    fit = "Universal compatibility with iOS, Android, and Bluetooth devices.";
    features = [
      `• High-performance technology built into ${safeName}`,
      "• Long-lasting battery life & quick charging",
      "• Sleek ergonomic design for portable use",
      "• 1-Year warranty included"
    ];
  } else if (lowerCat.includes("art") || lowerCat.includes("home") || lowerName.includes("painting") || lowerName.includes("decor") || lowerName.includes("sculpture") || lowerName.includes("canvas") || lowerName.includes("print")) {
    detectedCategory = lowerName.includes("painting") || lowerName.includes("canvas") ? "Paintings" : lowerName.includes("sculpture") ? "Sculptures" : "Art & Collectibles";
    detectedDepartment = lowerCat.includes("home") ? "home" : "art";
    estimatedPrice = lowerName.includes("sculpture") ? "750" : "500";
    sizes = "One Size";
    materials = "Craftsmanship: Hand-selected premium materials\nOrigin: Artisanal craftsmanship";
    fit = "Designed to enhance any living space, gallery or office.";
    features = [
      `• Unique artistic creation: ${safeName}`,
      "• Handcrafted with exquisite detail",
      "• Protective finish for color longevity",
      "• Perfect centerpiece for modern spaces"
    ];
  } else if (lowerName.includes("bag") || lowerName.includes("backpack") || lowerName.includes("wallet") || lowerName.includes("purse") || lowerName.includes("tote")) {
    detectedCategory = "Bags & Accessories";
    detectedDepartment = "fashion";
    estimatedPrice = lowerName.includes("leather") ? "380" : "220";
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
    detectedCategory = "Women's Clothing";
    detectedDepartment = "fashion";
    estimatedPrice = "280";
    sizes = "XS, S, M, L, XL";
    materials = "Fabric: Premium Cotton / Silk blend\nCare: Gentle cycle or dry clean recommended";
    fit = "Fit: Flattering tailored fit. Fits true to size.";
    features = [
      `• Elegant silhouette featuring ${safeName}`,
      "• Breathable, premium soft fabric",
      "• Designed for comfort and grace",
      "• Vibrant color retention"
    ];
  } else if (lowerName.includes("shirt") || lowerName.includes("pant") || lowerName.includes("suit") || lowerName.includes("jacket") || lowerName.includes("hoodie") || lowerName.includes("trouser")) {
    detectedCategory = "Men's Clothing";
    detectedDepartment = "fashion";
    estimatedPrice = lowerName.includes("suit") || lowerName.includes("jacket") ? "550" : "180";
    sizes = "S, M, L, XL, XXL";
    materials = "Fabric: 100% Breathable Premium Cotton Blend\nCare: Machine wash cold with like colors";
    fit = "Fit: Modern tailored fit.";
    features = [
      `• Premium tailored finish for ${safeName}`,
      "• Soft-touch, breathable fabric blend",
      "• Reinforced seams for long-term wear",
      "• Easy care & wrinkle resistant"
    ];
  }

  // Dynamic, non-repetitive descriptions
  const hash = safeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const descriptors = [
    `Experience ultimate comfort and style with the ${safeName}. Designed for everyday versatility in the ${detectedCategory} range, it combines high-grade materials with contemporary design.`,
    `The ${safeName} brings together sophisticated style and practical functionality. Expertly crafted for our ${detectedCategory} collection, offering outstanding durability and effortless elegance.`,
    `Elevate your look with ${safeName}. Featuring superior craftsmanship and a modern finish, this item in our ${detectedCategory} collection is built for longevity and supreme comfort.`,
    `Discover the beauty of ${safeName}. Designed with premium detailing and an ergonomic finish, it is the ideal choice to elevate your ${detectedCategory} selection.`
  ];

  const description = descriptors[hash % descriptors.length];

  return {
    name: safeName,
    category: detectedCategory,
    department: detectedDepartment,
    price: estimatedPrice,
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

    const systemPrompt = `You are an expert e-commerce product visual analyst & copywriter.
Examine the product photo and inputs to detect the item type, brand style, category, realistic price, and full specs.

Output MUST be a single valid JSON object with the following exact keys:
- name: A specific, attractive product title. If name is provided ("${safeName}"), refine it or use it. If name is empty, generate a descriptive name based on what you see in the photo (e.g., "Men's Navy Blue Leather Biker Jacket").
- category: Detect the exact product category (e.g., "Men's Clothing", "Women's Clothing", "Shoes & Sneakers", "Bags & Accessories", "Audio & Headphones", "Gadgets & Tech", "Paintings", "Home & Living").
- department: Choose exactly one of these 5 department keys: "fashion", "gadgets", "art", "home", or "other".
- price: A realistic estimated retail price string in GH₵ (Ghana Cedi) without currency symbol (e.g., "180", "250", "450", "1200", "85").
- description: An engaging, detailed product description (60-120 words). Specifically describe the color, texture, cut, style, and visual features shown in the photo.
- sizes: Comma-separated typical sizes (e.g., "S, M, L, XL" for apparel, "39, 40, 41, 42, 43, 44" for shoes, or "One Size" for accessories/gadgets).
- features: 4 bullet points highlighting key visual/functional features from the photo, separated by newlines (e.g. "• Feature 1\n• Feature 2").
- materials_info: Material composition and care instructions matching the product (e.g. "Material: 100% Genuine Leather\nCare: Wipe clean with soft dry cloth").
- size_fit_info: Concise fit guidance (e.g. "Fit: Slim fit. True to size.").

Respond ONLY with valid JSON. No markdown backticks.`;

    let userContent = [];
    let promptText = `Product Name Input: ${safeName || "Detect from photo"}\nCategory Input: ${safeCategory || "Detect from photo"}`;

    if (imageUrl && (imageUrl.startsWith("http") || imageUrl.startsWith("data:image"))) {
      promptText += `\n\nIMPORTANT: Analyze the attached product photo carefully. Visually identify the product name, exact category, department, realistic price in GH₵, color, fabric/material texture, and style. Write detailed description and specs specifically matching what is visible in this photo.`;
      
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
