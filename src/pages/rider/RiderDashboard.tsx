import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Truck, LogOut, Package, MapPin, Phone, CheckCircle2,
  RefreshCw, Loader2, Clock, ChevronRight, User
} from "lucide-react";

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
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const RiderDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"active" | "delivered" | "all">("active");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    // Subscribe to realtime order changes
    const channel = supabase
      .channel("rider-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = async () => {
    try {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/rider/login");
  };

  const handleMarkDelivered = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      toast({ title: "Order Delivered ✅", description: "Status updated successfully." });
      fetchOrders();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === "active") return o.status !== "delivered" && o.status !== "cancelled";
    if (filter === "delivered") return o.status === "delivered";
    return true;
  });

  const activeCount = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-7 h-7" />
            <div>
              <h1 className="text-lg font-bold">Rider Dashboard</h1>
              <p className="text-xs opacity-80">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 px-4 -mt-3 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="w-4 h-4" />
            <span className="text-xs">Active</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{activeCount}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs">Delivered</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{deliveredCount}</span>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 mt-4">
        {(["active", "delivered", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="px-4 mt-4 space-y-3">
        <AnimatePresence>
          {filteredOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 text-muted-foreground"
            >
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No orders found</p>
            </motion.div>
          ) : (
            filteredOrders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/rider/order/${order.id}`)}
                className="bg-card border border-border rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{order.shipping_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      #{order.tracking_code || order.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[order.status] || "bg-muted text-foreground"}>
                      {order.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{order.shipping_address}, {order.shipping_city}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Clock className="w-4 h-4" />
                  <span>{order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {order.currency} {order.total_amount.toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`tel:${order.shipping_phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                  {order.status !== "delivered" && order.status !== "cancelled" && (
                    <Button
                      size="sm"
                      onClick={(e) => handleMarkDelivered(order.id, e)}
                      className="flex-1 h-9 text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Delivered
                    </Button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RiderDashboard;
