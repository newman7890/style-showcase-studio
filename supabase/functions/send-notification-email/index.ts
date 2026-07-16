import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate, hasRole, escapeHtml, SUPABASE_URL, SERVICE_ROLE_KEY } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hard-coded template dictionary — never accept freeform HTML from clients.
const TEMPLATES: Record<string, { subject: string; heading: string; body: string }> = {
  orderUpdate: {
    subject: "Update on your order",
    heading: "Order Update",
    body: "There's a new update on one of your recent orders. Sign in to your account to view full details.",
  },
  promotion: {
    subject: "A promotion you might like",
    heading: "Special Offer",
    body: "We have a new promotion available in your account. Sign in to learn more.",
  },
  newArrival: {
    subject: "New arrivals are here",
    heading: "Fresh Arrivals",
    body: "New items just landed in our store. Sign in to be the first to shop them.",
  },
  priceDrop: {
    subject: "A price just dropped",
    heading: "Price Drop",
    body: "An item from your favorites or recent activity has dropped in price. Sign in to check it out.",
  },
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an admin caller — never accept user-supplied HTML in emails.
    const auth = await authenticate(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!(await hasRole(auth.userId, "admin"))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, type } = (await req.json()) as { userId?: string; type?: string };

    if (!userId || !type || !TEMPLATES[type]) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, notification_settings")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settings = (profile.notification_settings || {}) as Record<string, boolean>;
    const settingsKeyMap: Record<string, string> = {
      orderUpdate: "orderUpdates",
      promotion: "promotions",
      newArrival: "newArrivals",
      priceDrop: "priceDrops",
    };
    const settingsKey = settingsKeyMap[type];

    if (!settings.emailNotifications) {
      return new Response(JSON.stringify({ message: "Email notifications disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (settingsKey && !settings[settingsKey]) {
      return new Response(JSON.stringify({ message: `${type} notifications disabled` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tpl = TEMPLATES[type];
    const safeName = escapeHtml(profile.full_name || "");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 40px;">
            <h1 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 24px 0;">${escapeHtml(tpl.heading)}</h1>
            <div style="color: #52525b; font-size: 16px; line-height: 1.6;">
              ${safeName ? `<p>Hello ${safeName},</p>` : "<p>Hello,</p>"}
              <p>${escapeHtml(tpl.body)}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              You're receiving this email because you have ${escapeHtml(type)} notifications enabled.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "StitchKit <notifications@resend.dev>",
        to: [profile.email],
        subject: tpl.subject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Error sending email:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-notification-email error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
