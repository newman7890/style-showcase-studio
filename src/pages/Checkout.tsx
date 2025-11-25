import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/hooks/useCart";
import { useOrders } from "@/hooks/useOrders";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Central",
  "Eastern",
  "Volta",
  "Northern",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
  "Oti",
  "Savannah",
  "North East",
  "Western North",
];

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, total, clearCart } = useCart();
  const { createOrder } = useOrders();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    shipping_name: "",
    shipping_email: "",
    shipping_phone: "",
    shipping_address: "",
    shipping_city: "",
    shipping_region: "",
    payment_method: "cash_on_delivery",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // Validate form
    if (
      !formData.shipping_name ||
      !formData.shipping_email ||
      !formData.shipping_phone ||
      !formData.shipping_address ||
      !formData.shipping_city ||
      !formData.shipping_region
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);

    try {
      const orderItems = cartItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.products.price,
      }));

      const orderId = await createOrder(
        {
          total_amount: total,
          ...formData,
        },
        orderItems
      );

      if (orderId) {
        await clearCart();
        navigate(`/order-confirmation/${orderId}`);
      }
    } catch (error) {
      console.error("Error placing order:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen pb-8">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link to="/cart">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
          <Package className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-6">
            Add items to your cart before checking out
          </p>
          <Link to="/products">
            <Button size="lg" className="rounded-full">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/cart">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          </Link>
          <h1 className="text-lg font-semibold">Checkout</h1>
          <div className="w-5" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="bg-secondary/30 rounded-2xl p-6 space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
                <div className="flex gap-3">
                  <img
                    src={item.products.image}
                    alt={item.products.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div>
                    <p className="font-medium">{item.products.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity}
                    </p>
                  </div>
                </div>
                <p className="font-semibold">
                  GH₵{(item.products.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
            <div className="border-t border-border pt-4 flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>GH₵{total.toFixed(2)}</span>
            </div>
          </div>
        </motion.div>

        {/* Shipping Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-semibold mb-4">Shipping Information</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="shipping_name">Full Name</Label>
              <Input
                id="shipping_name"
                name="shipping_name"
                value={formData.shipping_name}
                onChange={handleChange}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="shipping_email">Email</Label>
              <Input
                id="shipping_email"
                name="shipping_email"
                type="email"
                value={formData.shipping_email}
                onChange={handleChange}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="shipping_phone">Phone Number</Label>
              <Input
                id="shipping_phone"
                name="shipping_phone"
                type="tel"
                value={formData.shipping_phone}
                onChange={handleChange}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="shipping_address">Street Address</Label>
              <Input
                id="shipping_address"
                name="shipping_address"
                value={formData.shipping_address}
                onChange={handleChange}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="shipping_city">City</Label>
              <Input
                id="shipping_city"
                name="shipping_city"
                value={formData.shipping_city}
                onChange={handleChange}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="shipping_region">Region</Label>
              <select
                id="shipping_region"
                name="shipping_region"
                value={formData.shipping_region}
                onChange={handleChange}
                required
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a region</option>
                {GHANA_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="payment_method">Payment Method</Label>
              <select
                id="payment_method"
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                required
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="cash_on_delivery">Cash on Delivery</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full mt-6"
              disabled={submitting}
            >
              {submitting ? "Processing..." : "Place Order"}
            </Button>
          </form>
        </motion.div>
      </div>
    </main>
  );
};

export default Checkout;
