import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { ShoppingBag, Plus, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCart } from "@/hooks/useCart";

const Cart = () => {
  const { cartItems, loading, updateQuantity, removeFromCart, clearCart, total } = useCart();

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-16 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Loading cart...</p>
        </main>
        <BottomNav />
      </>
    );
  }

  if (cartItems.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-16 pb-20">
          <div className="container mx-auto px-4 py-8">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-semibold mb-8"
            >
              Shopping Cart
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center justify-center min-h-[50vh]"
            >
              <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-4">
                <ShoppingBag className="w-12 h-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-8 text-center max-w-sm">
                Looks like you haven't added anything to your cart yet
              </p>
              <Link to="/products">
                <Button size="lg" className="rounded-full">
                  Start Shopping
                </Button>
              </Link>
            </motion.div>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-semibold"
            >
              Shopping Cart
            </motion.h1>
            <Button
              variant="ghost"
              onClick={clearCart}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-4 mb-8">
            {cartItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4 bg-secondary/30 rounded-2xl p-4"
              >
                <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                  <img
                    src={item.products.image}
                    alt={item.products.name}
                    className="w-24 h-24 object-cover rounded-xl"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${item.product_id}`}>
                    <h3 className="font-medium mb-1 truncate">{item.products.name}</h3>
                  </Link>
                  <p className="text-sm text-muted-foreground mb-2">
                    GH₵{item.products.price.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="text-sm font-medium w-8 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <p className="font-semibold">
                    GH₵{(item.products.price * item.quantity).toFixed(2)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromCart(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-secondary/30 rounded-2xl p-6 space-y-4"
          >
            <div className="flex justify-between text-lg">
              <span>Subtotal</span>
              <span>GH₵{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>GH₵{total.toFixed(2)}</span>
            </div>
            <Link to="/checkout" className="block">
              <Button size="lg" className="w-full rounded-full">
                Proceed to Checkout
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default Cart;
