import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { createNotification } from "@/services/notificationService";

const PaymentCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsCartClear, setNeedsCartClear] = useState(false);
  const { clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();

  const getFunctionErrorMessage = async (error: unknown) => {
    if (error && typeof error === "object" && "context" in error) {
      const response = (error as { context?: Response }).context;
      if (response && typeof response.json === "function") {
        try {
          const payload = await response.json();
          if (payload && typeof payload === "object") {
            const result = payload as { friendlyError?: unknown; error?: unknown; message?: unknown };
            if (typeof result.friendlyError === "string" && result.friendlyError.trim()) return result.friendlyError;
            if (typeof result.error === "string" && result.error.trim()) return result.error;
            if (typeof result.message === "string" && result.message.trim()) return result.message;
          }
        } catch {}
      }
    }
    if (error instanceof Error) return error.message;
    return null;
  };

  useEffect(() => {
    if (authLoading) return;

    const verifyPayment = async () => {
      const reference = searchParams.get("reference") || searchParams.get("trxref");
      
      if (!reference) {
        setErrorMessage("No payment reference found.");
        setStatus("failed");
        return;
      }

      try {
        // Ensure session token is attached explicitly
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { reference },
          headers,
        });

        if (error) {
          console.error("verify-payment edge function error:", error);
          const msg = await getFunctionErrorMessage(error);
          setErrorMessage(msg || "Failed to verify payment with server.");
          setStatus("failed");
          return;
        }

        if (data?.success) {
          // Payment approved - defer cart clearing until auth session is hydrated
          setOrderId(data.orderId);
          setNeedsCartClear(true);
          setStatus("success");

          if (user?.id) {
            createNotification({
              userId: user.id,
              title: "Payment Confirmed! 💳",
              message: `Your payment for order #${(data.orderId || "").substring(0, 8).toUpperCase()} was received successfully!`,
              type: "payment",
              orderId: data.orderId,
            });
          }
        } else {
          // Payment failed/cancelled - order has been reversed on the backend
          setErrorMessage(data?.friendlyError || "Your payment was not completed.");
          setStatus("failed");
        }
      } catch (error: any) {
        console.error("Payment verification error:", error);
        const msg = await getFunctionErrorMessage(error);
        setErrorMessage(msg || "An unexpected error occurred while verifying payment.");
        setStatus("failed");
      }
    };

    verifyPayment();
  }, [searchParams, authLoading]);

  // Clear cart once auth is ready and we have a signed-in user.
  useEffect(() => {
    if (!needsCartClear || authLoading) return;
    clearCart().finally(() => setNeedsCartClear(false));
  }, [needsCartClear, authLoading, clearCart]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Verifying Payment</h1>
          <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
        </motion.div>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Payment Approved! ✅</h1>
          <p className="text-muted-foreground mb-8">
            Your payment has been confirmed and your order has been placed successfully. You will receive a notification shortly.
          </p>
          <div className="space-y-3">
            {orderId && (
              <Button
                size="lg"
                className="w-full rounded-full"
                onClick={() => navigate(`/order-confirmation/${orderId}`)}
              >
                View Order Details
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-full"
              onClick={() => navigate("/orders")}
            >
              View All Orders
            </Button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
        </motion.div>
        <h1 className="text-2xl font-bold mb-2">Payment Status</h1>
        <p className="text-muted-foreground mb-4">
          {errorMessage || "Your payment was not completed. The order has been cancelled and no charges were made. Your cart items are still saved."}
        </p>
        <p className="text-xs text-muted-foreground/70 mb-8">
          If money was deducted from your account, please check your Order History or contact support with your payment reference.
        </p>
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full rounded-full"
            onClick={() => navigate("/checkout")}
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full rounded-full"
            onClick={() => navigate("/orders")}
          >
            Check Order History
          </Button>
        </div>
      </motion.div>
    </main>
  );
};

export default PaymentCallback;
