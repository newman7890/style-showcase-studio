import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Truck, CheckCircle, Clock, Search, MapPin, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";

interface Order {
  id: string;
  tracking_code: string;
  status: string;
  total_amount: number;
  currency: string;
  shipping_name_masked: string;
  shipping_city: string;
  shipping_region: string;
  created_at: string;
  updated_at: string;
}

const statusSteps = [
  { key: "pending", label: "Order Placed", icon: Clock },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle },
];

const TrackOrder = () => {
  const { trackingCode: urlTrackingCode } = useParams();
  const [searchParams] = useSearchParams();
  const [trackingInput, setTrackingInput] = useState(urlTrackingCode || searchParams.get("code") || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (urlTrackingCode) {
      searchOrder(urlTrackingCode);
    }
  }, [urlTrackingCode]);

  const searchOrder = async (code: string) => {
    if (!code.trim()) return;
    
    setLoading(true);
    setSearched(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .rpc("get_order_by_tracking_code", { _tracking_code: code.trim() });

      if (fetchError) throw fetchError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError("No order found with this tracking code. Please check and try again.");
        setOrder(null);
      } else {
        setOrder(row as Order);
      }
    } catch (err: any) {
      console.error("Error fetching order:", err);
      setError("Something went wrong. Please try again.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchOrder(trackingInput);
  };

  const getCurrentStep = () => {
    if (!order) return -1;
    if (order.status === "cancelled") return -2;
    return statusSteps.findIndex((step) => step.key === order.status);
  };

  const currentStep = getCurrentStep();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
          <p className="text-muted-foreground">
            Enter your tracking code to see the status of your order
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="flex gap-3 mb-8"
        >
          <Input
            type="text"
            placeholder="Enter tracking code (e.g., TRK-ABC123-XY12)"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
            className="flex-1 h-12 text-base font-mono"
          />
          <Button type="submit" size="lg" disabled={loading || !trackingInput.trim()}>
            <Search className="w-4 h-4 mr-2" />
            Track
          </Button>
        </motion.form>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-pulse text-muted-foreground">Searching for your order...</div>
          </div>
        )}

        {error && searched && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 bg-destructive/10 rounded-2xl border border-destructive/20"
          >
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">{error}</p>
          </motion.div>
        )}

        {order && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Order Status Timeline */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  Order Status
                </h2>
                <span className="font-mono text-sm text-muted-foreground">
                  {order.tracking_code}
                </span>
              </div>

              {order.status === "cancelled" ? (
                <div className="flex items-center gap-4 p-4 bg-destructive/10 rounded-xl">
                  <XCircle className="w-8 h-8 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">Order Cancelled</p>
                    <p className="text-sm text-muted-foreground">
                      This order has been cancelled.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-border" />
                  <div
                    className="absolute left-6 top-6 w-0.5 bg-primary transition-all duration-500"
                    style={{
                      height: `${Math.max(0, (currentStep / (statusSteps.length - 1)) * 100)}%`,
                    }}
                  />

                  <div className="space-y-6">
                    {statusSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      const isCompleted = index <= currentStep;
                      const isCurrent = index === currentStep;

                      return (
                        <div key={step.key} className="flex items-center gap-4">
                          <div
                            className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isCompleted
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            } ${isCurrent ? "ring-4 ring-primary/20" : ""}`}
                          >
                            <StepIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p
                              className={`font-medium ${
                                isCompleted ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {step.label}
                            </p>
                            {isCurrent && (
                              <p className="text-sm text-primary">Current status</p>
                            )}
                          </div>
                          {isCompleted && (
                            <CheckCircle className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Order Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID</span>
                    <span className="font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Placed on</span>
                    <span>{formatDate(order.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last updated</span>
                    <span>{formatDate(order.updated_at)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">GH₵{order.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shipping Address
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{order.shipping_name_masked}</p>
                  <p className="text-muted-foreground">
                    {order.shipping_city}, {order.shipping_region}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Link to="/products">
                <Button variant="outline" className="rounded-full">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {!order && !loading && !searched && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-muted-foreground"
          >
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Enter your tracking code above to get started</p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default TrackOrder;
