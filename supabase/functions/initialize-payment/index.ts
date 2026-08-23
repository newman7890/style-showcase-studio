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

    // Check if order items belong to a seller with a Paystack Subaccount for Split Payment
    let sellerSubaccountCode: string | null = null;
    let totalCommissionInPesewas = 0;

    const { data: orderItems } = await auth.client
      .from("order_items")
      .select("seller_id, commission_amount")
      .eq("order_id", orderId);

    if (orderItems && orderItems.length > 0) {
      const primarySellerId = orderItems.find(item => item.seller_id)?.seller_id;
      if (primarySellerId) {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        const { data: sellerProfile } = await adminClient
          .from("seller_profiles")
          .select("id, paystack_subaccount_code, momo_number, momo_provider, bank_code, account_number, business_name, store_name, email, phone, commission_override")
          .eq("user_id", primarySellerId)
          .maybeSingle();

        if (sellerProfile) {
          if (sellerProfile.paystack_subaccount_code) {
            sellerSubaccountCode = sellerProfile.paystack_subaccount_code;
          } else {
            // Auto-create Paystack subaccount on the fly if seller has payout details!
            try {
              const paystackSecretKey = allKeys[0]?.secretKey || Deno.env.get("PAYSTACK_SECRET_KEY");
              if (paystackSecretKey) {
                const momoProviderMap: Record<string, string> = {
                  "mtn": "MTN", "MTN": "MTN", "mtn_momo": "MTN",
                  "vodafone": "VOD", "vod": "VOD", "VOD": "VOD", "telecel": "VOD", "telecel_cash": "VOD",
                  "airteltigo": "ATL", "atl": "ATL", "ATL": "ATL", "tigo": "ATL", "tigo_cash": "ATL"
                };
                let bankCode = sellerProfile.bank_code || "";
                if (!bankCode && sellerProfile.momo_provider) {
                  bankCode = momoProviderMap[sellerProfile.momo_provider] || sellerProfile.momo_provider.toUpperCase();
                }
                if (!bankCode) bankCode = "MTN";

                const accountNumber = (sellerProfile.account_number || sellerProfile.momo_number || "").trim();
                if (accountNumber) {
                  const businessName = (sellerProfile.business_name || sellerProfile.store_name || "Seller Store").trim();
                  const percentageCharge = sellerProfile.commission_override != null ? Number(sellerProfile.commission_override) : 10;

                  const subPayload: Record<string, unknown> = {
                    business_name: businessName,
                    bank_code: bankCode.trim(),
                    account_number: accountNumber,
                    percentage_charge: percentageCharge,
                  };
                  if (sellerProfile.email) subPayload.primary_contact_email = sellerProfile.email;
                  if (sellerProfile.phone) subPayload.primary_contact_phone = sellerProfile.phone;

                  console.log("Auto-creating Paystack subaccount for seller:", primarySellerId);
                  const subRes = await fetch("https://api.paystack.co/subaccount", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${paystackSecretKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(subPayload),
                  });
                  const subData = await subRes.json();
                  if (subRes.ok && subData.status && subData.data?.subaccount_code) {
                    sellerSubaccountCode = subData.data.subaccount_code;
                    await adminClient
                      .from("seller_profiles")
                      .update({ paystack_subaccount_code: sellerSubaccountCode, updated_at: new Date().toISOString() })
                      .eq("id", sellerProfile.id);
                    console.log("Subaccount created & saved on-the-fly:", sellerSubaccountCode);
                  } else {
                    console.warn("On-the-fly subaccount creation notice:", subData.message);
                  }
                }
              }
            } catch (subErr) {
              console.error("Error in on-the-fly subaccount creation:", subErr);
            }
          }

          if (sellerSubaccountCode) {
            const totalCommissionGHS = orderItems.reduce((acc, item) => acc + (Number(item.commission_amount) || 0), 0);
            totalCommissionInPesewas = Math.round(totalCommissionGHS * 100);
            console.log(`Split payment active: Subaccount ${sellerSubaccountCode}, Transaction Charge (Platform Commission): ${totalCommissionInPesewas} pesewas`);
          }
        }
      }
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

    if (sellerSubaccountCode) {
      paystackPayload.subaccount = sellerSubaccountCode;
      if (totalCommissionInPesewas > 0) {
        paystackPayload.transaction_charge = totalCommissionInPesewas;
      }
    }

    if (mobileMoneyProvider && normalizedMobileNumber) {
      paystackPayload.mobile_money = {
        phone: normalizedMobileNumber,
        provider: mobileMoneyProvider,
      };
    }

    const allKeys = getAllPaystackSecretKeys();
    console.log(`Found ${allKeys.length} configured Paystack secret keys.`);

    let paystackData: any = null;
    let successfulKeyConfig = allKeys[0];
    let lastPaystackError = "";

    for (const keyConfig of allKeys) {
      console.log(`Trying Paystack secret key from source: ${keyConfig.sourceName} (prefix: ${keyConfig.secretKey.substring(0, 7)}...)`);
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
        console.log(`Paystack response for ${keyConfig.sourceName}:`, JSON.stringify(resData));

        if (resData.status) {
          paystackData = resData;
          successfulKeyConfig = keyConfig;
          break;
        } else {
          lastPaystackError = resData.message || "Failed to initialize payment";
          console.warn(`Paystack key ${keyConfig.sourceName} rejected: ${lastPaystackError}`);
        }
      } catch (err) {
        console.error(`Fetch error with key ${keyConfig.sourceName}:`, err);
      }
    }

    if (!paystackData || !paystackData.status) {
      throw new Error(lastPaystackError || "Paystack payment initialization failed across all configured keys.");
    }

    console.log(`Payment initialized successfully using ${successfulKeyConfig.sourceName}. Reference: ${paystackData.data.reference}`);

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
