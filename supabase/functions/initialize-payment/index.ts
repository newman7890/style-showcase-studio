import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate } from "../_shared/auth.ts";
import { getAllPaystackSecretKeys } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID").optional(),
  email: z.string().email("Invalid email").max(254),
  amount: z.number().positive("Amount must be positive").finite().max(10_000_000, "Amount too large"),
  paymentMethod: z.enum(["mtn_momo", "tigo_cash", "telecel_cash", "bank_card"]),
  mobileNumber: z.string().min(7).max(20).optional(),
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
      selected_color: z.any().optional(),
      selected_size: z.any().optional(),
    })),
  }).optional(),
});

const normalizeGhanaMobileNumber = (phone?: string) => {
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
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rawBody = await req.json();
    const parsed = PaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { orderId, email, amount, paymentMethod, mobileNumber, callbackUrl, checkoutDetails } = parsed.data;

    let serverAmount = amount;

    // If orderId is supplied, verify existing order amount
    if (orderId) {
      const { data: orderRow, error: orderErr } = await auth.client
        .from("orders").select("id,total_amount,status").eq("id", orderId).maybeSingle();
      if (orderErr || !orderRow) {
        return new Response(JSON.stringify({ error: "Order not found or access denied" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (orderRow.status === "confirmed" || orderRow.status === "cancelled" || orderRow.status === "refunded") {
        return new Response(JSON.stringify({ error: "Order is not payable" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      serverAmount = Number(orderRow.total_amount);
    }

    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid order amount" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Initializing payment, server amount: ${serverAmount}, method: ${paymentMethod}, orderId: ${orderId || "new_checkout"}`);

    const amountInPesewas = Math.round(serverAmount * 100);

    let channels: string[] = [];
    let mobileMoneyProvider: string | undefined;

    switch (paymentMethod) {
      case "mtn_momo":
        channels = ["mobile_money"];
        mobileMoneyProvider = "mtn";
        break;
      case "tigo_cash":
        channels = ["mobile_money"];
        mobileMoneyProvider = "atl";
        break;
      case "telecel_cash":
        channels = ["mobile_money"];
        mobileMoneyProvider = "vod";
        break;
      case "bank_card":
        channels = ["card", "mobile_money"];
        break;
      default:
        channels = ["card", "mobile_money"];
    }

    const normalizedMobileNumber = normalizeGhanaMobileNumber(mobileNumber);

    if (channels.includes("mobile_money") && mobileMoneyProvider && !normalizedMobileNumber) {
      return new Response(
        JSON.stringify({ error: "Valid Ghana mobile money number is required for mobile money payments" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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
        user_id: auth.userId,
        payment_method: paymentMethod,
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

    if (mobileMoneyProvider && normalizedMobileNumber) {
      paystackPayload.mobile_money = {
        phone: normalizedMobileNumber,
        provider: mobileMoneyProvider,
      };
    }

    const allKeys = getAllPaystackSecretKeys();
    let paystackData: any = null;
    let successfulKeyConfig = allKeys[0];
    let lastPaystackError = "";

    for (const keyConfig of allKeys) {
      try {
        const response = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${keyConfig.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paystackPayload),
        });

        const resData = await response.json();
        if (resData.status) {
          paystackData = resData;
          successfulKeyConfig = keyConfig;
          break;
        } else {
          lastPaystackError = resData.message || "Failed to initialize payment";
        }
      } catch (err) {
        console.error(`Fetch error with key ${keyConfig.sourceName}:`, err);
      }
    }

    if (!paystackData || !paystackData.status) {
      throw new Error(lastPaystackError || "Paystack payment initialization failed across all configured keys.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        authorizationUrl: paystackData.data.authorization_url,
        authorization_url: paystackData.data.authorization_url,
        accessCode: paystackData.data.access_code,
        reference: paystackData.data.reference,
        publicKey: successfulKeyConfig.publicKey,
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
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
