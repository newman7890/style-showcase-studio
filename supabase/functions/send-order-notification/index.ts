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
    subject: "Your order has been shipped — Delivery Code Inside",
    heading: "Order Shipped 🚚",
    message: "Your order is on its way! When your rider arrives, please share the delivery code below to confirm receipt.",
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

const formatVariantText = (colorVal: any, sizeVal: any): string => {
  const parts: string[] = [];
  if (colorVal) {
    if (typeof colorVal === "string") parts.push(`Color: ${colorVal}`);
    else if (typeof colorVal === "object" && colorVal.name) parts.push(`Color: ${colorVal.name}`);
  }
  if (sizeVal) {
    parts.push(`Size: ${sizeVal}`);
  }
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-order-notification function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    if (!orderStatus || !statusMessages[orderStatus]) {
      console.log(`No email template for status: ${orderStatus}`);
      return new Response(
        JSON.stringify({ message: "No notification needed for this status" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    // Fetch order items with product details
    const { data: rawOrderItems } = await supabase
      .from("order_items")
      .select("*, products(name, image)")
      .eq("order_id", orderId);

    const orderItems = rawOrderItems || [];
    console.log(`Fetched ${orderItems.length} items for order ${order.id}`);

    const senderEmail = Deno.env.get("SENDER_EMAIL") || "Trades Point <info@tradespoint.store>";
    const siteUrl = "https://tradespoint.store";
    const trackingUrl = `${siteUrl}/track/${order.tracking_code}`;
    const shortOrderId = order.id.slice(0, 8).toUpperCase();
    const formattedDate = new Date(order.created_at || Date.now()).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const paymentMethodLabel = order.payment_method === "bank_card" 
      ? "Credit / Debit Card" 
      : "Mobile Money (MTN / Telecel / AT)";

    const results: any[] = [];

    // =========================================================================
    // EMAIL 1: PAYMENT INVOICE & RECEIPT (Sent on confirmed status)
    // =========================================================================
    if (orderStatus === "confirmed") {
      let itemsTableRows = "";
      let calculatedSubtotal = 0;

      for (const item of orderItems) {
        const itemUnitPrice = Number(item.price || 0);
        const itemQty = Number(item.quantity || 1);
        const lineTotal = itemUnitPrice * itemQty;
        calculatedSubtotal += lineTotal;

        const productName = (item as any).products?.name || "Product Item";
        const variantText = formatVariantText(item.selected_color, item.selected_size);

        itemsTableRows += `
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 12px 8px; font-size: 14px; color: #2d3748;">
              <strong>${escapeHtml(productName)}</strong>
              <span style="color: #718096; font-size: 12px;">${escapeHtml(variantText)}</span>
            </td>
            <td style="padding: 12px 8px; font-size: 14px; color: #4a5568; text-align: center;">${itemQty}</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #4a5568; text-align: right;">GH₵${itemUnitPrice.toFixed(2)}</td>
            <td style="padding: 12px 8px; font-size: 14px; font-weight: 600; color: #2d3748; text-align: right;">GH₵${lineTotal.toFixed(2)}</td>
          </tr>
        `;
      }

      const deliveryFee = Number(order.delivery_fee || 0);
      const discountAmount = Number(order.discount_amount || 0);
      const grandTotal = Number(order.total_amount || (calculatedSubtotal + deliveryFee - discountAmount));

      const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt & Official Invoice - Trades Point</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; background-color: #f7fafc; margin: 0; padding: 20px;">
          <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            
            <!-- Invoice Top Banner -->
            <div style="background: #0f172a; padding: 32px 28px; color: #ffffff;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <h2 style="margin: 0; font-size: 24px; font-weight: 800; color: #10b981; letter-spacing: -0.5px;">TRADES POINT</h2>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Official Payment Receipt & Tax Invoice</p>
                  </td>
                  <td style="text-align: right;">
                    <span style="background: #10b981; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; display: inline-block;">PAID ✅</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Receipt Meta Info Header -->
            <div style="background: #f8fafc; padding: 20px 28px; border-bottom: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Invoice Number:</td>
                  <td style="padding: 4px 0; font-weight: 700; color: #0f172a; text-align: right;">INV-${shortOrderId}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Date Paid:</td>
                  <td style="padding: 4px 0; font-weight: 600; color: #0f172a; text-align: right;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Payment Method:</td>
                  <td style="padding: 4px 0; font-weight: 600; color: #0f172a; text-align: right;">${escapeHtml(paymentMethodLabel)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Payment Reference:</td>
                  <td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: #10b981; text-align: right;">${escapeHtml(order.payment_reference || "N/A")}</td>
                </tr>
              </table>
            </div>

            <!-- Customer & Shipping Billing Box -->
            <div style="padding: 24px 28px;">
              <div style="background: #f1f5f9; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #475569;">Billed To / Delivery Destination</h4>
                <p style="margin: 2px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${escapeHtml(order.shipping_name)}</p>
                <p style="margin: 2px 0; font-size: 13px; color: #475569;">📞 ${escapeHtml(order.shipping_phone)} | ✉️ ${escapeHtml(order.shipping_email)}</p>
                <p style="margin: 2px 0; font-size: 13px; color: #475569;">📍 ${escapeHtml(order.shipping_address)}, ${escapeHtml(order.shipping_city)}, ${escapeHtml(order.shipping_region)} ${order.shipping_town ? `(${escapeHtml(order.shipping_town)})` : ""}</p>
              </div>

              <!-- Itemized Receipt Table -->
              <h4 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #475569;">Itemized Purchase Summary</h4>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">
                    <th style="padding: 8px;">Item Description</th>
                    <th style="padding: 8px; text-align: center;">Qty</th>
                    <th style="padding: 8px; text-align: right;">Price</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsTableRows || `
                    <tr>
                      <td style="padding: 12px 8px; font-size: 14px;">Order Items (#${shortOrderId})</td>
                      <td style="padding: 12px 8px; font-size: 14px; text-align: center;">1</td>
                      <td style="padding: 12px 8px; font-size: 14px; text-align: right;">GH₵${(grandTotal - deliveryFee).toFixed(2)}</td>
                      <td style="padding: 12px 8px; font-size: 14px; font-weight: 600; text-align: right;">GH₵${(grandTotal - deliveryFee).toFixed(2)}</td>
                    </tr>
                  `}
                </tbody>
              </table>

              <!-- Totals Breakdown Table -->
              <div style="background: #fafafa; border-radius: 12px; padding: 18px; border: 1px solid #f1f5f9;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr>
                    <td style="padding: 4px 0; color: #64748b;">Subtotal:</td>
                    <td style="padding: 4px 0; font-weight: 600; color: #0f172a; text-align: right;">GH₵${(calculatedSubtotal || (grandTotal - deliveryFee)).toFixed(2)}</td>
                  </tr>
                  ${discountAmount > 0 ? `
                  <tr>
                    <td style="padding: 4px 0; color: #ef4444;">Discount (${escapeHtml(order.discount_code || "Promo")}):</td>
                    <td style="padding: 4px 0; font-weight: 600; color: #ef4444; text-align: right;">-GH₵${discountAmount.toFixed(2)}</td>
                  </tr>
                  ` : ""}
                  <tr>
                    <td style="padding: 4px 0; color: #64748b;">Delivery Fee:</td>
                    <td style="padding: 4px 0; font-weight: 600; color: #0f172a; text-align: right;">GH₵${deliveryFee.toFixed(2)}</td>
                  </tr>
                  <tr style="border-top: 2px solid #e2e8f0;">
                    <td style="padding: 10px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a;">Total Amount Paid:</td>
                    <td style="padding: 10px 0 0 0; font-size: 18px; font-weight: 800; color: #10b981; text-align: right;">GH₵${grandTotal.toFixed(2)}</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Invoice Footer -->
            <div style="background: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
              <p style="margin: 0 0 4px 0; font-weight: 600;">Trades Point E-Commerce Store</p>
              <p style="margin: 0;">For invoice or payment inquiries, email <a href="mailto:info@tradespoint.store" style="color: #10b981; text-decoration: none;">info@tradespoint.store</a></p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        console.log(`Sending Payment Receipt & Invoice email to ${order.shipping_email}...`);
        const receiptRes = await resend.emails.send({
          from: senderEmail,
          to: [order.shipping_email],
          subject: `🧾 Payment Receipt & Official Invoice (Order #${shortOrderId}) - Trades Point`,
          html: receiptHtml,
        });
        results.push({ type: "receipt_invoice", res: receiptRes });
        console.log("Payment Receipt & Invoice sent successfully!");
      } catch (err: any) {
        console.error("Error sending Payment Receipt email:", err);
      }

      // 800ms delay to prevent Resend rate limits and ensure clean delivery
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // =========================================================================
    // EMAIL 2: ORDER INFORMATION & TRACKING CODE
    // =========================================================================
    const statusInfo = statusMessages[orderStatus];

    const orderInfoHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${statusInfo.subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7fafc;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800;">${escapeHtml(statusInfo.heading)}</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Order #${shortOrderId}</p>
          </div>
          
          <div style="padding: 30px 24px;">
            <p style="font-size: 16px; margin-bottom: 16px; color: #1e293b;">Hi <strong>${escapeHtml(order.shipping_name)}</strong>,</p>
            
            <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">${escapeHtml(statusInfo.message)}</p>
            
            <!-- Tracking Box -->
            <div style="background: #f0fdf4; border: 1.5px dashed #10b981; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #047857; font-weight: 700;">Your Order Tracking Code</p>
              <p style="margin: 0 0 14px 0; font-family: monospace; font-size: 26px; font-weight: 800; color: #065f46; letter-spacing: 2px;">${escapeHtml(order.tracking_code)}</p>
              <a href="${escapeHtml(trackingUrl)}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 26px; border-radius: 30px; font-weight: 700; font-size: 14px; shadow: 0 4px 12px rgba(16,185,129,0.3);">Track Your Order Live 🚀</a>
            </div>
            
            ${order.delivery_otp && (orderStatus === 'shipped' || orderStatus === 'confirmed') ? `
              <!-- Delivery OTP Box -->
              <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; color: white;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Delivery Confirmation Code (OTP)</p>
                <p style="color: #34d399; font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 6px; margin: 0 0 8px 0;">${escapeHtml(order.delivery_otp)}</p>
                <p style="color: #cbd5e1; font-size: 12px; margin: 0;">Please share this 6-digit code with your rider when they hand over your package.</p>
              </div>
            ` : ""}

            <!-- Shipping Summary -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
              <h4 style="margin: 0 0 10px 0; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Delivery Shipping Address</h4>
              <p style="margin: 3px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHtml(order.shipping_name)}</p>
              <p style="margin: 3px 0; font-size: 13px; color: #475569;">${escapeHtml(order.shipping_address)}</p>
              <p style="margin: 3px 0; font-size: 13px; color: #475569;">${escapeHtml(order.shipping_city)}, ${escapeHtml(order.shipping_region)} ${order.shipping_town ? `(${escapeHtml(order.shipping_town)})` : ""}</p>
            </div>
            
            <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
              Need help with your order? Reply directly to this email or visit <a href="${siteUrl}" style="color: #10b981; font-weight: 600;">tradespoint.store</a>.
            </p>
            
            <p style="color: #0f172a; font-size: 14px; font-weight: 600; margin-top: 16px;">
              Thank you for shopping with Trades Point!
            </p>
          </div>
          
          <div style="text-align: center; padding: 18px; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Trades Point. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending Order Information email to ${order.shipping_email}...`);
    const orderInfoRes = await resend.emails.send({
      from: senderEmail,
      to: [order.shipping_email],
      subject: `📦 Order Confirmed & Live Tracking Code (${order.tracking_code}) - Trades Point`,
      html: orderInfoHtml,
    });
    results.push({ type: "order_info", res: orderInfoRes });

    return new Response(JSON.stringify({ success: true, results }), {
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
