import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate } from "../_shared/auth.ts";
import { getPaystackSecretKey } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiting: 10 OTP attempts per 10 minutes per user/IP
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function checkOtpRateLimit(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(key) || []).filter((t) => t > windowStart);
  if (timestamps.length >= MAX_ATTEMPTS) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

const Schema = z.object({
  reference: z.string().min(5).max(200).regex(/^[A-Za-z0-9_-]+$/, "Invalid reference"),
  otp: z.string().trim().min(3).max(12).regex(/^[A-Za-z0-9]+$/, "Invalid OTP"),
});

const buildErrorResponse = (
  status: number,
  payload: {
    error: string;
    userMessage: string;
    errorCode: string;
    promptSent?: boolean;
  }
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth) {
      return buildErrorResponse(401, {
        error: "Unauthorized",
        userMessage: "Please sign in to submit your Mobile Money OTP.",
        errorCode: "UNAUTHORIZED",
      });
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip";
    const rateLimitKey = `${auth.userId}_${clientIp}`;

    if (!checkOtpRateLimit(rateLimitKey)) {
      return buildErrorResponse(429, {
        error: "Too many attempts",
        userMessage: "Too many incorrect OTP attempts. Please wait a few minutes before trying again.",
        errorCode: "RATE_LIMITED",
        promptSent: false,
      });
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
