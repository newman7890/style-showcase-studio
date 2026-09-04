import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Package, Truck, CheckCircle, CheckCircle2, Clock, XCircle, Mail, ShieldCheck, KeyRound, Bike, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  payment_status?: string | null;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_region: string;
  payment_method: string;
  tracking_code: string | null;
  delivery_fee: number | null;
  discount_amount: number | null;
  discount_code: string | null;
  pickup_otp?: string | null;
  pickup_confirmed_at?: string | null;
  pickup_rider_id?: string | null;
  assigned_rider_id?: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Order Placed", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: "Order Placed", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <Clock className="w-3 h-3" /> },
  processing: { label: "Processing", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Package className="w-3 h-3" /> },
  shipped: { label: "Shipped", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: <Truck className="w-3 h-3" /> },
  delivered: { label: "Delivered", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
};

const notifiableStatuses = ["processing", "shipped", "delivered"];

interface RiderInfo {
  user_id: string;
  full_name: string;
  phone_number: string;
  vehicle_type?: string;
}

interface SellerInfo {
  user_id: string;
  business_name: string;
  phone?: string;
  pickup_address?: string;
  address?: string;
}

export const OrderManagement = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Record<string, RiderInfo>>({});
  const [orderSellers, setOrderSellers] = useState<Record<string, SellerInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const [{ data: orderData, error: orderErr }, { data: riderData }, { data: sellerData }] = await Promise.all([
        supabase
          .from("orders")
          .select(`
            *,
            order_items (
              id,
              product_id,
              quantity,
              price
            )
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("rider_profiles")
          .select("user_id, full_name, phone_number, vehicle_type"),
        supabase
          .from("seller_profiles")
          .select("user_id, business_name, phone, pickup_address, address"),
      ]);

      if (orderErr) throw orderErr;

      // Build rider map
      const riderMap: Record<string, RiderInfo> = {};
      (riderData || []).forEach((r: any) => {
        if (r.user_id) riderMap[r.user_id] = r;
      });
      setRiders(riderMap);

      // Build seller map
      const sellerMap: Record<string, SellerInfo> = {};
      (sellerData || []).forEach((s: any) => {
        if (s.user_id) sellerMap[s.user_id] = s;
      });

      // Map orders to their respective sellers via product_id
      const allProductIds = Array.from(new Set(
        (orderData || []).flatMap((o: any) => (o.order_items || []).map((i: any) => i.product_id)).filter(Boolean)
      ));

      const orderSellerMapping: Record<string, SellerInfo> = {};
      if (allProductIds.length > 0) {
        const { data: prodData } = await supabase
          .from("products")
          .select("id, seller_id")
          .in("id", allProductIds);

        const prodSellerLookup: Record<string, string> = {};
        (prodData || []).forEach((p: any) => {
          if (p.id && p.seller_id) prodSellerLookup[p.id] = p.seller_id;
        });

        (orderData || []).forEach((o: any) => {
          const sId = (o.order_items || []).map((i: any) => prodSellerLookup[i.product_id]).find(Boolean);
          if (sId && sellerMap[sId]) {
            orderSellerMapping[o.id] = sellerMap[sId];
          }
        });
      }
      setOrderSellers(orderSellerMapping);
      setOrders(orderData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
      
      // Send email notification for certain status changes
      if (notifiableStatuses.includes(status)) {
        try {
          const { error: notifyError } = await supabase.functions.invoke("send-order-notification", {
            body: { orderId, newStatus: status },
          });
          
          if (notifyError) {
            console.error("Failed to send notification:", notifyError);
            toast({ 
              title: `Order status updated to ${status}`,
              description: "Email notification could not be sent",
            });
          } else {
            toast({ 
              title: `Order status updated to ${status}`,
              description: "Customer has been notified via email",
            });
          }
        } catch (notifyErr) {
          console.error("Notification error:", notifyErr);
          toast({ title: `Order status updated to ${status}` });
        }
      } else {
        toast({ title: `Order status updated to ${status}` });
      }
      
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading orders...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Order Management</h2>
        <Badge variant="outline" className="text-sm">
          {orders.length} orders
        </Badge>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-border rounded-lg">
          No orders yet.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Seller Handover</TableHead>
                <TableHead>Assigned Rider</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">
                    #{order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {order.tracking_code || "—"}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.shipping_name}</p>
                      <p className="text-sm text-muted-foreground">{order.shipping_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.pickup_confirmed_at ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-xs font-semibold gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-purple-500" />
                          Handover Confirmed
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(order.pickup_confirmed_at)}
                        </span>
                      </div>
                    ) : order.pickup_otp ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs font-mono font-bold tracking-wider gap-1 w-fit">
                          <KeyRound className="w-3 h-3 text-amber-500" />
                          PIN: {order.pickup_otp}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">Awaiting pickup</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Pending PIN
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.assigned_rider_id && riders[order.assigned_rider_id] ? (
                      <div className="flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium leading-tight">{riders[order.assigned_rider_id].full_name}</p>
                          <p className="text-[10px] text-muted-foreground">{riders[order.assigned_rider_id].phone_number}</p>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground text-xs font-normal">
                        Unassigned
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    GH₵{order.total_amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {order.payment_status === "paid" || ["confirmed", "processing", "shipped", "delivered"].includes(order.status) ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 font-semibold">
                        🟢 Paid
                      </Badge>
                    ) : order.payment_status === "failed" || order.status === "cancelled" ? (
                      <Badge className="bg-red-500/15 text-red-600 border-red-500/30 font-semibold">
                        🔴 Failed
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 font-semibold">
                        🟡 Unpaid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusConfig[order.status]?.color || ""} flex items-center gap-1 w-fit`}>
                      {statusConfig[order.status]?.icon}
                      {statusConfig[order.status]?.label || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={order.status}
                        onValueChange={(value) => updateOrderStatus(order.id, value)}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => viewOrderDetails(order)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Customer Info</h4>
                  <div className="bg-secondary/50 p-4 rounded-lg space-y-1">
                    <p className="font-medium">{selectedOrder.shipping_name}</p>
                    <p className="text-sm">{selectedOrder.shipping_email}</p>
                    <p className="text-sm">{selectedOrder.shipping_phone}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Shipping Address</h4>
                  <div className="bg-secondary/50 p-4 rounded-lg space-y-1">
                    <p className="text-sm">{selectedOrder.shipping_address}</p>
                    <p className="text-sm">{selectedOrder.shipping_city}, {selectedOrder.shipping_region}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Order Items</h4>
                <div className="bg-secondary/50 p-4 rounded-lg">
                  {selectedOrder.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm font-mono">{item.product_id.slice(0, 8)}</span>
                      <span className="text-sm">Qty: {item.quantity}</span>
                      <span className="text-sm font-medium">GH₵{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                  {(() => {
                    const itemsTotal = selectedOrder.order_items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
                    const deliveryFee = Number(selectedOrder.delivery_fee ?? 0);
                    const discount = Number(selectedOrder.discount_amount ?? 0);
                    return (
                      <div className="pt-3 mt-2 border-t border-border space-y-1.5 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span>GH₵{itemsTotal.toFixed(2)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Discount {selectedOrder.discount_code ? `(${selectedOrder.discount_code})` : ""}</span>
                            <span>-GH₵{discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-muted-foreground">
                          <span>Delivery fee ({selectedOrder.shipping_region})</span>
                          <span>GH₵{deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-border font-medium text-foreground">
                          <span>Total</span>
                          <span>GH₵{selectedOrder.total_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Two-Way Handshake & Chain of Custody Proof */}
              <div className="border border-border/80 rounded-xl p-4 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>Two-Way Handshake & Proof-of-Custody Audit</span>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    Tracking: {selectedOrder.tracking_code || "N/A"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Card 1: Seller Handover Proof */}
                  <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-purple-500" />
                        1. Seller Pickup Proof
                      </span>
                      {selectedOrder.pickup_confirmed_at ? (
                        <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px] font-semibold">
                          ✅ Handover Confirmed
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] font-semibold">
                          ⏳ Awaiting Pickup
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                      <p className="font-semibold text-foreground">
                        {orderSellers[selectedOrder.id]?.business_name || "Partner Merchant Store"}
                      </p>
                      {orderSellers[selectedOrder.id]?.phone && (
                        <p>Phone: {orderSellers[selectedOrder.id]?.phone}</p>
                      )}
                      {orderSellers[selectedOrder.id]?.pickup_address && (
                        <p className="truncate">Address: {orderSellers[selectedOrder.id]?.pickup_address}</p>
                      )}
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Seller Pickup PIN:</span>
                      <span className="font-mono text-sm font-bold bg-muted px-2.5 py-0.5 rounded border border-border tracking-widest text-primary">
                        {selectedOrder.pickup_otp || "Pending"}
                      </span>
                    </div>
                    {selectedOrder.pickup_confirmed_at ? (
                      <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                        ✓ Verified on {formatDate(selectedOrder.pickup_confirmed_at)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Seller gives this 4-digit PIN to the rider upon package handover.
                      </p>
                    )}
                  </div>

                  {/* Card 2: Assigned Rider Custody */}
                  <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-blue-500" />
                        2. Rider Custody
                      </span>
                      {selectedOrder.assigned_rider_id ? (
                        <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] font-semibold">
                          Assigned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Unassigned
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                      {selectedOrder.assigned_rider_id && riders[selectedOrder.assigned_rider_id] ? (
                        <>
                          <p className="font-semibold text-foreground">
                            {riders[selectedOrder.assigned_rider_id].full_name}
                          </p>
                          <p>Phone: {riders[selectedOrder.assigned_rider_id].phone_number}</p>
                          <p>Vehicle: {riders[selectedOrder.assigned_rider_id].vehicle_type || "Dispatch Motorbike"}</p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">No rider assigned yet. Order is available for claim in rider network.</p>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-1">
                      {selectedOrder.pickup_confirmed_at
                        ? "✓ Physical custody verified — Rider is in transit."
                        : selectedOrder.assigned_rider_id
                        ? "Rider must enter 4-digit PIN upon physical item collection."
                        : "Requires rider claim before pickup."}
                    </p>
                  </div>
                </div>

                {/* Card 3: Final Customer Doorstep Delivery */}
                <div className={`p-3.5 rounded-xl border ${
                  selectedOrder.status === "delivered"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : selectedOrder.status === "shipped"
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                    : "bg-muted/40 border-border text-muted-foreground"
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      3. Customer Doorstep Delivery (6-Digit OTP Handshake)
                    </span>
                    {selectedOrder.status === "delivered" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                        Delivered & Verified
                      </Badge>
                    ) : selectedOrder.status === "shipped" ? (
                      <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px]">
                        In Transit
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Pending Transit
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs opacity-90">
                    {selectedOrder.status === "delivered"
                      ? "✓ Final delivery completed. Customer gave their secret 6-digit PIN code to the rider at doorstep."
                      : selectedOrder.status === "shipped"
                      ? "Order is in transit. Customer has received their secret 6-digit delivery OTP via email to present upon package arrival."
                      : "Awaiting seller pickup verification before delivery transit begins."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-muted-foreground">Payment Method: </span>
                  <span className="font-medium capitalize">{selectedOrder.payment_method}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Order Date: </span>
                  <span className="font-medium">{formatDate(selectedOrder.created_at)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
