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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

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

    if (!apiKey) {
      let fallbackMessage = "Welcome to Trades Point! How can I help you today?";

      if (lastUserMsg.includes("track") || lastUserMsg.includes("order")) {
        if (auth && userOrdersContext.includes("Order ID:")) {
          fallbackMessage = `Here are your recent orders:\n${userOrdersContext.replace("\nCustomer's Recent Orders:\n", "")}\n\nYou can also view full details on your Profile / Orders page!`;
        } else if (auth) {
          fallbackMessage = "You currently have no recent orders. Once you place an order, you can track it live right here!";
        } else {
          fallbackMessage = "To track your order, please log in to your account or visit the Account > Orders section on our website.";
        }
      } else if (lastUserMsg.includes("product") || lastUserMsg.includes("help") || lastUserMsg.includes("find")) {
        fallbackMessage = "You can browse our latest fashion collection directly from the home page or search by categories!";
      }

      return new Response(
        JSON.stringify({ message: fallbackMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare system prompt with store context & products
    let storeContext = "";
    try {
      const supabase = createClient(SUPABASE_URL, ANON_KEY);
      const { data: products } = await supabase
        .from("products")
        .select("name, category, price, stock, description")
        .gt("stock", 0)
        .limit(20);

      if (products && products.length > 0) {
        storeContext += `\nAvailable Products:\n` + 
          products.map((p: any) => `- ${p.name} (${p.category}): $${p.price} - ${p.description || "In stock"}`).join("\n");
      }
    } catch (e) {
      console.error("Error fetching context:", e);
    }

    const systemPrompt = `You are a helpful AI customer support assistant for "Trades Point" (Tagline: "Shop More. Save More. Live Better.").
${storeContext}
${userOrdersContext}

Guidelines:
- Do your absolute best to answer and resolve the customer's questions directly (orders, products, shipping, returns).
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

      let fallbackMessage = "Thank you for reaching out! How can I assist you today?";
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
      JSON.stringify({ message: "To track your order or view active items, please sign in or visit your profile's Order section!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
