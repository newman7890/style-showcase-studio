import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, hasRole, isServiceRoleCall, SUPABASE_URL, SERVICE_ROLE_KEY } from "../_shared/auth.ts";
import { getPaystackSecretKey, getPaystackKeys } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  sellerId?: string; // seller_profiles.id or seller_profiles.user_id
}

const handler = async (req: Request): Promise<Response> => {
  console.log("create-paystack-subaccount function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = getPaystackSecretKey();

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

    // If subaccount code already exists, return it
    if (profile.paystack_subaccount_code) {
      return new Response(
        JSON.stringify({
          success: true,
          subaccount_code: profile.paystack_subaccount_code,
          message: "Paystack subaccount already exists",
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

    let bankCode = profile.bank_code || "";
    
    // If payout method is momo (or no bank_code), use momo_provider mapping
    if (!bankCode && profile.momo_provider) {
      bankCode = momoProviderMap[profile.momo_provider] || profile.momo_provider.toUpperCase();
    }
    
    // Default to MTN if nothing is set
    if (!bankCode) {
      bankCode = "MTN";
    }
    bankCode = bankCode.trim();

    const accountNumber = (
      profile.account_number ||
      profile.momo_number ||
      ""
    ).trim();

    if (!accountNumber) {
      return new Response(
        JSON.stringify({
          error: "Missing settlement account number or mobile money number",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const businessName = (
      profile.business_name ||
      profile.store_name ||
      "Seller Store"
    ).trim();

    const percentageCharge = profile.commission_override != null
      ? Number(profile.commission_override)
      : 10;

    const paystackPayload: Record<string, unknown> = {
      business_name: businessName,
      bank_code: bankCode,
      account_number: accountNumber,
      percentage_charge: percentageCharge,
    };

    if (profile.email) {
      paystackPayload.primary_contact_email = profile.email;
    }
    if (profile.phone) {
      paystackPayload.primary_contact_phone = profile.phone;
    }

    console.log("Creating Paystack subaccount with payload:", JSON.stringify(paystackPayload));

    const paystackRes = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();
    console.log("Paystack subaccount response:", JSON.stringify(paystackData));

    if (!paystackRes.ok || !paystackData.status) {
      const activeKeyInfo = getPaystackKeys();
      const prefix = activeKeyInfo.secretKey.substring(0, 10);
      throw new Error(`${paystackData.message || "Failed to create Paystack subaccount."} [Key Secret: ${activeKeyInfo.sourceName}, Prefix: ${prefix}...]`);
    }

    const subaccountCode = paystackData.data.subaccount_code;

    // Update seller_profiles with paystack_subaccount_code
    const { error: updateErr } = await adminClient
      .from("seller_profiles")
      .update({
        paystack_subaccount_code: subaccountCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (updateErr) {
      console.error("Error updating seller profile subaccount code:", updateErr);
      throw new Error("Subaccount created on Paystack but failed to save in database");
    }

    return new Response(
      JSON.stringify({
        success: true,
        subaccount_code: subaccountCode,
        paystack_data: paystackData.data,
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
        status: 200, // Return 200 so frontend can parse the actual error string instead of failing blindly
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
