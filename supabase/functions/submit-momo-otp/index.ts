import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate } from "../_shared/auth.ts";
import { getPaystackSecretKey } from "../_shared/paystack.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";

const Schema = z.object({
  reference: z.string().min(5).max(200).regex(/^[A-Za-z0-9_-]+$/, "Invalid reference"),
  otp: z.string().trim().min(3).max(12).regex(/^[A-Za-z0-9]+$/, "Invalid OTP"),
});

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const buildErrorResponse = (
    status: number,
    payload: {
      error: string;
      userMessage: string;
      errorCode: string;
      promptSent?: boolean;
    },
    extraHeaders: Record<string, string> = {}
  ) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
    });

  // Rate limiting: 10 OTP attempts per 10 minutes per IP/User
  const ipClientId = getClientIdentifier(req, null);
  const ipCheck = checkRateLimit("submit-momo-otp", ipClientId, { maxRequests: 10, windowMs: 10 * 60 * 1000 });
  if (!ipCheck.allowed) {
    return buildErrorResponse(
      429,
      {
        error: "Too many OTP attempts",
        userMessage: "Too many OTP attempts. Please wait 10 minutes before trying again.",
        errorCode: "RATE_LIMIT_EXCEEDED",
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
        userMessage: "Please sign in to submit your Mobile Money OTP.",
        errorCode: "UNAUTHORIZED",
      });
    }

    const userClientId = getClientIdentifier(req, auth.userId);
    const userCheck = checkRateLimit("submit-momo-otp", userClientId, { maxRequests: 10, windowMs: 10 * 60 * 1000 });
    if (!userCheck.allowed) {
      return buildErrorResponse(
        429,
        {
          error: "Too many OTP attempts for this account",
          userMessage: "Too many OTP attempts. Please wait 10 minutes before trying again.",
          errorCode: "RATE_LIMIT_EXCEEDED",
          promptSent: false,
        },
        { "Retry-After": userCheck.resetInSec.toString() }
      );
    }

    const paystackSecretKey = getPaystackSecretKey();

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return buildErrorResponse(400, {
        error: "Invalid input",
        userMessage: "Enter the OTP code exactly as it was sent to your phone.",
        errorCode: "INVALID_INPUT",
      });
    }

    const { reference, otp } = parsed.data;

    const res = await fetch("https://api.paystack.co/charge/submit_otp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp, reference }),
    });
    const data = await res.json();
    console.log("Paystack /charge/submit_otp response:", JSON.stringify(data));

    const chargeStatus = data?.data?.status as string | undefined;
    const displayText = data?.data?.display_text as string | undefined;
    const gatewayMessage =
      data?.data?.gateway_response || data?.message || "Could not submit OTP";

    if (!data.status) {
      return buildErrorResponse(400, {
        error: gatewayMessage,
        userMessage: gatewayMessage || "The OTP couldn't be submitted. Please request a new code and try again.",
        errorCode: "OTP_SUBMIT_FAILED",
        promptSent: false,
      });
    }

    if (chargeStatus === "failed" || chargeStatus === "timeout") {
      return buildErrorResponse(400, {
        error: gatewayMessage,
        userMessage: gatewayMessage || "The OTP was rejected. Please retry the payment.",
        errorCode: "OTP_REJECTED",
        promptSent: false,
      });
    }

    const promptSent = ["pay_offline", "pending", "ongoing", "success"].includes(chargeStatus || "");

    return new Response(
      JSON.stringify({
        success: true,
        reference: data.data?.reference ?? reference,
        status: chargeStatus,
        display_text: displayText,
        promptSent,
        gateway_response: data.data?.gateway_response,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in submit-momo-otp:", error);
    return buildErrorResponse(500, {
      error: error?.message || "Unknown error",
      userMessage: "A network error occurred while submitting your OTP. Please try again.",
      errorCode: "SERVER_ERROR",
      promptSent: false,
    });
  }
};

serve(handler);
