import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

interface PaystackEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    metadata?: {
      order_id?: string;
    };
    customer?: {
      email?: string;
    };
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    // Get the request body
    const body = await req.text();
    
    // Verify Paystack signature using Web Crypto API — REQUIRED
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.log("Missing x-paystack-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(paystackSecretKey),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSignature) {
      console.log("Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event: PaystackEvent = JSON.parse(body);
    console.log("Paystack webhook event received:", event.event);
    console.log("Event data:", JSON.stringify(event.data));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderId = event.data.metadata?.order_id;

    switch (event.event) {
      case "charge.success": {
        // Payment confirmed - mark order as confirmed
        if (orderId) {
          const { error } = await supabase
            .from("orders")
            .update({ 
              status: "confirmed",
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (error) {
            console.error("Error updating order status:", error);
          } else {
            console.log(`Order ${orderId} payment confirmed`);
          }
        }
        break;
      }

      case "charge.failed": {
        // Payment failed - cancel/reverse the order
        if (orderId) {
          const { error } = await supabase
            .from("orders")
            .update({ 
              status: "cancelled",
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (error) {
            console.error("Error cancelling order:", error);
          } else {
            console.log(`Order ${orderId} cancelled due to failed payment`);
          }
        }
        break;
      }

      case "refund.processed":
      case "refund.pending": {
        // Refund was processed or is pending
        if (orderId) {
          const refundStatus = event.event === "refund.processed" ? "refunded" : "refund_pending";
          const { error } = await supabase
            .from("orders")
            .update({ 
              status: refundStatus,
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (error) {
            console.error("Error updating order status:", error);
          } else {
            console.log(`Order ${orderId} marked as ${refundStatus}`);
            
            // Trigger notification
            try {
              await supabase.functions.invoke("send-order-notification", {
                body: { orderId, status: refundStatus },
              });
            } catch (notifError) {
              console.error("Error sending notification:", notifError);
            }
          }
        }
        break;
      }

      case "refund.failed": {
        // Refund failed
        console.log(`Refund failed for order ${orderId}`);
        break;
      }

      case "transfer.success":
      case "transfer.failed":
      case "transfer.reversed": {
        // Handle transfer events (for payouts)
        console.log(`Transfer event: ${event.event}`, event.data);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
