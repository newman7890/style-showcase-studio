import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  email: z.string().email("Invalid email").max(254),
  amount: z.number().positive("Amount must be positive").finite().max(10_000_000, "Amount too large"),
  paymentMethod: z.enum(["mtn_momo", "tigo_cash", "telecel_cash", "bank_card"]),
  mobileNumber: z.string().min(7).max(20).optional(),
  callbackUrl: z.string().url("Invalid callback URL").max(500),
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

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured");
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

    const { orderId, email, amount, paymentMethod, mobileNumber, callbackUrl } = parsed.data;

    // Verify the order belongs to the authenticated user (RLS-scoped query) and fetch authoritative amount.
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
    const serverAmount = Number(orderRow.total_amount);
    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid order amount" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    void amount; // ignore client-supplied amount; use orders.total_amount
    console.log(`Initializing payment for order ${orderId}, server amount: ${serverAmount}, method: ${paymentMethod}`);

    // Convert amount to pesewas (Paystack uses smallest currency unit)
    const amountInPesewas = Math.round(serverAmount * 100);

    // Map payment method to Paystack channels
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

    const paystackPayload: Record<string, unknown> = {
      email,
      amount: amountInPesewas,
      currency: "GHS",
      reference: `ORDER_${orderId}_${Date.now()}`,
      callback_url: callbackUrl,
      channels,
      metadata: {
        order_id: orderId,
        payment_method: paymentMethod,
        custom_fields: [
          {
            display_name: "Order ID",
            variable_name: "order_id",
            value: orderId,
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

    console.log("Paystack payload:", JSON.stringify(paystackPayload));

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackResponse.json();
    console.log("Paystack response:", JSON.stringify(paystackData));

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Failed to initialize payment");
    }

    console.log(`Payment initialized successfully. Reference: ${paystackData.data.reference}`);

    return new Response(
      JSON.stringify({
        success: true,
        authorizationUrl: paystackData.data.authorization_url,
        accessCode: paystackData.data.access_code,
        reference: paystackData.data.reference,
        publicKey: Deno.env.get("PAYSTACK_PUBLIC_KEY") || "",
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
