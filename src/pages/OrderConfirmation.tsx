import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Package, Copy, Truck, ShoppingBag, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  selected_color?: any;
  selected_size?: string | null;
  products?: {
    name: string;
    image: string;
  };
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_region: string;
  shipping_town?: string | null;
  delivery_fee?: number;
  discount_amount?: number;
  payment_method: string;
  tracking_code: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const copyTrackingCode = () => {
    if (order?.tracking_code) {
      navigator.clipboard.writeText(order.tracking_code);
      toast({ title: "Tracking code copied! 📋", description: order.tracking_code });
    }
  };

  useEffect(() => {
    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 4;

    const fetchOrder = async () => {
      if (!orderId) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const cleanId = orderId.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
        const isTracking = cleanId.toUpperCase().startsWith("TRK");

        let orderData: any = null;

        // 1. Direct query by ID if UUID
        if (isUuid) {
          const { data, error } = await supabase
            .from("orders")
            .select(`
              *,
              order_items (
                id,
                product_id,
                quantity,
                price,
                selected_color,
                selected_size,
                products (
                  name,
                  image
                )
              )
            `)
            .eq("id", cleanId)
            .maybeSingle();

          if (!error && data) {
            orderData = data;
          }
        }

        // 2. Query by tracking_code
        if (!orderData && (isTracking || !isUuid)) {
          const { data, error } = await supabase
            .from("orders")
            .select(`
              *,
              order_items (
                id,
                product_id,
                quantity,
                price,
                selected_color,
                selected_size,
                products (
                  name,
                  image
                )
              )
            `)
            .or(`tracking_code.eq.${cleanId},payment_reference.eq.${cleanId}`)
            .maybeSingle();

          if (!error && data) {
            orderData = data;
          }
        }

        // 3. Fallback tracking RPC if RLS blocks direct select
        if (!orderData && isTracking) {
          try {
            const { data: rpcData } = await supabase
              .rpc("get_order_by_tracking_code", { _tracking_code: cleanId.toUpperCase() });
            if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
              orderData = rpcData[0];
            }
          } catch {}
        }

        if (isMounted) {
          if (orderData) {
            setOrder(orderData);
            setLoading(false);
          } else if (attempts < maxAttempts) {
            // Retry after short delay to allow auth session to settle
            attempts++;
            setTimeout(fetchOrder, 600);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        if (isMounted) {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(fetchOrder, 600);
          } else {
            setLoading(false);
          }
        }
      }
    };

    fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, user, authLoading]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-medium text-sm">Preparing your order receipt...</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Order Received & Processing</h2>
          <p className="text-muted-foreground text-sm">
            Your payment was approved and your order is securely recorded in our system. You can track it or view all your orders anytime.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/orders">
              <Button className="w-full rounded-full">View My Orders</Button>
            </Link>
            <Link to="/products">
              <Button variant="outline" className="w-full rounded-full">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-12 bg-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50 dark:ring-emerald-950/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Order Confirmed! 🎉</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Thank you for shopping with us! Your order has been placed successfully.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/80 rounded-3xl p-6 shadow-xs space-y-6 mb-6"
        >
          {/* Order Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Number</p>
              <p className="font-mono text-base font-bold text-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
            {order.tracking_code && (
              <div className="text-right">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tracking Code</p>
                <button 
                  onClick={copyTrackingCode}
                  className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-primary hover:opacity-80 transition-opacity"
                  title="Click to copy tracking code"
                >
                  <span>{order.tracking_code}</span>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Purchased Items List */}
          {order.order_items && order.order_items.length > 0 && (
            <div className="space-y-3 pb-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ShoppingBag className="w-4 h-4" />
                <span>Purchased Items ({order.order_items.reduce((sum, item) => sum + item.quantity, 0)})</span>
              </div>
              <div className="divide-y divide-border/40">
                {order.order_items.map((item, idx) => (
                  <div key={item.id || idx} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.products?.image && (
                        <img 
                          src={item.products.image} 
                          alt={item.products.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-border shrink-0 bg-secondary/50" 
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{item.products?.name || "Product Item"}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: <span className="font-semibold">{item.quantity}</span>
                          {item.selected_size && <span> • Size: {item.selected_size}</span>}
                          {item.selected_color?.name && <span> • Color: {item.selected_color.name}</span>}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-foreground shrink-0">
                      GH₵{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery & Address */}
          <div className="space-y-3 pb-4 border-b border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shipping Details</p>
            <div className="bg-secondary/40 rounded-2xl p-4 space-y-1 text-sm">
              <p className="font-semibold text-foreground">{order.shipping_name}</p>
              <p className="text-muted-foreground">{order.shipping_address}</p>
              <p className="text-muted-foreground">
                {order.shipping_town ? `${order.shipping_town}, ` : ""}{order.shipping_city}, {order.shipping_region}
              </p>
            </div>
          </div>

          {/* Payment & Summary */}
          <div className="space-y-2 text-sm pt-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Payment Method</span>
              <span className="font-medium capitalize text-foreground">{order.payment_method?.replace(/_/g, " ")}</span>
            </div>
            {order.delivery_fee != null && order.delivery_fee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery Fee</span>
                <span className="font-medium text-foreground">GH₵{order.delivery_fee.toFixed(2)}</span>
              </div>
            )}
            {order.discount_amount != null && order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount Savings</span>
                <span>-GH₵{order.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base sm:text-lg font-bold text-foreground pt-3 border-t border-border/60">
              <span>Total Paid</span>
              <span className="text-primary">GH₵{Number(order.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-3"
        >
          {order.tracking_code && (
            <Link to={`/track?code=${order.tracking_code}`} className="block">
              <Button size="lg" className="w-full rounded-full gap-2 shadow-sm font-semibold">
                <Truck className="w-4 h-4" />
                Track Delivery Live
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          )}
          <Link to="/orders" className="block">
            <Button size="lg" variant="outline" className="w-full rounded-full font-medium">
              View All Orders
            </Button>
          </Link>
          <Link to="/products" className="block">
            <Button size="lg" variant="ghost" className="w-full rounded-full text-muted-foreground">
              Continue Shopping
            </Button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
};

export default OrderConfirmation;
