import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, SERVICE_ROLE_KEY, SUPABASE_URL, ANON_KEY } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
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
            userOrders.map((o: any) => `- Order ID: ${o.id} (Status: ${o.status}, Total: $${o.total_amount}, Date: ${new Date(o.created_at).toLocaleDateString()})`).join("\n");
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
    const isEscalationRequested = /human|agent|person|admin|representative|manager|speak to|talk to|connect me/i.test(lastUserMsg);

    if (isEscalationRequested) {
      return new Response(
        JSON.stringify({ 
          message: "I understand you would like to speak with a human support agent. I have connected your conversation directly to our live admin support team. An admin representative will join this chat shortly!", 
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    // Smart fallback if API Key is not configured
    if (!apiKey) {
      let fallbackMessage = "Welcome to Trades Point! How can I help you today? Feel free to ask about our products, order tracking, or delivery fees.";

      if (lastUserMsg.includes("sell") || lastUserMsg.includes("what do you") || lastUserMsg.includes("offer") || lastUserMsg.includes("catalog") || lastUserMsg.includes("item") || lastUserMsg.includes("shop")) {
        fallbackMessage = `We sell top quality fashion, clothing, footwear, accessories, and art collections on our store! 🛍️\n\nSome of our popular items include:\n${productsListText || "• Quality Clothing & Apparel\n• Stylish Shoes & Sneakers\n• Modern Accessories"}\n\nYou can browse our full catalog directly on the home page!`;
      } else if (lastUserMsg.includes("track") || lastUserMsg.includes("order") || lastUserMsg.includes("my package")) {
        if (auth && userOrdersContext.includes("Order ID:")) {
          fallbackMessage = `Here are your recent orders:\n${userOrdersContext.replace("\nCustomer's Recent Orders:\n", "")}\n\nYou can track live updates on your Profile > Orders page!`;
        } else if (auth) {
          fallbackMessage = "You currently have no recent orders. Once you place an order, you can track its status live right here!";
        } else {
          fallbackMessage = "To track your order, please sign in to your account or enter your Order ID on our Track Order page!";
        }
      } else if (lastUserMsg.includes("hi") || lastUserMsg.includes("hello") || lastUserMsg.includes("hey") || lastUserMsg.includes("sup")) {
        fallbackMessage = "Hello there! 👋 Welcome to Trades Point. How can I assist you with your shopping today?";
      } else if (lastUserMsg.includes("delivery") || lastUserMsg.includes("shipping") || lastUserMsg.includes("fee") || lastUserMsg.includes("cost")) {
        fallbackMessage = "We deliver across all major towns and regions in Ghana! Delivery fees are calculated dynamically based on your region during checkout.";
      } else if (lastUserMsg.includes("return") || lastUserMsg.includes("refund") || lastUserMsg.includes("policy")) {
        fallbackMessage = "We offer a 7-day return policy for unused items in original packaging. If you need assistance with a return, our team is happy to help!";
      }

      return new Response(
        JSON.stringify({ message: fallbackMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare system prompt with store context & products
    let storeContext = "";
    if (productsListText) {
      storeContext = `\nFeatured Products in Store:\n${productsListText}`;
    }

    const systemPrompt = `You are a friendly AI customer support assistant for "Trades Point" (Tagline: "Shop More. Save More. Live Better.").
${storeContext}
${userOrdersContext}

Guidelines:
- Do your absolute best to answer and resolve the customer's questions directly (orders, products, shipping, returns).
- When asked what you sell, list clothing, shoes, fashion accessories, and featured items in store.
- Be friendly, helpful, and concise.
- For refunds/returns, explain the store policy (7-day return policy for unused items).
- If the customer explicitly asks to talk to a human, live agent, or admin, politely inform them that you are transferring their session to live admin support.`;

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
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      let fallbackMessage = "We sell top quality fashion, clothing, footwear, and accessories! How can I help you today?";
      if (lastUserMsg.includes("track") || lastUserMsg.includes("order")) {
        fallbackMessage = auth
          ? "To view and track your recent orders, please check the Account > Orders section on your profile page."
          : "To track your order, please log in to your account to view your active orders.";
      }

      return new Response(
        JSON.stringify({ message: fallbackMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "I couldn't process that request.";

    return new Response(
      JSON.stringify({ message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-chat:", error);
    return new Response(
      JSON.stringify({ message: "Welcome to Trades Point! How can I assist you with your shopping today?" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
