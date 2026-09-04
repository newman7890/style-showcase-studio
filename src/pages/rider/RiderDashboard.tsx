import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Package, MapPin, Phone, CheckCircle2,
  RefreshCw, Loader2, Clock, ChevronRight, LogOut, Bike,
  LayoutGrid, Bell, User, KeyRound, Truck
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
  assigned_rider_id?: string | null;
  created_at: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  pending:    { bg: "bg-amber-400/15",  text: "text-amber-400",  dot: "bg-amber-400"  },
  processing: { bg: "bg-blue-400/15",   text: "text-blue-400",   dot: "bg-blue-400"   },
  shipped:    { bg: "bg-purple-400/15", text: "text-purple-400", dot: "bg-purple-400" },
  delivered:  { bg: "bg-green-400/15",  text: "text-green-400",  dot: "bg-green-400"  },
  cancelled:  { bg: "bg-red-400/15",    text: "text-red-400",    dot: "bg-red-400"    },
};

interface AvailableDelivery {
  id: string;
  tracking_code: string | null;
  status: string;
  shipping_city: string;
  shipping_region: string;
  total_amount: number;
  currency: string;
  created_at: string | null;
}

const RiderDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [available, setAvailable] = useState<AvailableDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"active" | "available" | "delivered" | "all">("active");
  const [activeTab, setActiveTab] = useState<"orders" | "profile">("orders");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Prevent back button from logging out or returning to login screen
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);

    fetchOrders();
    const channel = supabase
      .channel("rider-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders)
      .subscribe();
    return () => {
      window.removeEventListener("popstate", handlePopState);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const [{ data, error }, avail] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_available_deliveries"),
      ]);
      if (error) throw error;
      setOrders(data || []);
      setAvailable(((avail.data as any) || []) as AvailableDelivery[]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); fetchOrders(); };

  const handleClaim = async (orderId: string) => {
    try {
      const { data, error } = await supabase.rpc("claim_delivery", { _order_id: orderId });
      if (error) throw error;
      if (!data) {
        toast({ title: "Already taken", description: "Another rider claimed this delivery.", variant: "destructive" });
      } else {
        toast({ title: "Delivery claimed 🚴" });
        setFilter("active");
      }
      fetchOrders();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleClaimOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await (supabase as any).rpc("claim_order_by_rider", { _order_id: orderId });
      if (error) throw error;
      toast({ title: "Delivery Order Claimed! 🚴" });
      fetchOrders();
    } catch (error: any) {
      toast({ title: "Error Claiming Order", description: error.message, variant: "destructive" });
    }
  };

  const { signOut } = useAuth();
  const handleLogout = async () => {
    await signOut();
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
      toast({ title: "Order Delivered ✅" });
      fetchOrders();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredOrders = orders.filter((o) => {
    const isUnassigned = !o.assigned_rider_id;
    const isAssignedToMe = o.assigned_rider_id === user?.id;

    if (filter === "available") return isUnassigned && o.status !== "delivered" && o.status !== "cancelled";
    if (filter === "active") return (isAssignedToMe || isUnassigned) && o.status !== "delivered" && o.status !== "cancelled";
    if (filter === "delivered") return isAssignedToMe && o.status === "delivered";
    return true;
  });


  const activeCount = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4ade80]" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#0f1117] flex justify-center">
      <div className="w-full max-w-[520px] h-full bg-[#111827] overflow-hidden flex flex-col">


        {/* Header */}
        <div className="px-6 pt-3 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-md shadow-green-500/30">
                <img src="/logo.png" alt="Trades Point Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">My Deliveries</h1>
                <p className="text-white/40 text-xs truncate max-w-[160px]">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── ORDERS TAB ── */}
        {activeTab === "orders" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 px-6 mb-5 flex-shrink-0">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1a2234] rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-400/15 flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-white/50 text-xs font-medium">Active</span>
                </div>
                <span className="text-3xl font-bold text-white">{activeCount}</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.07 }}
                className="bg-[#1a2234] rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-green-400/15 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <span className="text-white/50 text-xs font-medium">Delivered</span>
                </div>
                <span className="text-3xl font-bold text-white">{deliveredCount}</span>
              </motion.div>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 px-6 mb-4 flex-shrink-0">
              {(["active", "available", "delivered", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    filter === f
                      ? "bg-[#4ade80] text-[#0a1a0a] shadow-lg shadow-green-500/20"
                      : "bg-white/8 text-white/50 hover:bg-white/12"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Orders list — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
              {filter === "available" && (
                available.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-white/30 text-sm">No unclaimed deliveries</p>
                  </div>
                ) : (
                  available.map((o) => (
                    <div key={o.id} className="bg-[#1a2234] rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white/35 text-xs font-mono">#{o.tracking_code || o.id.slice(0, 8).toUpperCase()}</p>
                        <span className="text-white font-bold text-sm">{o.currency} {Number(o.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex items-start gap-2 mb-3">
                        <MapPin className="w-3.5 h-3.5 text-white/30 mt-0.5 flex-shrink-0" />
                        <p className="text-white/50 text-xs">{o.shipping_city}, {o.shipping_region}</p>
                      </div>
                      <button
                        onClick={() => handleClaim(o.id)}
                        className="w-full py-2 bg-gradient-to-r from-[#4ade80] to-[#16a34a] text-white rounded-xl text-xs font-bold"
                      >
                        Claim Delivery
                      </button>
                    </div>
                  ))
                )
              )}
              <AnimatePresence>
                {filter !== "available" && filteredOrders.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-white/30 text-sm">No orders found</p>
                  </motion.div>
                ) : (
                  filteredOrders.map((order, i) => {
                    const s = STATUS_STYLE[order.status] || STATUS_STYLE.pending;
                    const isActive = order.status !== "delivered" && order.status !== "cancelled";
                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -80 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => navigate(`/rider/order/${order.id}`)}
                        className="bg-[#1a2234] rounded-2xl p-4 border border-white/5 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        {/* Top row */}
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white font-semibold text-sm leading-tight">{order.shipping_name}</p>
                            <p className="text-white/35 text-xs mt-0.5 font-mono">#{order.tracking_code || order.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {order.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-white/25" />
                          </div>
                        </div>

                        {/* Address */}
                        <div className="flex items-start gap-2 mb-2">
                          <MapPin className="w-3.5 h-3.5 text-white/30 mt-0.5 flex-shrink-0" />
                          <p className="text-white/50 text-xs line-clamp-1">{order.shipping_address}, {order.shipping_city}</p>
                        </div>

                        {/* Time & amount */}
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                          <span className="text-white/40 text-xs">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}
                          </span>
                          <span className="ml-auto text-white font-bold text-sm">
                            {order.currency} {order.total_amount.toFixed(2)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <a
                            href={`tel:${order.shipping_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/8 text-white/70 rounded-xl text-xs font-semibold hover:bg-white/15 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" /> Call
                          </a>
                          {!order.assigned_rider_id ? (
                            <button
                              onClick={(e) => handleClaimOrder(order.id, e)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:opacity-90 transition-opacity"
                            >
                              <Bike className="w-3.5 h-3.5" /> Claim Delivery 🚴
                            </button>
                          ) : (
                            isActive && (
                              order.status === "shipped" ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/rider/order/${order.id}`);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-[#4ade80] to-[#16a34a] text-black font-bold rounded-xl text-xs shadow-md shadow-green-500/20 hover:opacity-90 transition-opacity"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Enter Delivery OTP 📦
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/rider/order/${order.id}`);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 hover:opacity-90 transition-opacity"
                                >
                                  <KeyRound className="w-3.5 h-3.5" /> Enter Pickup PIN 🔐
                                </button>
                              )
                            )
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="flex-1 overflow-y-auto px-6 pb-4 pt-4">
            {/* Stats summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="grid grid-cols-2 gap-3 mb-4"
            >
              <div className="bg-[#1a2234] rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-3xl font-bold text-white">{activeCount}</p>
                <p className="text-white/40 text-xs mt-1">Pending</p>
              </div>
              <div className="bg-[#1a2234] rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-3xl font-bold text-white">{deliveredCount}</p>
                <p className="text-white/40 text-xs mt-1">Delivered</p>
              </div>
            </motion.div>

            {/* Info rows */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="bg-[#1a2234] rounded-2xl border border-white/5 divide-y divide-white/5 mb-4"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-white/40 text-sm">Role</span>
                <span className="text-white text-sm font-semibold">Delivery Rider</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-white/40 text-sm">Email</span>
                <span className="text-white/70 text-xs truncate max-w-[160px]">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-white/40 text-sm">Total Orders</span>
                <span className="text-white text-sm font-semibold">{orders.length}</span>
              </div>
            </motion.div>

            {/* Sign Out */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              onClick={handleLogout}
              className="w-full h-12 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </motion.button>
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex-shrink-0 bg-[#1a2234] border-t border-white/8 px-6 py-3 flex items-center justify-around">
          {[
            { id: "orders", icon: LayoutGrid, label: "Orders" },
            { id: "profile", icon: User, label: "Profile" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex flex-col items-center gap-1 px-4 py-1 transition-all ${
                activeTab === id ? "text-[#4ade80]" : "text-white/30"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={activeTab === id ? 2 : 1.5} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>

        {/* Home indicator */}
        <div className="flex-shrink-0 flex justify-center pb-3 pt-1 bg-[#1a2234]">
          <div className="w-28 h-1 bg-white/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default RiderDashboard;
