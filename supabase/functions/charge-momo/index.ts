import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate } from "../_shared/auth.ts";
import { getPaystackSecretKey } from "../_shared/paystack.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

const ChargeSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  email: z.string().email("Invalid email").max(254),
  amount: z.number().positive().finite().max(10_000_000),
  provider: z.enum(["mtn", "vod", "atl"]), // MTN, Telecel (vodafone), AirtelTigo
  mobileNumber: z.string().min(7).max(20),
});

const normalizeGhanaMobileNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith("0") && digits.length === 10) return digits;
  if (digits.length === 9) return `0${digits}`;
  return null;
};

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const buildErrorResponse = (
    status: number,
    payload: {
      error: string;
      userMessage: string;
      errorCode: string;
      fallback?: boolean;
      promptSent?: boolean;
    },
    extraHeaders: Record<string, string> = {}
  ) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
    });

  // Rate Limiting by IP (15 requests per 10 minutes)
  const ipClientId = getClientIdentifier(req, null);
  const ipCheck = checkRateLimit("charge-momo", ipClientId, { maxRequests: 15, windowMs: 10 * 60 * 1000 });
  if (!ipCheck.allowed) {
    return buildErrorResponse(
      429,
      {
        error: "Too many payment attempts",
        userMessage: "Too many Mobile Money attempts. Please wait a few minutes before trying again.",
        errorCode: "RATE_LIMIT_EXCEEDED",
        fallback: true,
        promptSent: false,
      },
      { "Retry-After": ipCheck.resetInSec.toString() }
    );
  }

  try {
    const auth = await authenticate(req);
    if (!auth) {
      return buildErrorResponse(401, {
        error: "Unauthorized",
        userMessage: "Please sign in to start a Mobile Money payment.",
        errorCode: "UNAUTHORIZED",
        fallback: true,
        promptSent: false,
      });
    }

    // Rate Limiting by User (10 requests per 10 minutes)
    const userClientId = getClientIdentifier(req, auth.userId);
    const userCheck = await checkGlobalRateLimitAsync(auth.client, "charge-momo", userClientId, { maxRequests: 10, windowMs: 10 * 60 * 1000 });
    if (!userCheck.allowed) {
      return buildErrorResponse(
        429,
        {
          error: "User rate limit exceeded",
          userMessage: "Too many Mobile Money attempts for this account. Please wait before retrying.",
          errorCode: "RATE_LIMIT_EXCEEDED",
          fallback: true,
          promptSent: false,
        },
        { "Retry-After": userCheck.resetInSec.toString() }
      );
    }

    const paystackSecretKey = getPaystackSecretKey();
    const rawBody = await req.json();
    const parsed = ChargeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { orderId, email, amount, provider, mobileNumber } = parsed.data;

    // Verify order ownership via RLS-scoped query and fetch authoritative amount.
    const { data: orderRow, error: orderErr } = await auth.client
      .from("orders").select("id,total_amount,status").eq("id", orderId).maybeSingle();
    if (orderErr || !orderRow) {
      return buildErrorResponse(403, {
        error: "Order not found",
        userMessage: "We couldn't find this order on your account.",
        errorCode: "ORDER_NOT_FOUND",
        fallback: true,
        promptSent: false,
      });
    }
    if (orderRow.status === "confirmed" || orderRow.status === "cancelled" || orderRow.status === "refunded") {
      return buildErrorResponse(400, {
        error: "Order is not payable",
        userMessage: "This order can no longer be paid for.",
        errorCode: "ORDER_NOT_PAYABLE",
        fallback: true,
        promptSent: false,
      });
    }
    // Ignore client-supplied amount; use server-stored total_amount.
    const serverAmount = Number(orderRow.total_amount);
    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return buildErrorResponse(400, {
        error: "Invalid order amount",
        userMessage: "This order has an invalid total. Please contact support.",
        errorCode: "INVALID_AMOUNT",
        fallback: true,
        promptSent: false,
      });
    }
    const normalized = normalizeGhanaMobileNumber(mobileNumber);
    if (!normalized) {
      return buildErrorResponse(400, {
        error: "Invalid Ghana mobile number",
        userMessage: "Enter a valid Ghana Mobile Money number to receive the approval prompt.",
        errorCode: "INVALID_PHONE",
        fallback: true,
        promptSent: false,
      });
    }

    const supportedPrefixes: Record<string, string[]> = {
      mtn: ["024", "025", "053", "054", "055", "059"],
      vod: ["020", "050"],
      atl: ["026", "027", "056", "057"],
    };

    const phonePrefix = normalized.slice(0, 3);
    if (!supportedPrefixes[provider].includes(phonePrefix)) {
      return buildErrorResponse(400, {
        error: "Phone number does not match selected mobile money network",
        userMessage: "The wallet number does not match the Mobile Money network you selected. Choose the correct network and try again.",
        errorCode: "PROVIDER_MISMATCH",
        fallback: true,
        promptSent: false,
      });
    }

    const reference = `ORDER_${orderId}_${Date.now()}`;
    const amountInPesewas = Math.round(serverAmount * 100);
    void amount; // amount param is ignored; server uses orders.total_amount

    const payload = {
      email,
      amount: amountInPesewas,
      currency: "GHS",
      reference,
      mobile_money: { phone: normalized, provider },
      metadata: {
        order_id: orderId,
        payment_method: `${provider}_momo`,
      },
    };

    console.log("Paystack /charge payload:", JSON.stringify(payload));

    const res = await fetch("https://api.paystack.co/charge", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log("Paystack /charge response:", JSON.stringify(data));

    const chargeStatus = data?.data?.status as string | undefined;
    const displayText = data?.data?.display_text as string | undefined;
    // Paystack puts the real reason in data.data.message (e.g. test-mode decline)
    const detailMessage = data?.data?.message as string | undefined;
    const gatewayMessage =
      detailMessage || data?.data?.gateway_response || data?.message || "Failed to initiate mobile money charge";

    if (!data.status) {
      const isTestModeDecline = /test mobile money number/i.test(gatewayMessage);
      return buildErrorResponse(400, {
        error: gatewayMessage,
        userMessage: isTestModeDecline
          ? "Paystack is in test mode, so only test wallet numbers work. Use 0551234987 (MTN) to simulate a successful payment."
          : gatewayMessage,
        errorCode: isTestModeDecline ? "TEST_MODE_NUMBER_REQUIRED" : "CHARGE_FAILED",
        fallback: true,
        promptSent: false,
      });
    }


    if (chargeStatus === "failed" || chargeStatus === "timeout") {
      return buildErrorResponse(400, {
        error: gatewayMessage,
        userMessage: gatewayMessage || "The Mobile Money request failed before the approval prompt could be completed.",
        errorCode: chargeStatus === "timeout" ? "PROMPT_TIMEOUT" : "CHARGE_FAILED",
        fallback: true,
        promptSent: false,
      });
    }

    if (chargeStatus === "send_otp") {
      return new Response(
        JSON.stringify({
          success: true,
          reference: data.data?.reference ?? reference,
          status: chargeStatus,
          display_text: displayText,
          requiresOtp: true,
          promptSent: false,
          awaitingAction: true,
          userMessage:
            displayText ||
            "Your Mobile Money provider sent an OTP code to your phone. Enter it here to receive the wallet PIN prompt.",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const manualInputRequired = ["send_phone", "send_birthday"].includes(chargeStatus || "");

    if (manualInputRequired) {
      return new Response(
        JSON.stringify({
          success: false,
          reference: data.data?.reference ?? reference,
          status: chargeStatus,
          display_text: displayText,
          errorCode: "MANUAL_INPUT_REQUIRED",
          promptSent: false,
          fallback: true,
          userMessage:
            displayText ||
            "Your Mobile Money provider requested an extra verification step instead of sending the usual wallet PIN prompt.",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const promptSent = ["pay_offline", "pending", "success"].includes(chargeStatus || "");

    if (!promptSent) {
      return buildErrorResponse(400, {
        error: gatewayMessage,
        userMessage: "The payment request was created, but we could not confirm that the phone prompt was sent.",
        errorCode: "PROMPT_NOT_SENT",
        fallback: true,
        promptSent: false,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference: data.data?.reference ?? reference,
        status: chargeStatus,
        display_text: displayText,
        message: data.message,
        promptSent,
        awaitingAction: chargeStatus !== "success",
        completed: chargeStatus === "success",
        userMessage:
          displayText ||
          (chargeStatus === "success"
            ? "Payment was approved successfully."
            : "A Mobile Money prompt has been sent to your phone. Enter your PIN to continue."),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("charge-momo error:", msg);
    return buildErrorResponse(500, {
      error: msg,
      userMessage: "We couldn't start the Mobile Money payment right now. Please try again shortly.",
      errorCode: "SERVER_ERROR",
      fallback: true,
      promptSent: false,
    });
  }
};

serve(handler);
