import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, MapPin, Phone, Package, CheckCircle2,
  Loader2, Navigation, Clock, Mail, Truck, KeyRound, ShieldCheck, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  pickup_confirmed_at?: string | null;
}

interface PickupInfo {
  seller_id: string;
  business_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  item_count: number;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  pending:    { bg: "bg-amber-400/15",  text: "text-amber-400",  dot: "bg-amber-400"  },
  processing: { bg: "bg-blue-400/15",   text: "text-blue-400",   dot: "bg-blue-400"   },
  shipped:    { bg: "bg-purple-400/15", text: "text-purple-400", dot: "bg-purple-400" },
  delivered:  { bg: "bg-green-400/15",  text: "text-green-400",  dot: "bg-green-400"  },
  cancelled:  { bg: "bg-red-400/15",    text: "text-red-400",    dot: "bg-red-400"    },
};

const RiderOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [pickups, setPickups] = useState<PickupInfo[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // OTP Handshake verification states
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupPin, setPickupPin] = useState("");
  const [verifyingPickup, setVerifyingPickup] = useState(false);

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryOtp, setDeliveryOtp] = useState("");
  const [verifyingDelivery, setVerifyingDelivery] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id!).single(),
        supabase.from("order_items").select("*, products(name, image, seller_id)").eq("order_id", id!),
      ]);
      if (orderRes.error) throw orderRes.error;
      setOrder(orderRes.data);

      const processedItems = (itemsRes.data || []).map((item: any) => ({
        ...item,
        products: item.products
          ? Array.isArray(item.products) ? item.products[0] : item.products
          : null,
      }));
      setItems(processedItems);

      // Fetch pickup info for every seller in this order
      const { data: pickupData, error: pickupError } = await (supabase as any)
        .rpc("get_order_pickup_info", { _order_id: id! });

      if (pickupError) {
        console.error("Failed to load pickup info:", pickupError.message);
      }
      setPickups((pickupData as PickupInfo[]) || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPickupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !pickupPin.trim()) return;

    setVerifyingPickup(true);
    try {
      const { data, error } = await supabase.rpc("confirm_pickup_otp", {
        _order_id: order.id,
        _otp: pickupPin.trim(),
      });

      if (error) throw error;

      toast({
        title: "Pickup Confirmed! 🚚",
        description: "Seller handover verified. The order is now Shipped / In Transit.",
      });

      setPickupModalOpen(false);
      setPickupPin("");
      fetchOrder();
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid Pickup PIN. Please confirm the 4-digit PIN with the seller.",
        variant: "destructive",
      });
    } finally {
      setVerifyingPickup(false);
    }
  };

  const handleConfirmDeliveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !deliveryOtp.trim()) return;

    setVerifyingDelivery(true);
    try {
      const { data, error } = await supabase.rpc("confirm_delivery_otp", {
        _order_id: order.id,
        _otp: deliveryOtp.trim(),
      });

      if (error) throw error;

      toast({
        title: "Order Delivered! 🎉",
        description: "Customer delivery OTP verified successfully.",
      });

      setDeliveryModalOpen(false);
      setDeliveryOtp("");
      navigate("/rider/dashboard");
    } catch (err: any) {
      toast({
        title: "Delivery Failed",
        description: err.message || "Invalid Delivery OTP. Ask the customer for their 6-digit code.",
        variant: "destructive",
      });
    } finally {
      setVerifyingDelivery(false);
    }
  };

  const openInMaps = () => {
    if (!order) return;
    const addr = encodeURIComponent(`${order.shipping_address}, ${order.shipping_city}, ${order.shipping_region}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4ade80]" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <p className="text-white/40">Order not found</p>
      </div>
    );
  }

  const isDeliverable = order.status !== "delivered" && order.status !== "cancelled";
  const s = STATUS_STYLE[order.status] || STATUS_STYLE.pending;

  return (
    <div className="h-[100dvh] bg-[#0f1117] flex justify-center">
      <div className="w-full max-w-[520px] h-full bg-[#111827] overflow-hidden flex flex-col">



        {/* Header */}
        <div className="px-6 pt-3 pb-4 flex-shrink-0 flex items-center gap-4">
          <button
            onClick={() => navigate("/rider/dashboard")}
            className="w-10 h-10 rounded-2xl bg-white/8 flex items-center justify-center text-white/70 hover:bg-white/15 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight">Order Details</h1>
            <p className="text-white/40 text-xs font-mono">#{order.tracking_code || order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {order.status}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">

          {/* Customer Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a2234] rounded-2xl p-4 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-xl bg-blue-400/15 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Customer Info</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">Name</span>
                <span className="text-white text-sm font-semibold">{order.shipping_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">Phone</span>
                <a href={`tel:${order.shipping_phone}`} className="text-[#4ade80] text-sm font-semibold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {order.shipping_phone}
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">Email</span>
                <span className="text-white/60 text-xs">{order.shipping_email}</span>
              </div>
            </div>
          </motion.div>

          {/* Pickup Locations (Sellers) */}
          {pickups.length > 0 ? (
            pickups.map((seller, idx) => (
              <motion.div
                key={seller.seller_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 + idx * 0.03 }}
                className="bg-[#1a2234] rounded-2xl p-4 border border-[#4ade80]/20 relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#4ade80]/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#4ade80]/15 flex items-center justify-center">
                      <MapPin className="w-3.5 h-3.5 text-[#4ade80]" />
                    </div>
                    <h3 className="text-white font-semibold text-sm">
                      Pickup {pickups.length > 1 ? `${idx + 1}/${pickups.length}` : "(Seller)"}
                    </h3>
                  </div>
                  {seller.phone && (
                    <a
                      href={`tel:${seller.phone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4ade80]/15 text-[#4ade80] rounded-lg text-xs font-semibold hover:bg-[#4ade80]/25 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Seller
                    </a>
                  )}
                </div>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start justify-between">
                    <span className="text-white/40 text-xs mt-0.5">Store</span>
                    <span className="text-white text-sm font-semibold text-right max-w-[200px]">
                      {seller.business_name || "Seller"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-white/40 text-xs mt-0.5">Address</span>
                    <span className="text-white/80 text-sm font-medium text-right max-w-[200px]">
                      {seller.address || "Address not provided"}
                    </span>
                  </div>
                  {seller.phone && (
                    <div className="flex items-start justify-between">
                      <span className="text-white/40 text-xs mt-0.5">Phone</span>
                      <span className="text-white/80 text-sm font-medium text-right">{seller.phone}</span>
                    </div>
                  )}
                  {seller.email && (
                    <div className="flex items-start justify-between">
                      <span className="text-white/40 text-xs mt-0.5">Email</span>
                      <span className="text-white/60 text-xs text-right break-all max-w-[200px]">{seller.email}</span>
                    </div>
                  )}

                  {seller.address && (
                    <button
                      onClick={() => {
                        const addr = encodeURIComponent(seller.address!);
                        window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, "_blank");
                      }}
                      className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-semibold hover:bg-white/10 transition-all"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Navigate to Pickup
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              className="bg-[#1a2234] rounded-2xl p-4 border border-orange-500/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-xl bg-orange-500/15 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <h3 className="text-white font-semibold text-sm">Pickup (Unknown Seller)</h3>
              </div>
              <p className="text-white/50 text-xs">
                No seller is linked to the items in this order, so pickup details are unavailable.
              </p>
            </motion.div>
          )}

          {/* Delivery Address */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            className="bg-[#1a2234] rounded-2xl p-4 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-xl bg-amber-400/15 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Delivery Address</h3>
            </div>
            <p className="text-white/80 text-sm mb-0.5">{order.shipping_address}</p>
            <p className="text-white/40 text-xs mb-4">{order.shipping_city}, {order.shipping_region}</p>
            <button
              onClick={openInMaps}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/5 transition-all"
            >
              <Navigation className="w-4 h-4" /> Open in Google Maps
            </button>
          </motion.div>

          {/* Order Items */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="bg-[#1a2234] rounded-2xl p-4 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-xl bg-purple-400/15 flex items-center justify-center">
                <Truck className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Order Items ({items.length})</h3>
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.products?.image && (
                    <img
                      src={item.products.image}
                      alt={item.products?.name || "Product"}
                      className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.products?.name || "Product"}</p>
                    <p className="text-white/40 text-xs">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-white font-bold text-sm flex-shrink-0">
                    {order.currency} {item.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/8 mt-4 pt-4 flex justify-between items-center">
              <span className="text-white/60 text-sm font-medium">Total</span>
              <span className="text-white font-bold text-lg">{order.currency} {order.total_amount.toFixed(2)}</span>
            </div>
          </motion.div>

          {/* Order Meta */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.21 }}
            className="bg-[#1a2234] rounded-2xl p-4 border border-white/5"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Ordered
                </span>
                <span className="text-white/70 text-xs">
                  {order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">Payment</span>
                <span className="text-white/70 text-xs capitalize">{order.payment_method}</span>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="space-y-3 pb-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`tel:${order.shipping_phone}`}
                className="flex items-center justify-center gap-2 h-12 bg-white/8 text-white/80 rounded-2xl text-sm font-semibold hover:bg-white/12 transition-all border border-white/8"
              >
                <Phone className="w-4 h-4" /> Call
              </a>
              <a
                href={`mailto:${order.shipping_email}`}
                className="flex items-center justify-center gap-2 h-12 bg-white/8 text-white/80 rounded-2xl text-sm font-semibold hover:bg-white/12 transition-all border border-white/8"
              >
                <Mail className="w-4 h-4" /> Email
              </a>
            </div>

            {/* Smart Step Verification Buttons */}
            {['pending', 'confirmed', 'processing'].includes(order.status) && (
              <button
                onClick={() => setPickupModalOpen(true)}
                disabled={updating}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                <KeyRound className="w-5 h-5" /> Confirm Pickup from Seller
              </button>
            )}

            {order.status === 'shipped' && (
              <button
                onClick={() => setDeliveryModalOpen(true)}
                disabled={updating}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#4ade80] to-[#16a34a] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-green-500/25 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                <CheckCircle2 className="w-5 h-5" /> Confirm Customer Delivery (OTP)
              </button>
            )}

            {order.status === 'delivered' && (
              <div className="w-full py-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-sm flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Order Delivered & Handshake Verified</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Pickup Handover PIN Modal */}
        <Dialog open={pickupModalOpen} onOpenChange={setPickupModalOpen}>
          <DialogContent className="max-w-sm bg-[#111827] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-purple-400">
                <KeyRound className="w-5 h-5" /> Seller Handover PIN
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleConfirmPickupOtp} className="space-y-4 py-2">
              <p className="text-xs text-white/60 leading-relaxed">
                Enter the <strong>4-digit Pickup PIN</strong> given to you by the seller upon physically receiving the package.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="pickup-pin-input" className="text-xs text-white/80">4-Digit PIN Code</Label>
                <Input
                  id="pickup-pin-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  value={pickupPin}
                  onChange={(e) => setPickupPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • •"
                  className="text-center font-mono text-2xl tracking-[0.5em] font-extrabold h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-purple-500"
                />
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setPickupModalOpen(false); setPickupPin(""); }}
                  className="border-white/10 text-white/80 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={verifyingPickup || pickupPin.length !== 4}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  {verifyingPickup ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Verifying...</>
                  ) : (
                    "Verify & Start Delivery 🚚"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Customer Delivery OTP Modal */}
        <Dialog open={deliveryModalOpen} onOpenChange={setDeliveryModalOpen}>
          <DialogContent className="max-w-sm bg-[#111827] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" /> Customer Delivery OTP
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleConfirmDeliveryOtp} className="space-y-4 py-2">
              <p className="text-xs text-white/60 leading-relaxed">
                Enter the <strong>6-digit Delivery Code</strong> displayed on the customer's phone or order tracking screen.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="delivery-otp-input" className="text-xs text-white/80">6-Digit OTP</Label>
                <Input
                  id="delivery-otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  value={deliveryOtp}
                  onChange={(e) => setDeliveryOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • • • •"
                  className="text-center font-mono text-2xl tracking-[0.4em] font-extrabold h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-emerald-500"
                />
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDeliveryModalOpen(false); setDeliveryOtp(""); }}
                  className="border-white/10 text-white/80 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={verifyingDelivery || deliveryOtp.length !== 6}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {verifyingDelivery ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Verifying...</>
                  ) : (
                    "Complete Delivery ✅"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Home indicator */}
        <div className="flex-shrink-0 flex justify-center py-3 bg-[#111827] border-t border-white/5">
          <div className="w-28 h-1 bg-white/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default RiderOrderDetail;
