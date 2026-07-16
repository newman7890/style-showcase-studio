import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, SERVICE_ROLE_KEY, SUPABASE_URL } from "../_shared/auth.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication — protects AI quota from anonymous abuse.
    const auth = await authenticate(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body = await req.json().catch(() => ({}));
    const messages = sanitizeMessages((body as any)?.messages);
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = auth.userId;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch product data for context
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price, category, stock, description")
      .limit(50);

    // Fetch user's recent orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, tracking_code, total_amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    const userOrders = orders || [];

    const systemPrompt = `You are a helpful customer service assistant for an online fashion store. You help customers with:
- Product recommendations and information
- Order tracking and status inquiries
- General shopping assistance
- Returns and refunds information

Available Products:
${products?.map(p => `- ${p.name} (GH₵${p.price}) - Category: ${p.category}${p.stock > 0 ? '' : ' [OUT OF STOCK]'}`).join('\n') || 'No products available'}

${userOrders.length > 0 ? `
Customer's Recent Orders:
${userOrders.map(o => `- Order #${o.id.slice(0, 8).toUpperCase()} - Status: ${o.status} - Tracking: ${o.tracking_code || 'N/A'} - Amount: GH₵${o.total_amount}`).join('\n')}
` : ''}

Guidelines:
- Be friendly, helpful, and concise
- When asked about orders, use the order data provided above
- Recommend products based on customer needs
- For refunds/returns, explain the store policy (7-day return policy for unused items)
- If you don't know something, be honest and suggest contacting customer support
- Respond in the same language as the customer's message`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
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
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service quota exceeded." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
