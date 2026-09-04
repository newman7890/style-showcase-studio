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

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    const clientId = getClientIdentifier(req, auth?.userId);

    // Enforce Rate Limiting to prevent API quota drain (30 requests per hour)
    const rateCheck = await checkGlobalRateLimitAsync(auth?.client || null, "ai-chat", clientId, { maxRequests: 30, windowMs: 60 * 60 * 1000 });
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please wait a few minutes before sending more messages.",
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

    const lastUserMsg = messages[messages.length - 1]?.content.toLowerCase() || "";

    // 1. Check for Human Support Escalation Request
    const isEscalationRequested = /human|agent|person|admin|representative|manager|speak to|talk to|connect me/i.test(lastUserMsg);
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
        .limit(6);

      if (products && products.length > 0) {
        productsListText = products.map((p: any) => `• ${p.name} (GH₵${p.price})`).join("\n");
      }
    } catch (e) {
      console.error("Error fetching products for chat:", e);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    // 2. If Gemini API Key is available, use Gemini 1.5 Flash
    if (GEMINI_API_KEY) {
      try {
        const storeInfo = productsListText ? `Available Store Products:\n${productsListText}` : "";
        const systemInstruction = `You are a warm, friendly, human-like customer support agent for "Trades Point" (Tagline: "Shop More. Save More. Live Better.").
${storeInfo}
${userOrdersContext}

Guidelines:
- Talk naturally like a real friendly human customer service representative.
- Answer greeting messages with a friendly personal reply.
- Answer store catalog questions by describing items.
- Keep responses concise, clear, and helpful.`;

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
            return new Response(JSON.stringify({ message: text }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (geminiErr) {
        console.error("Gemini API call failed:", geminiErr);
      }
    }

    // 3. Conversational Fallback Engine
    let fallbackMessage = "";

    if (/^(hi|hello|hey|sup|howdy|good morning|good afternoon|good evening|how are you|how far|xup|yo)\b/i.test(lastUserMsg) || lastUserMsg.includes("how are you")) {
      const greetingReplies = [
        "Hey there! 👋 I'm doing great, thanks for asking! How can I help you on Trades Point today?",
        "Hello! I'm doing awesome! 😊 Welcome to Trades Point. Are you looking for anything specific today?",
        "Hi! Doing great! 👋 How can I assist you with your shopping or order today?",
      ];
      fallbackMessage = greetingReplies[Math.floor(Math.random() * greetingReplies.length)];
    } else if (lastUserMsg.includes("sell") || lastUserMsg.includes("what do you") || lastUserMsg.includes("offer") || lastUserMsg.includes("catalog") || lastUserMsg.includes("items") || lastUserMsg.includes("website") || lastUserMsg.includes("product")) {
      fallbackMessage = `We sell high quality fashion apparel, footwear, stylish accessories, and art collections! 🛍️\n\nHere are some items currently in store:\n${productsListText || "• Quality Shirts & Dresses\n• Sneakers & Shoes\n• Fashion Accessories"}\n\nYou can browse all items on our home page!`;
    } else if (lastUserMsg.includes("track") || lastUserMsg.includes("order") || lastUserMsg.includes("package") || lastUserMsg.includes("delivery status")) {
      if (auth && userOrdersContext.includes("Order ID:")) {
        fallbackMessage = `Here are your recent orders:\n${userOrdersContext.replace("\nCustomer's Recent Orders:\n", "")}\n\nYou can track live updates on your Profile > Orders page!`;
      } else if (auth) {
        fallbackMessage = "You currently have no active orders. Once you place an order, you can track its status live right here!";
      } else {
        fallbackMessage = "To track your order status, please sign in to your account or visit our Track Order page with your tracking code!";
      }
    } else if (lastUserMsg.includes("delivery") || lastUserMsg.includes("shipping") || lastUserMsg.includes("fee") || lastUserMsg.includes("cost") || lastUserMsg.includes("location")) {
      fallbackMessage = "We deliver across all regions and major towns in Ghana! 🚚 Delivery fees are calculated dynamically based on your region during checkout.";
    } else if (lastUserMsg.includes("return") || lastUserMsg.includes("refund") || lastUserMsg.includes("policy") || lastUserMsg.includes("exchange")) {
      fallbackMessage = "We have a 7-day return policy for unused items in original packaging. If you need help returning an item, our support team will guide you!";
    } else {
      fallbackMessage = "I'm here to help! You can ask me about our catalog, delivery fees, order tracking, or request to speak directly with a human admin agent anytime!";
    }

    return new Response(
      JSON.stringify({ message: fallbackMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-chat:", error);
    return new Response(
      JSON.stringify({ message: "Hello! Welcome to Trades Point. How can I help you today?" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
