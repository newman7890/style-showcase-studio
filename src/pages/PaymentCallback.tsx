import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";

const PaymentCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [needsCartClear, setNeedsCartClear] = useState(false);
  const { clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get("reference");
      
      if (!reference) {
        setStatus("failed");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { reference },
        });

        if (error) throw error;

        if (data.success) {
          // Payment approved - defer cart clearing until auth session is hydrated
          setOrderId(data.orderId);
          setNeedsCartClear(true);
          setStatus("success");
        } else {
          // Payment failed/cancelled - order has been reversed on the backend
          setStatus("failed");
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("failed");
      }
    };

    verifyPayment();
  }, [searchParams]);

  // Clear cart once auth is ready and we have a signed-in user.
  useEffect(() => {
    if (!needsCartClear || authLoading || !user) return;
    clearCart().finally(() => setNeedsCartClear(false));
  }, [needsCartClear, authLoading, user, clearCart]);

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
        <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
        <p className="text-muted-foreground mb-8">
          Your payment was not completed. The order has been cancelled and no charges were made. Your cart items are still saved.
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
            onClick={() => navigate("/products")}
          >
            Continue Shopping
          </Button>
        </div>
      </motion.div>
    </main>
  );
};

export default PaymentCallback;
