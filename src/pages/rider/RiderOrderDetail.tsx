import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, MapPin, Phone, Package, CheckCircle2,
  Loader2, Navigation, Clock, Mail, DollarSign, Truck
} from "lucide-react";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  products?: { name: string; image: string } | null;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_region: string;
  tracking_code: string | null;
  created_at: string | null;
  updated_at: string | null;
  discount_amount: number | null;
  payment_method: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const RiderOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id!).single(),
        supabase.from("order_items").select("*, products(name, image)").eq("order_id", id!),
      ]);

      if (orderRes.error) throw orderRes.error;
      setOrder(orderRes.data);

      // Handle the products join - it may come as an object or array
      const processedItems = (itemsRes.data || []).map((item: any) => ({
        ...item,
        products: item.products
          ? Array.isArray(item.products) ? item.products[0] : item.products
          : null,
      }));
      setItems(processedItems);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("id", order.id);

      if (error) throw error;

      toast({ title: "Order Delivered ✅", description: "Status updated successfully." });
      navigate("/rider/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const openInMaps = () => {
    if (!order) return;
    const addr = encodeURIComponent(`${order.shipping_address}, ${order.shipping_city}, ${order.shipping_region}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Order not found</p>
      </div>
    );
  }

  const isDeliverable = order.status !== "delivered" && order.status !== "cancelled";

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/rider/dashboard")} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Order Details</h1>
            <p className="text-xs opacity-80">#{order.tracking_code || order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <Badge className={`ml-auto ${statusColors[order.status] || ""}`}>
            {order.status}
          </Badge>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Customer Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Customer Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium text-foreground">{order.shipping_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <a href={`tel:${order.shipping_phone}`} className="font-medium text-primary flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {order.shipping_phone}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground text-xs">{order.shipping_email}</span>
            </div>
          </div>
        </motion.div>

        {/* Delivery Address */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Delivery Address
          </h3>
          <p className="text-sm text-foreground mb-1">{order.shipping_address}</p>
          <p className="text-sm text-muted-foreground">{order.shipping_city}, {order.shipping_region}</p>
          <Button onClick={openInMaps} variant="outline" className="w-full mt-3 h-11">
            <Navigation className="w-4 h-4 mr-2" /> Open in Google Maps
          </Button>
        </motion.div>

        {/* Order Items */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4" /> Order Items ({items.length})
          </h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                {item.products?.image && (
                  <img
                    src={item.products.image}
                    alt={item.products?.name || "Product"}
                    className="w-12 h-12 rounded-lg object-cover border border-border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.products?.name || "Product"}
                  </p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {order.currency} {item.price.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-3 pt-3 flex justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-foreground">{order.currency} {order.total_amount.toFixed(2)}</span>
          </div>
        </motion.div>

        {/* Order Meta */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Ordered</span>
              <span className="text-foreground">{order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Payment</span>
              <span className="text-foreground capitalize">{order.payment_method}</span>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`tel:${order.shipping_phone}`}
              className="flex items-center justify-center gap-2 h-12 bg-secondary text-secondary-foreground rounded-xl font-semibold text-sm"
            >
              <Phone className="w-5 h-5" /> Call
            </a>
            <a
              href={`mailto:${order.shipping_email}`}
              className="flex items-center justify-center gap-2 h-12 bg-secondary text-secondary-foreground rounded-xl font-semibold text-sm"
            >
              <Mail className="w-5 h-5" /> Email
            </a>
          </div>

          {isDeliverable && (
            <Button
              onClick={handleMarkDelivered}
              disabled={updating}
              className="w-full h-14 text-base font-bold rounded-xl"
            >
              {updating ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Updating...</>
              ) : (
                <><CheckCircle2 className="w-5 h-5 mr-2" /> Mark as Delivered</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiderOrderDetail;
