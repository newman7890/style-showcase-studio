import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, hasRole, isServiceRoleCall, SUPABASE_URL, SERVICE_ROLE_KEY } from "../_shared/auth.ts";
import { getAllPaystackSecretKeysAsync, getPaystackSecretKeyAsync, getPaystackKeysAsync } from "../_shared/paystack.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkGlobalRateLimitAsync, getClientIdentifier } from "../_shared/rateLimit.ts";

interface RequestBody {
  sellerId?: string; // seller_profiles.id or seller_profiles.user_id
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify caller authentication or service role call
    let callerUserId: string | null = null;
    let isAdmin = false;

    if (!isServiceRoleCall(req)) {
      const auth = await authenticate(req);
      if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      callerUserId = auth.userId;
      isAdmin = await hasRole(callerUserId, "admin");
    }

    // Rate Limiting (15 attempts per 10 minutes)
    const clientId = getClientIdentifier(req, callerUserId);
    const rateCheck = await checkGlobalRateLimitAsync(adminClient, "create-subaccount", clientId, { maxRequests: 15, windowMs: 10 * 60 * 1000 });
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Too many subaccount requests. Please wait." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": rateCheck.resetInSec.toString() },
      });
    }

    const allKeys = await getAllPaystackSecretKeysAsync();
    let paystackSecretKey = allKeys[0]?.secretKey || "";

    const body: RequestBody = await req.json().catch(() => ({}));
    const targetId = body.sellerId || callerUserId;

    if (!targetId) {
      return new Response(JSON.stringify({ error: "Seller ID or User ID is required" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch target seller profile
    const { data: profile, error: fetchErr } = await adminClient
      .from("seller_profiles")
      .select("*")
      .or(`id.eq.${targetId},user_id.eq.${targetId}`)
      .maybeSingle();

    if (fetchErr || !profile) {
      return new Response(JSON.stringify({ error: "Seller profile not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check authorization: caller must be admin or the profile owner
    if (callerUserId && !isAdmin && profile.user_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden: Cannot manage another seller profile" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // If a REAL Paystack subaccount code already exists (not a local placeholder), return it
    const existingCode = profile.paystack_subaccount_code || "";
    const isPlaceholder = existingCode.startsWith("ACCT_LOCAL_") || existingCode.startsWith("ACCT_PENDING_");
    if (existingCode && !isPlaceholder) {
      return new Response(
        JSON.stringify({
          success: true,
          subaccount_code: existingCode,
          is_real: true,
          message: "Paystack subaccount already exists",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fallback if no valid Paystack key configured: assign local subaccount code so seller approval never gets blocked!
    if (allKeys.length === 0) {
      const fallbackCode = `ACCT_LOCAL_${profile.id.substring(0, 8).toUpperCase()}`;
      await adminClient
        .from("seller_profiles")
        .update({
          paystack_subaccount_code: fallbackCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      return new Response(
        JSON.stringify({
          success: true,
          subaccount_code: fallbackCode,
          is_real: false,
          paystack_error: "No Paystack API key configured in Supabase secrets or Platform Settings.",
          message: "Seller approved with local code. Please configure Paystack secret key to enable automated split payments.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Determine payout bank & account details
    // Paystack Ghana mobile money codes: "MTN" for MTN, "VOD" for Telecel/Vodafone, "ATL" for AirtelTigo
    const momoProviderMap: Record<string, string> = {
      "mtn": "MTN",
      "MTN": "MTN",
      "mtn_momo": "MTN",
      "vodafone": "VOD",
      "vod": "VOD",
      "VOD": "VOD",
      "telecel": "VOD",
      "telecel_cash": "VOD",
      "airteltigo": "ATL",
      "atl": "ATL",
      "ATL": "ATL",
      "tigo": "ATL",
      "tigo_cash": "ATL",
    };

    let bankCode = "";
    let rawAccount = "";

    const isMoMo = profile.payout_method === "momo" || (!profile.bank_code && (profile.momo_number || profile.momo_provider));

    if (isMoMo) {
      rawAccount = (profile.momo_number || profile.account_number || "").trim();
      const providerKey = (profile.momo_provider || "mtn").toLowerCase().trim();
      bankCode = momoProviderMap[providerKey] || "MTN";
    } else {
      rawAccount = (profile.account_number || profile.momo_number || "").trim();
      bankCode = (profile.bank_code || "").trim();
      if (!bankCode && profile.momo_provider) {
        bankCode = momoProviderMap[profile.momo_provider.toLowerCase()] || "MTN";
      }
    }

    if (!bankCode) {
      bankCode = "MTN";
    }

    if (!rawAccount) {
      return new Response(
        JSON.stringify({
          error: "Missing settlement account number or mobile money number in seller profile",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Clean account number / mobile number
    let cleanAccount = rawAccount.replace(/[\s\-\(\)]/g, "");
    if (isMoMo || ["MTN", "VOD", "ATL"].includes(bankCode)) {
      if (cleanAccount.startsWith("+233")) {
        cleanAccount = "0" + cleanAccount.slice(4);
      } else if (cleanAccount.startsWith("233") && cleanAccount.length === 12) {
        cleanAccount = "0" + cleanAccount.slice(3);
      }
    }

    const businessName = (
      profile.business_name ||
      profile.store_name ||
      "Seller Store"
    ).trim();

    const percentageCharge = profile.commission_override != null
      ? Number(profile.commission_override)
      : 10;

    // Paystack Ghana Subaccount API requires settlement_bank (e.g. 'MTN', 'VOD', 'ATL', or bank code)
    const paystackPayload: Record<string, unknown> = {
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: cleanAccount,
      percentage_charge: percentageCharge,
      description: `Seller payout subaccount for ${businessName}`,
    };

    if (profile.email) {
      paystackPayload.primary_contact_email = profile.email;
    }
    if (profile.phone) {
      paystackPayload.primary_contact_phone = profile.phone;
    }

    console.log("Creating Paystack subaccount with payload:", JSON.stringify(paystackPayload));

    let subaccountCode = "";
    let paystackError = "";
    let paystackRawResponse: any = null;

    // Try creating subaccount with available keys
    for (const keyCfg of allKeys) {
      try {
        console.log(`Calling Paystack subaccount API using key from ${keyCfg.sourceName}...`);
        const paystackRes = await fetch("https://api.paystack.co/subaccount", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${keyCfg.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paystackPayload),
        });

        const paystackData = await paystackRes.json();
        paystackRawResponse = paystackData;
        console.log("Paystack subaccount response:", JSON.stringify(paystackData));

        if (paystackRes.ok && paystackData.status && paystackData.data?.subaccount_code) {
          subaccountCode = paystackData.data.subaccount_code;
          paystackSecretKey = keyCfg.secretKey;
          break;
        } else {
          paystackError = paystackData.message || `Paystack API returned status ${paystackRes.status}`;
        }
      } catch (paystackErr: any) {
        paystackError = paystackErr?.message || "Network error calling Paystack API";
        console.warn(`Paystack API call failed with key ${keyCfg.sourceName}:`, paystackErr);
      }
    }

    // If external call didn't return a subaccount_code, fallback gracefully so seller approval completes cleanly
    if (!subaccountCode) {
      subaccountCode = `ACCT_PENDING_${profile.id.substring(0, 8).toUpperCase()}`;
    }

    // Update seller_profiles with subaccount_code
    await adminClient
      .from("seller_profiles")
      .update({
        paystack_subaccount_code: subaccountCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    const isRealCode = !subaccountCode.startsWith("ACCT_PENDING_") && !subaccountCode.startsWith("ACCT_LOCAL_");

    return new Response(
      JSON.stringify({
        success: isRealCode,
        subaccount_code: subaccountCode,
        is_real: isRealCode,
        message: isRealCode
          ? "Paystack subaccount created successfully!"
          : `Seller approved with temporary code (${subaccountCode}). Paystack response: ${paystackError}`,
        paystack_error: isRealCode ? null : (paystackError || null),
        debug: {
          key_prefix: paystackSecretKey ? paystackSecretKey.substring(0, 12) + "..." : "NO_KEY",
          payload_sent: paystackPayload,
          paystack_response: paystackRawResponse,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in create-paystack-subaccount function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
