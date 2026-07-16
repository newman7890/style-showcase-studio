import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, hasRole, isServiceRoleCall, escapeHtml } from "../_shared/auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderNotificationRequest {
  orderId: string;
  newStatus?: string;
  status?: string;
}

const statusMessages: Record<string, { subject: string; heading: string; message: string }> = {
  processing: {
    subject: "Your order is being processed",
    heading: "Order Processing 📦",
    message: "Great news! We've started processing your order. Our team is preparing your items for shipment.",
  },
  shipped: {
    subject: "Your order has been shipped",
    heading: "Order Shipped 🚚",
    message: "Your order is on its way! You can track your package using the tracking code below.",
  },
  delivered: {
    subject: "Your order has been delivered",
    heading: "Order Delivered ✅",
    message: "Your order has been delivered! We hope you enjoy your purchase. Thank you for shopping with us!",
  },
  payment_failed: {
    subject: "Payment failed for your order",
    heading: "Payment Failed ❌",
    message: "Unfortunately, the payment for your order could not be processed. Please try again or use a different payment method.",
  },
  refunded: {
    subject: "Your order has been refunded",
    heading: "Order Refunded 💰",
    message: "Your refund has been processed successfully. The amount will be credited to your account within 5-10 business days.",
  },
  refund_pending: {
    subject: "Your refund is being processed",
    heading: "Refund Processing ⏳",
    message: "We've initiated a refund for your order. Please allow 5-10 business days for the amount to be credited to your account.",
  },
  cancelled: {
    subject: "Your order has been cancelled",
    heading: "Order Cancelled ❌",
    message: "Your order has been cancelled. If you did not request this cancellation, please contact our support team.",
  },
  confirmed: {
    subject: "Your order has been confirmed",
    heading: "Order Confirmed ✅",
    message: "Your order has been confirmed and will be processed shortly. Thank you for shopping with us!",
  },
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-order-notification function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow trusted server-to-server callers (paystack-webhook, db trigger using service role)
  // OR authenticated admin users. Reject everyone else.
  const trusted = isServiceRoleCall(req);
  if (!trusted) {
    const auth = await authenticate(req);
    if (!auth || !(await hasRole(auth.userId, "admin"))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  try {
    const { orderId, newStatus, status }: OrderNotificationRequest = await req.json();
    const orderStatus = newStatus || status;
    console.log(`Processing notification for order ${orderId} with status ${orderStatus}`);

    // Skip notification for statuses we don't send emails for
    if (!orderStatus || !statusMessages[orderStatus]) {
      console.log(`No email template for status: ${orderStatus}`);
      return new Response(
        JSON.stringify({ message: "No notification needed for this status" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Error fetching order:", orderError);
      throw new Error("Order not found");
    }

    console.log(`Order found: ${order.id}, email: ${order.shipping_email}, tracking: ${order.tracking_code}`);

    const statusInfo = statusMessages[orderStatus];
    const trackingUrl = `${req.headers.get("origin") || "https://your-domain.com"}/track/${order.tracking_code}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${statusInfo.subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${escapeHtml(statusInfo.heading)}</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${escapeHtml(order.shipping_name)},</p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">${escapeHtml(statusInfo.message)}</p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e9ecef;">
            <h3 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; text-transform: uppercase;">Order Details</h3>
            <p style="margin: 5px 0;"><strong>Order ID:</strong> #${escapeHtml(order.id.slice(0, 8).toUpperCase())}</p>
            <p style="margin: 5px 0;"><strong>Tracking Code:</strong> <span style="font-family: monospace; background: #e9ecef; padding: 2px 8px; border-radius: 4px;">${escapeHtml(order.tracking_code)}</span></p>
            <p style="margin: 5px 0;"><strong>Total:</strong> GH₵${escapeHtml(Number(order.total_amount).toFixed(2))}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(trackingUrl)}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">Track Your Order</a>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e9ecef;">
            <h3 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; text-transform: uppercase;">Shipping Address</h3>
            <p style="margin: 5px 0;">${escapeHtml(order.shipping_name)}</p>
            <p style="margin: 5px 0;">${escapeHtml(order.shipping_address)}</p>
            <p style="margin: 5px 0;">${escapeHtml(order.shipping_city)}, ${escapeHtml(order.shipping_region)}</p>
          </div>
          
          <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
            If you have any questions about your order, please don't hesitate to contact us.
          </p>
          
          <p style="color: #6c757d; font-size: 14px;">
            Thank you for shopping with us!
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Your Store. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Order Updates <onboarding@resend.dev>",
      to: [order.shipping_email],
      subject: statusInfo.subject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-order-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
