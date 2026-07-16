import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate, hasRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VerifySchema = z.object({
  reference: z
    .string()
    .min(1)
    .max(100, "Reference too long")
    .regex(/^[A-Za-z0-9_\-]+$/, "Invalid reference format"),
});

const handler = async (req: Request): Promise<Response> => {
  console.log("verify-payment function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured");
    }

    const parsed = VerifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const { reference } = parsed.data;
    console.log(`Verifying payment with reference: ${reference}`);

    // Verify transaction with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();
    console.log("Paystack verification response:", JSON.stringify(paystackData));

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Failed to verify payment");
    }

    const transaction = paystackData.data;
    const isSuccessful = transaction.status === "success";
    const orderId = transaction.metadata?.order_id;

    console.log("Transaction details:", JSON.stringify({
      status: transaction.status,
      gateway_response: transaction.gateway_response,
      channel: transaction.channel,
      amount: transaction.amount,
      currency: transaction.currency,
      reference: transaction.reference,
      orderId,
    }));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the order belongs to the caller (admins are also allowed) and fetch stored total.
    let storedTotal: number | null = null;
    if (orderId) {
      const isAdmin = await hasRole(auth.userId, "admin");
      const { data: ownerCheck } = await supabase
        .from("orders").select("user_id,total_amount").eq("id", orderId).maybeSingle();
      if (!ownerCheck || (!isAdmin && ownerCheck.user_id !== auth.userId)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      storedTotal = Number(ownerCheck.total_amount);
    }

    // Detect under-payment: paid amount must match stored order total (within 1 pesewa tolerance).
    let amountMismatch = false;
    if (isSuccessful && orderId && storedTotal !== null && Number.isFinite(storedTotal)) {
      const paidGhs = transaction.amount / 100;
      if (Math.abs(paidGhs - storedTotal) > 0.01) {
        amountMismatch = true;
        console.error(`Amount mismatch on order ${orderId}: paid=${paidGhs} expected=${storedTotal}`);
      }
    }

    // Build a user-friendly failure reason
    let friendlyError: string | null = null;
    if (!isSuccessful) {
      const gw = (transaction.gateway_response || "").toLowerCase();
      if (gw.includes("insufficient")) {
        friendlyError = "Insufficient funds. Please top up and try again.";
      } else if (gw.includes("declined") || gw.includes("do not honor")) {
        friendlyError = "Transaction was declined by your provider. Please try a different payment method.";
      } else if (gw.includes("abandoned") || transaction.status === "abandoned") {
        friendlyError = "Payment was not completed. Please approve the prompt on your phone and try again.";
      } else if (gw.includes("timeout") || gw.includes("timed out")) {
        friendlyError = "Payment timed out. Please try again and approve the prompt quickly.";
      } else if (transaction.status === "failed") {
        friendlyError = `Payment failed: ${transaction.gateway_response || "Unknown error"}. Please try again.`;
      } else {
        friendlyError = `Payment was not successful (${transaction.gateway_response || transaction.status}). Please try again.`;
      }
      console.log("Payment failed — friendly error:", friendlyError);
    }

    if (isSuccessful && orderId && !amountMismatch) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (updateError) {
        console.error("Error updating order status:", updateError);
      } else {
        console.log(`Order ${orderId} confirmed`);
      }
    } else if ((!isSuccessful || amountMismatch) && orderId) {
      const { error: cancelError } = await supabase
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (cancelError) {
        console.error("Error cancelling order:", cancelError);
      } else {
        console.log(`Order ${orderId} cancelled${amountMismatch ? " (amount mismatch)" : ""}`);
      }
    }

    if (amountMismatch) {
      friendlyError = "Payment amount did not match the order total. The order has been cancelled.";
    }

    return new Response(
      JSON.stringify({
        success: isSuccessful && !amountMismatch,
        status: amountMismatch ? "amount_mismatch" : transaction.status,
        amount: transaction.amount / 100,
        orderId,
        paidAt: transaction.paid_at,
        channel: transaction.channel,
        reference: transaction.reference,
        gatewayResponse: transaction.gateway_response,
        friendlyError,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in verify-payment function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
