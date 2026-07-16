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
});

const buildErrorResponse = (
  status: number,
  payload: {
    error: string;
    userMessage: string;
    errorCode: string;
    fallback?: boolean;
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
        userMessage: "Please sign in to check your payment status.",
        errorCode: "UNAUTHORIZED",
        fallback: true,
        promptSent: false,
      });
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) throw new Error("Paystack secret key not configured");

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return buildErrorResponse(400, {
        error: "Invalid reference",
        userMessage: "We couldn't verify this payment because the payment reference is invalid.",
        errorCode: "INVALID_REFERENCE",
        fallback: true,
        promptSent: false,
      });
    }

    const { reference } = parsed.data;
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
    );
    const data = await res.json();

    if (!data?.status) {
      return buildErrorResponse(400, {
        error: data?.message || "Unable to verify payment",
        userMessage: "We couldn't confirm whether the Mobile Money prompt was sent or approved yet.",
        errorCode: "VERIFY_FAILED",
        fallback: true,
        promptSent: false,
      });
    }

    const status = data.data?.status as string | undefined;
    const gatewayResponse = data.data?.gateway_response as string | undefined;
    const displayText = data.data?.display_text as string | undefined;
    const requiresOtp = status === "send_otp";
    const promptSent = !["failed", "abandoned", "timeout", "send_otp", "send_phone", "send_birthday"].includes(status || "");
    let userMessage = gatewayResponse || displayText || "Waiting for confirmation from your Mobile Money provider.";

    if (status === "success") {
      userMessage = "Payment approved successfully.";
    } else if (requiresOtp) {
      userMessage = displayText || "Your provider sent an OTP to your phone. Enter the code to continue.";
    } else if (status === "pending" || status === "ongoing" || status === "pay_offline") {
      userMessage = "Approval request sent. Please check your phone and enter your Mobile Money PIN.";
    } else if (status === "failed") {
      userMessage = gatewayResponse || "The Mobile Money charge failed before approval was completed.";
    } else if (status === "abandoned") {
      userMessage = gatewayResponse || "The Mobile Money charge was not completed.";
    }

    return new Response(
      JSON.stringify({
        success: !!data.status,
        status,
        gateway_response: gatewayResponse,
        display_text: displayText,
        reference,
        requiresOtp,
        promptSent,
        userMessage,
        errorCode: requiresOtp ? "OTP_REQUIRED" : !promptSent ? "PROMPT_NOT_SENT" : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return buildErrorResponse(500, {
      error: msg,
      userMessage: "We couldn't check the Mobile Money payment status right now.",
      errorCode: "SERVER_ERROR",
      fallback: true,
      promptSent: false,
    });
  }
};

serve(handler);
