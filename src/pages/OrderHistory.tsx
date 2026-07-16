import { useEffect, useCallback, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Package, Clock, Truck, CheckCircle, AlertCircle, Copy, XCircle, RefreshCw, Wifi, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useOrders } from "@/hooks/useOrders";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Package }> = {
  pending: { label: "Pending", color: "bg-yellow-500", icon: Clock },
  processing: { label: "Processing", color: "bg-blue-500", icon: Package },
  shipped: { label: "Shipped", color: "bg-purple-500", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-500", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: AlertCircle },
  payment_failed: { label: "Payment Failed", color: "bg-red-600", icon: XCircle },
  refunded: { label: "Refunded", color: "bg-orange-500", icon: RefreshCw },
  refund_pending: { label: "Refund Pending", color: "bg-amber-500", icon: RefreshCw },
};

const OrderHistory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { orders, loading, refetchOrders } = useOrders();
  const { t } = useLanguage();
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

  const canRetryPayment = (status: string) =>
    ["cancelled", "payment_failed", "pending"].includes(status);

  // Set up realtime updates
  const handleRealtimeUpdate = useCallback(() => {
    refetchOrders();
  }, [refetchOrders]);

  useRealtimeOrders(user?.id, handleRealtimeUpdate);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyTrackingCode = (trackingCode: string) => {
    navigator.clipboard.writeText(trackingCode);
    toast.success("Tracking code copied!");
  };

  const retryPayment = async (order: any) => {
    setRetryingOrderId(order.id);
    try {
      await supabase
        .from("orders")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", order.id);

      const callbackUrl = `${window.location.origin}/payment/callback`;
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: {
          orderId: order.id,
          email: order.shipping_email,
          amount: order.total_amount,
          paymentMethod: "bank_card",
          callbackUrl,
        },
      });
      if (error) throw error;

      if (data.accessCode && (window as any).PaystackPop && data.publicKey) {
        const handler = (window as any).PaystackPop.setup({
          key: data.publicKey,
          email: order.shipping_email,
          amount: Math.round(order.total_amount * 100),
          currency: "GHS",
          ref: data.reference,
          channels: data.channels,
          callback: (response: any) => {
            const paidReference = response?.reference ?? data.reference;
            void (async () => {
              try {
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
                  "verify-payment",
                  { body: { reference: paidReference } }
                );
                if (verifyError) throw verifyError;
                if (verifyData?.success) {
                  toast.success("Payment approved!");
                  navigate(`/order-confirmation/${verifyData.orderId}`);
                } else {
                  toast.error(verifyData?.friendlyError || "Payment verification failed.");
                  refetchOrders();
                }
              } catch (err) {
                console.error("Verification error:", err);
                toast.error("Payment verification failed.");
                navigate(`/payment/callback?reference=${paidReference}`);
              }
            })();
          },
          onClose: () => {
            toast.error("Payment cancelled.");
            void supabase.functions.invoke("verify-payment", { body: { reference: data.reference } });
            refetchOrders();
            setRetryingOrderId(null);
          },
        });
        handler.openIframe();
        return;
      } else if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      } else {
        throw new Error("Failed to initialize payment");
      }
    } catch (error) {
      console.error("Retry payment error:", error);
      toast.error("Failed to initialize payment. Please try again.");
    } finally {
      setRetryingOrderId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-screen pb-20">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <div className="w-5 h-5 bg-muted animate-pulse rounded" />
            <div className="flex-1 flex justify-center">
              <div className="w-32 h-6 bg-muted animate-pulse rounded" />
            </div>
            <div className="w-5" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted animate-pulse rounded-2xl h-40" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            {t("orders")}
            <span title="Live updates enabled">
              <Wifi className="w-3 h-3 text-green-500 animate-pulse" />
            </span>
          </h1>
          <div className="w-5" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Package className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("orders")}</h2>
            <p className="text-muted-foreground mb-6 text-center">
              {t("startShopping")}
            </p>
            <Link to="/products">
              <Button size="lg" className="rounded-full">
                {t("continueShopping")}
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {formatDate(order.created_at)}
                      </p>
                      <p className="font-medium">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <Badge
                      className={`${status.color} text-white flex items-center gap-1`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </Badge>
                  </div>

                  {/* Tracking Code */}
                  {order.tracking_code && (
                    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono flex-1">
                        {order.tracking_code}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => copyTrackingCode(order.tracking_code!)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Link to={`/track?code=${order.tracking_code}`}>
                        <Button variant="outline" size="sm" className="h-8">
                          Track
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Order Items */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {order.order_items.length} item{order.order_items.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("total")}</p>
                      <p className="text-lg font-semibold">
                        {order.currency} {order.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("paymentMethod")}</p>
                      <p className="text-sm capitalize">
                        {order.payment_method.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>

                  {/* Shipping Info */}
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                    <p className="font-medium">{order.shipping_name}</p>
                    <p className="text-muted-foreground">
                      {order.shipping_address}, {order.shipping_city}, {order.shipping_region}
                    </p>
                  </div>

                  {/* Retry Payment */}
                  {canRetryPayment(order.status) && (
                    <Button
                      onClick={() => retryPayment(order)}
                      disabled={retryingOrderId === order.id}
                      className="w-full rounded-xl gap-2"
                      variant="outline"
                    >
                      {retryingOrderId === order.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Retry Payment
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default OrderHistory;
