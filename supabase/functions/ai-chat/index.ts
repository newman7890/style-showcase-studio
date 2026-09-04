import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, SERVICE_ROLE_KEY, SUPABASE_URL, ANON_KEY } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

const MAX_MESSAGES = 15;
const MAX_CONTENT_LENGTH = 1000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const cleaned: ChatMessage[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.slice(0, MAX_CONTENT_LENGTH);
    if (!trimmed.trim()) continue;
    cleaned.push({ role, content: trimmed });
  }
  return cleaned.slice(-MAX_MESSAGES);
}

function generateHumanResponse(lastMsg: string, userOrdersContext: string, productsListText: string, isLoggedIn: boolean): string {
  const msg = lastMsg.toLowerCase().trim();

  // Greetings & "How are you"
  if (
    /^(hi|hello|hey|sup|howdy|good\s*(morning|afternoon|evening)|how are you|how far|xup|yo|what's up|whats up|how r u)\b/i.test(msg) ||
    msg.includes("how are you") ||
    msg.includes("how r u") ||
    msg.includes("how doing")
  ) {
    const greetings = [
      "Hey there! 👋 I'm doing great, thank you so much for asking! 😊 Welcome to Trades Point. How is your day going? What can I help you find today?",
      "Hello! I'm doing awesome, thanks for asking! 👋 Welcome to Trades Point (Shop More. Save More. Live Better.). Are you looking for anything special today?",
      "Hi! Doing fantastic! 😊 Great to chat with you. How can I assist you with your shopping or order today?",
      "Hey! 👋 I'm doing very well, thank you! Ready to help you discover the best items in store or track an order. What's on your mind?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Order Tracking
  if (
    msg.includes("track") ||
    msg.includes("order") ||
    msg.includes("package") ||
    msg.includes("delivery status") ||
    msg.includes("where is my") ||
    msg.includes("check order")
  ) {
    if (isLoggedIn && userOrdersContext.includes("Order ID:")) {
      return `I can help you with your order! 📦 Here are your recent orders:\n${userOrdersContext.replace("\nCustomer's Recent Orders:\n", "")}\n\nYou can tap on any order in your Profile > Orders page to view live updates and rider status! If you have a specific tracking code, just paste it here.`;
    } else if (isLoggedIn) {
      return "I checked your account and you don't have any active orders right now! Once you place an order, you'll be able to track live rider delivery in real-time. If you have a tracking code (e.g. TRK...), paste it here and I'll search for it!";
    } else {
      return "I'd love to help you track your package! 📦 If you have a 8-character Tracking Code (like TRK87X4P...) or Order ID, please paste it here. You can also sign in to your account to view all your past and active orders!";
    }
  }

  // Products & Store catalog
  if (
    msg.includes("sell") ||
    msg.includes("what do you") ||
    msg.includes("offer") ||
    msg.includes("catalog") ||
    msg.includes("items") ||
    msg.includes("product") ||
    msg.includes("store") ||
    msg.includes("clothes") ||
    msg.includes("shoes") ||
    msg.includes("sneaker") ||
    msg.includes("gadget") ||
    msg.includes("fashion") ||
    msg.includes("art")
  ) {
    return `We offer high quality curated collections across several departments! 🛍️\n\n• 👕 **Fashion & Streetwear**: Quality Shirts, Polos, Hoodies, Dresses & Casual wear\n• 👟 **Footwear & Sneakers**: Casual shoes, athletic runners, and formal shoes\n• 📱 **Gadgets & Electronics**: Audio, Smart accessories, and Tech items\n• 🎨 **Art & Home**: Handcrafted Paintings, Sculptures & Living Essentials\n\n${productsListText ? `Here are a few popular items in store right now:\n${productsListText}\n\n` : ""}Would you like recommendations on any specific category or price range?`;
  }

  // Delivery / Shipping
  if (
    msg.includes("delivery") ||
    msg.includes("shipping") ||
    msg.includes("fee") ||
    msg.includes("cost") ||
    msg.includes("how long") ||
    msg.includes("location") ||
    msg.includes("accra") ||
    msg.includes("kumasi")
  ) {
    return "We deliver fast across all regions in Ghana! 🚚\n\n• **Greater Accra**: Deliveries usually arrive within 24 to 48 hours.\n• **Other Regions**: Delivered safely within 2 to 4 business days.\n• **Delivery Fees**: Calculated automatically at checkout based on your exact region and town.\n\nYou can see the exact delivery fee by adding items to your cart and entering your shipping town!";
  }

  // Payment methods
  if (
    msg.includes("pay") ||
    msg.includes("momo") ||
    msg.includes("mobile money") ||
    msg.includes("card") ||
    msg.includes("visa") ||
    msg.includes("mastercard") ||
    msg.includes("mtn") ||
    msg.includes("telecel") ||
    msg.includes("vodafone") ||
    msg.includes("airteltigo")
  ) {
    return "We accept multiple secure payment options through Paystack! 💳\n\n• 📱 **Mobile Money**: MTN MoMo, Telecel Cash, and AirtelTigo Money (direct prompt sent to your phone)\n• 💳 **Bank Cards**: Visa, Mastercard, and Verve debit/credit cards\n\nAll transactions are 100% encrypted and secured.";
  }

  // Returns / Refund Policy
  if (
    msg.includes("return") ||
    msg.includes("refund") ||
    msg.includes("policy") ||
    msg.includes("exchange") ||
    msg.includes("broken") ||
    msg.includes("damaged")
  ) {
    return "We want you to love everything you buy from Trades Point! ✨\n\n• We offer a **7-day return and exchange policy** for items in their original, unworn condition with tags attached.\n• If an item arrived damaged or incorrect, contact our support team right away and we'll arrange a free replacement or full refund!";
  }

  // Discounts & Promotions
  if (
    msg.includes("discount") ||
    msg.includes("coupon") ||
    msg.includes("promo") ||
    msg.includes("deal") ||
    msg.includes("offer") ||
    msg.includes("sale")
  ) {
    return "We regularly feature seasonal discounts and promotional offers! 🎉 You can enter valid coupon/discount codes directly on the Checkout page to get instant savings. Make sure you check out our homepage for daily flash sales!";
  }

  // Selling on Trades Point / Becoming a Seller
  if (
    msg.includes("sell") ||
    msg.includes("vendor") ||
    msg.includes("merchant") ||
    msg.includes("become a seller") ||
    msg.includes("store owner")
  ) {
    return "Want to sell your products on Trades Point? 🏪 It's super easy! You can apply directly through our **Sell** page at /sell. Once your seller profile and verification details are approved by our admin team, you can list products and start receiving customer orders!";
  }

  // General human fallback
  return "I'm right here to assist you! 😊 You can ask me about our product collections, delivery fees, order tracking, payment methods, or request to speak directly with a live support agent. How can I help you today?";
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    const clientId = getClientIdentifier(req, auth?.userId);

    // Enforce Rate Limiting (60 requests per hour)
    const rateCheck = await checkGlobalRateLimitAsync(auth?.client || null, "ai-chat", clientId, { maxRequests: 60, windowMs: 60 * 60 * 1000 });
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please wait a few moments before sending more messages.",
          resetInSec: rateCheck.resetInSec,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateCheck.resetInSec),
          },
        }
      );
    }

    let userOrdersContext = "";

    if (auth) {
      try {
        const { data: userOrders } = await auth.client
          .from("orders")
          .select("id, status, total_amount, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        if (userOrders && userOrders.length > 0) {
          userOrdersContext = `\nCustomer's Recent Orders:\n` + 
            userOrders.map((o: any) => `- Order ID: ${o.id} (Status: ${o.status}, Total: GH₵${o.total_amount}, Date: ${new Date(o.created_at).toLocaleDateString()})`).join("\n");
        } else {
          userOrdersContext = `\nCustomer is logged in but has no recent orders.`;
        }
      } catch (e) {
        console.error("Error fetching user orders for chat:", e);
      }
    } else {
      userOrdersContext = `\nCustomer is not logged in. If they ask to track an order, ask them to log in or provide their Order ID.`;
    }

    const body = await req.json().catch(() => ({}));
    const messages = sanitizeMessages((body as any)?.messages);
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const lastUserMsgLower = lastUserMsg.toLowerCase();

    // 1. Check for Human Support Escalation Request
    const isEscalationRequested = /human|agent|person|admin|representative|manager|speak to|talk to|connect me/i.test(lastUserMsgLower);
    if (isEscalationRequested) {
      return new Response(
        JSON.stringify({ 
          message: "I understand you'd like to speak with a live support representative! I have connected your chat directly to our Customer Support Team. A support specialist will join you right here shortly! 😊", 
          escalate: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch store products dynamically for rich responses
    let productsListText = "";
    try {
      const supabase = createClient(SUPABASE_URL, ANON_KEY);
      const { data: products } = await supabase
        .from("products")
        .select("name, category, price")
        .gt("stock", 0)
        .limit(5);

      if (products && products.length > 0) {
        productsListText = products.map((p: any) => `• ${p.name} (GH₵${p.price})`).join("\n");
      }
    } catch (e) {
      console.error("Error fetching products for chat:", e);
    }

    const systemInstruction = `You are a warm, genuine, empathetic, and ultra-friendly human-like customer support agent for "Trades Point" (Tagline: "Shop More. Save More. Live Better.").
Store Info:
${productsListText ? `Featured Products in Store:\n${productsListText}` : ""}
${userOrdersContext}

Tone & Personality Guidelines:
- Talk completely naturally, warmly, and politely like a real human customer care representative.
- When someone asks "sup how are you doing" or "hello", greet them back with warmth, answer how you're doing cheerfully, and ask how you can help them.
- Be helpful with product recommendations, order tracking, and delivery timelines across Ghana (Greater Accra 1-2 days, other regions 2-4 days).
- Keep responses concise, clear, human, and friendly. Never use robotic phrases like "As an AI language model".`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const completionApiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    // 2. Try OpenAI / Lovable Gateway first if key is present
    if (completionApiKey) {
      try {
        const aiEndpoint = OPENAI_API_KEY 
          ? "https://api.openai.com/v1/chat/completions" 
          : "https://ai.gateway.lovable.dev/v1/chat/completions";
        const aiModel = OPENAI_API_KEY ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

        const apiResponse = await fetch(aiEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${completionApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: "system", content: systemInstruction },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.7,
            max_tokens: 400,
          }),
        });

        if (apiResponse.ok) {
          const data = await apiResponse.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) {
            return new Response(
              JSON.stringify({ message: reply }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (openAiErr) {
        console.warn("OpenAI/Lovable gateway call failed, trying next provider:", openAiErr);
      }
    }

    // 3. Try Gemini direct API if GEMINI_API_KEY is present
    if (GEMINI_API_KEY) {
      try {
        const contentsPayload = messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `System Instruction: ${systemInstruction}` }] },
                ...contentsPayload,
              ],
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return new Response(
              JSON.stringify({ message: text.trim() }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini API call failed:", geminiErr);
      }
    }

    // 4. Natural Conversational Fallback Engine (Guaranteed friendly & ultra-fast)
    const fallbackMessage = generateHumanResponse(lastUserMsg, userOrdersContext, productsListText, !!auth);

    return new Response(
      JSON.stringify({ message: fallbackMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-chat:", error);
    return new Response(
      JSON.stringify({ message: "Hey there! 👋 Welcome to Trades Point. How can I assist you with your shopping or orders today?" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
