import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Package, Truck, CheckCircle, Clock, XCircle, Mail } from "lucide-react";
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
  created_at: string;
  order_items?: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: <Clock className="w-3 h-3" /> },
  processing: { label: "Processing", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Package className="w-3 h-3" /> },
  shipped: { label: "Shipped", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: <Truck className="w-3 h-3" /> },
  delivered: { label: "Delivered", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
};

const notifiableStatuses = ["processing", "shipped", "delivered"];

export const OrderManagement = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
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
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="text-sm">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    GH₵{order.total_amount.toFixed(2)}
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
