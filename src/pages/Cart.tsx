import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { ShoppingBag, Plus, Minus, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/contexts/LanguageContext";

const Cart = () => {
  const { cartItems, loading, updateQuantity, removeFromCart, total } = useCart();
  const { t } = useLanguage();

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-16 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">{t("loading")}</p>
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
          <div className="container mx-auto px-4 py-12 max-w-7xl">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold tracking-tight mb-12"
            >
              Shopping Bag
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
              <h2 className="text-xl font-semibold mb-2">{t("emptyCart")}</h2>
              <p className="text-muted-foreground mb-8 text-center max-w-sm">
                {t("startShopping")}
              </p>
              <Link to="/products">
                <Button size="lg" className="rounded-none bg-foreground text-background hover:bg-foreground/90 px-12">
                  {t("continueShopping")}
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
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-10"
          >
            Shopping Bag ({cartItems.reduce((s, i) => s + i.quantity, 0)})
          </motion.h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16">
            {/* Left: Cart Items */}
            <div className="lg:col-span-2">
              {/* Header row - desktop */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto] gap-4 pb-4 border-b border-border text-sm text-muted-foreground uppercase tracking-wider">
                <span>Product</span>
                <span className="text-center">Quantity</span>
                <span className="text-right">Price</span>
                <span className="w-8" />
              </div>

              <div className="divide-y divide-border">
                {cartItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="py-6"
                  >
                    {/* Desktop layout */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center">
                      <Link to={`/product/${item.product_id}`} className="flex gap-5 items-center group">
                        <div className="w-24 h-28 bg-secondary rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={item.products.image}
                            alt={item.products.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base group-hover:underline">{item.products.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{item.products.category}</p>
                        </div>
                      </Link>

                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 border border-border rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 border border-border rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="text-right font-semibold">
                        GH₵{(item.products.price * item.quantity).toFixed(2)}
                      </p>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Mobile layout */}
                    <div className="flex md:hidden gap-4">
                      <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                        <div className="w-20 h-24 bg-secondary rounded-lg overflow-hidden">
                          <img
                            src={item.products.image}
                            alt={item.products.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-sm">{item.products.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.products.category}</p>
                          </div>
                          <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-7 border border-border rounded-full flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 border border-border rounded-full flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="font-semibold text-sm">
                            GH₵{(item.products.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6">
                <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                  ← Continue Shopping
                </Link>
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:sticky lg:top-24"
              >
                <h2 className="text-lg font-semibold mb-6 uppercase tracking-wider">Order Summary</h2>

                <div className="space-y-4 pb-6 border-b border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>GH₵{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>Free</span>
                  </div>
                </div>

                <div className="flex justify-between py-6 text-lg font-semibold">
                  <span>Total</span>
                  <span>GH₵{total.toFixed(2)}</span>
                </div>

                <Link to="/checkout" className="block">
                  <Button className="w-full h-14 rounded-none bg-foreground text-background hover:bg-foreground/90 text-sm uppercase tracking-widest font-medium">
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default Cart;
