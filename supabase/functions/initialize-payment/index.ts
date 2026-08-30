import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate } from "../_shared/auth.ts";
import { getAllPaystackSecretKeysAsync, getPaystackPublicKey, PaystackKeyConfig } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID").optional().nullable(),
  email: z.string().email("Invalid email").max(254),
  amount: z.number().positive("Amount must be positive").finite().max(10_000_000, "Amount too large"),
  paymentMethod: z.string().optional().nullable(),
  mobileNumber: z.union([z.string().min(7).max(20), z.literal(""), z.null()]).optional(),
  callbackUrl: z.string().url("Invalid callback URL").max(500),
  checkoutDetails: z.object({
    shipping_name: z.string(),
    shipping_email: z.string(),
    shipping_phone: z.string(),
    shipping_address: z.string(),
    shipping_city: z.string(),
    shipping_region: z.string(),
    shipping_town: z.string().optional().nullable(),
    delivery_fee: z.number().default(0),
    discount_code: z.string().optional().nullable(),
    discount_amount: z.number().optional().nullable(),
    items: z.array(z.object({
      product_id: z.string(),
      quantity: z.number(),
      price: z.number(),
      selected_color: z.any().optional().nullable(),
      selected_size: z.any().optional().nullable(),
    })),
  }).optional().nullable(),
});

const normalizeGhanaMobileNumber = (phone?: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `+233${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+233${digits}`;
  }
  return null;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("initialize-payment function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    const userId = auth?.userId || null;

    const rawBody = await req.json();
    const parsed = PaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { orderId, email, amount, paymentMethod, mobileNumber, callbackUrl, checkoutDetails } = parsed.data;

    let serverAmount = amount;

    // If orderId is supplied, verify existing order amount
    if (orderId && auth?.client) {
      const { data: orderRow, error: orderErr } = await auth.client
        .from("orders").select("id,total_amount,status").eq("id", orderId).maybeSingle();
      if (orderErr || !orderRow) {
        return new Response(JSON.stringify({ error: "Order not found or access denied" }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (orderRow.status === "confirmed" || orderRow.status === "cancelled" || orderRow.status === "refunded") {
        return new Response(JSON.stringify({ error: "Order is not payable" }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      serverAmount = Number(orderRow.total_amount);
    }

    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid order amount" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Initializing payment, server amount: ${serverAmount}, method: ${paymentMethod || "default"}, orderId: ${orderId || "new_checkout"}`);

    const amountInPesewas = Math.round(serverAmount * 100);

    const channels = ["card", "mobile_money"];

    const refCode = orderId ? `ORDER_${orderId}_${Date.now()}` : `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const paystackPayload: Record<string, unknown> = {
      email,
      amount: amountInPesewas,
      currency: "GHS",
      reference: refCode,
      callback_url: callbackUrl,
      channels,
      metadata: {
        order_id: orderId || null,
        user_id: userId,
        payment_method: paymentMethod || "bank_card",
        checkout_details: checkoutDetails || null,
        custom_fields: [
          {
            display_name: "Customer Email",
            variable_name: "customer_email",
            value: email,
          },
        ],
      },
    };

    const allKeys = await getAllPaystackSecretKeysAsync();
    let paystackData: any = null;
    let successfulKeyConfig: PaystackKeyConfig | null = allKeys[0] || null;
    let lastPaystackError = "";

    if (allKeys.length > 0) {
      for (const keyConfig of allKeys) {
        try {
          console.log(`Attempting Paystack initialize with key from ${keyConfig.sourceName}...`);
          const response = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${keyConfig.secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(paystackPayload),
          });

          const resData = await response.json();
          console.log("Paystack response:", JSON.stringify(resData));
          if (resData.status && resData.data?.authorization_url) {
            paystackData = resData;
            successfulKeyConfig = keyConfig;
            break;
          } else {
            lastPaystackError = resData.message || "Failed to initialize Paystack payment.";
          }
        } catch (err: any) {
          console.error(`Fetch error with key ${keyConfig.sourceName}:`, err);
          lastPaystackError = err?.message || "Network error contacting Paystack API.";
        }
      }
    } else {
      const errMsg = "No valid Paystack Secret Key found. Paystack Secret Keys must start with 'sk_live_' or 'sk_test_'. Please update PAYSTACK_SECRET_KEY in your Supabase Secrets or Admin Settings.";
      console.error(errMsg);
      return new Response(
        JSON.stringify({ error: errMsg }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // If Paystack API call failed, return a clear error so the user knows what's wrong
    if (!paystackData || !paystackData.status || !paystackData.data?.authorization_url) {
      const errMsg = lastPaystackError || "Failed to connect to Paystack. Please check your API key in Admin Settings.";
      console.error("Paystack initialization failed:", errMsg);
      return new Response(
        JSON.stringify({ error: errMsg }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        authorizationUrl: paystackData.data.authorization_url,
        authorization_url: paystackData.data.authorization_url,
        accessCode: paystackData.data.access_code,
        reference: paystackData.data.reference,
        publicKey: successfulKeyConfig?.publicKey || getPaystackPublicKey() || "",
        channels,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in initialize-payment function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
