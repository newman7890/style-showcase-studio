import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { authenticate } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const Schema = z.object({
  reference: z.string().min(5).max(200).regex(/^[A-Za-z0-9_\-]+$/, "Invalid reference"),
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

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) throw new Error("Paystack secret key not configured");

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

    // After OTP, provider typically sends the wallet PIN prompt.
    const promptSent = ["pay_offline", "pending", "ongoing", "success"].includes(chargeStatus || "");

    return new Response(
      JSON.stringify({
        success: true,
        reference: data.data?.reference ?? reference,
        status: chargeStatus,
        display_text: displayText,
        promptSent,
        completed: chargeStatus === "success",
        userMessage:
          displayText ||
          (chargeStatus === "success"
            ? "Payment approved successfully."
            : "OTP accepted. Check your phone for the Mobile Money PIN prompt."),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("submit-momo-otp error:", msg);
    return buildErrorResponse(500, {
      error: msg,
      userMessage: "We couldn't submit the OTP right now. Please try again shortly.",
      errorCode: "SERVER_ERROR",
    });
  }
};

serve(handler);
