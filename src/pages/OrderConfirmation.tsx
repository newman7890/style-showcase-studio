import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Package, Copy, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_region: string;
  payment_method: string;
  tracking_code: string | null;
  created_at: string;
}

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const copyTrackingCode = () => {
    if (order?.tracking_code) {
      navigator.clipboard.writeText(order.tracking_code);
      toast({ title: "Tracking code copied!" });
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (error) throw error;
        setOrder(data);
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading order...</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Order not found</p>
          <Link to="/products">
            <Button>Continue Shopping</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-semibold mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you for your purchase. Your order has been received.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary/30 rounded-2xl p-6 space-y-4 mb-6"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Order Number</p>
              <p className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
            {order.tracking_code && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Tracking Code</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-semibold text-primary">{order.tracking_code}</p>
                  <button 
                    onClick={copyTrackingCode}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-2">Shipping Address</p>
            <p className="font-medium">{order.shipping_name}</p>
            <p className="text-sm">{order.shipping_address}</p>
            <p className="text-sm">
              {order.shipping_city}, {order.shipping_region}
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-2">Payment Method</p>
            <p className="font-medium capitalize">
              {order.payment_method.replace("_", " ")}
            </p>
          </div>

          <div className="border-t border-border pt-4 flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>GH₵{order.total_amount.toFixed(2)}</span>
          </div>
        </motion.div>

          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          {order.tracking_code && (
            <Link to={`/track/${order.tracking_code}`} className="block">
              <Button size="lg" className="w-full rounded-full gap-2">
                <Truck className="w-4 h-4" />
                Track Your Order
              </Button>
            </Link>
          )}
          <Link to="/products" className="block">
            <Button size="lg" variant={order.tracking_code ? "outline" : "default"} className="w-full rounded-full">
              Continue Shopping
            </Button>
          </Link>
          <Link to="/profile" className="block">
            <Button size="lg" variant="outline" className="w-full rounded-full">
              View Order History
            </Button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
};

export default OrderConfirmation;
