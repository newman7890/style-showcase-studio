import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate, hasRole } from "../_shared/auth.ts";
import { getAllPaystackSecretKeys } from "../_shared/paystack.ts";

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
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid reference format"),
});

const generateTrackingCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TRK";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

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

    const parsed = VerifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const { reference } = parsed.data;
    console.log(`Verifying payment with reference: ${reference}`);

    const allKeys = getAllPaystackSecretKeys();
    let paystackData: any = null;
    let lastError = "";

    for (const keyConfig of allKeys) {
      try {
        const response = await fetch(
          `https://api.paystack.co/transaction/verify/${reference}`,
          {
            headers: {
              Authorization: `Bearer ${keyConfig.secretKey}`,
            },
          }
        );
        const resData = await response.json();
        if (resData.status) {
          paystackData = resData;
          break;
        } else {
          lastError = resData.message || "Failed to verify transaction";
        }
      } catch (e) {
        console.error(`Error verifying with key ${keyConfig.sourceName}:`, e);
      }
    }

    if (!paystackData || !paystackData.status) {
      throw new Error(lastError || "Failed to verify payment across configured keys");
    }

    const transaction = paystackData.data;
    const isSuccessful = transaction.status === "success";
    const metadata = transaction.metadata || {};
    let orderId = metadata.order_id;
    const checkoutDetails = metadata.checkout_details;
    const userId = metadata.user_id || auth.userId;

    console.log("Transaction details:", JSON.stringify({
      status: transaction.status,
      gateway_response: transaction.gateway_response,
      amount: transaction.amount,
      reference: transaction.reference,
      orderId,
      hasCheckoutDetails: !!checkoutDetails,
    }));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      } else {
        friendlyError = `Payment failed (${transaction.gateway_response || transaction.status}). Please try again.`;
      }
      console.log("Payment not successful:", friendlyError);

      // If existing pending order was attached, cancel it
      if (orderId) {
        await supabase
          .from("orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", orderId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          status: transaction.status,
          friendlyError,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Payment is SUCCESSFUL!
    if (isSuccessful) {
      if (orderId) {
        // 1. Existing order case: update to paid/confirmed
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "confirmed", payment_status: "paid", updated_at: new Date().toISOString() })
          .eq("id", orderId);

        if (updateError) {
          console.error("Error updating order status:", updateError);
        } else {
          console.log(`Order ${orderId} confirmed`);
        }
      } else if (checkoutDetails) {
        // 2. New checkout case: create order ONLY NOW upon successful payment!
        const paidAmountGhs = transaction.amount / 100;
        const trackingCode = generateTrackingCode();

        console.log(`Creating NEW confirmed order for user ${userId}, amount ${paidAmountGhs}`);

        const { data: newOrder, error: createErr } = await supabase
          .from("orders")
          .insert({
            user_id: userId,
            tracking_code: trackingCode,
            total_amount: paidAmountGhs,
            shipping_name: checkoutDetails.shipping_name,
            shipping_email: checkoutDetails.shipping_email,
            shipping_phone: checkoutDetails.shipping_phone,
            shipping_address: checkoutDetails.shipping_address,
            shipping_city: checkoutDetails.shipping_city,
            shipping_region: checkoutDetails.shipping_region,
            shipping_town: checkoutDetails.shipping_town || null,
            delivery_fee: checkoutDetails.delivery_fee || 0,
            discount_code: checkoutDetails.discount_code || null,
            discount_amount: checkoutDetails.discount_amount || null,
            payment_method: metadata.payment_method || "bank_card",
            status: "confirmed",
            payment_status: "paid",
          })
          .select()
          .single();

        if (createErr || !newOrder) {
          console.error("Error creating order after payment:", createErr);
          throw new Error("Failed to record order after payment success");
        }

        orderId = newOrder.id;

        // Insert order items
        if (checkoutDetails.items && Array.isArray(checkoutDetails.items) && checkoutDetails.items.length > 0) {
          const itemsToInsert = checkoutDetails.items.map((item: any) => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            selected_color: item.selected_color || null,
            selected_size: item.selected_size || null,
          }));

          const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert);
          if (itemsErr) {
            console.error("Error inserting order items:", itemsErr);
          }
        }

        // Clear customer cart
        if (userId) {
          await supabase.from("cart_items").delete().eq("user_id", userId);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: transaction.status,
        amount: transaction.amount / 100,
        orderId,
        paidAt: transaction.paid_at,
        reference: transaction.reference,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
