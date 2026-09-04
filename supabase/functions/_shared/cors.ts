/**
 * Hardened CORS Helper for Supabase Edge Functions
 * Replaces permissive wildcard '*' with strict origin validation
 */

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  let isAllowed = !origin; // Mobile native apps (Flutter) or server webhooks have no Origin header

  if (origin) {
    if (origin.startsWith("capacitor://") || origin.startsWith("ionic://")) {
      isAllowed = true;
    } else {
      try {
        const parsedUrl = new URL(origin);
        const host = parsedUrl.hostname.toLowerCase();
        isAllowed =
          host === "localhost" ||
          host === "127.0.0.1" ||
          host === "tradespoint.app" ||
          host.endsWith(".tradespoint.app") ||
          host === "tradespoint.com" ||
          host.endsWith(".tradespoint.com") ||
          host.endsWith(".vercel.app");
      } catch {
        isAllowed = false;
      }
    }
  }

  const allowedOrigin = isAllowed ? (origin || "*") : "null";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-paystack-signature",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
