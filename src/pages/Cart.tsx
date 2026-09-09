import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { ShoppingBag, Plus, Minus, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCart, getCartItemImage } from "@/hooks/useCart";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const Cart = () => {
  const { cartItems, loading, updateQuantity, removeFromCart, total, originalTotal, savingsTotal, getItemUnitPrice, getItemAvailableStock } = useCart();
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
              <div className="divide-y divide-border">
                {cartItems.map((item, index) => {
                  const unitPrice = getItemUnitPrice(item);
                  const isDiscounted = unitPrice < (item.products?.price || 0);
                  const availableStock = getItemAvailableStock(item);
                  const isMaxStockReached = item.quantity >= availableStock;

                  return (
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
                              src={getCartItemImage(item)}
                              alt={item.products.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-base group-hover:underline">{item.products.name}</h3>
                              {isDiscounted && (
                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                                  ⚡ Flash Deal
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{item.products.category}</p>
                            {item.selected_color && !(item.selected_color as any).isGiftCard && (
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className="w-4 h-4 rounded-full border border-gray-300 inline-block"
                                  style={{ backgroundColor: (item.selected_color as any).hex || '#ccc' }}
                                />
                                <span className="text-xs text-muted-foreground">{(item.selected_color as any).name}</span>
                              </div>
                            )}
                            {(item.selected_color as any)?.isGiftCard && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                <p>To: {(item.selected_color as any).recipientName} ({(item.selected_color as any).recipientEmail})</p>
                                {(item.selected_color as any).message && <p className="truncate max-w-[200px]">Message: {(item.selected_color as any).message}</p>}
                              </div>
                            )}
                            {item.selected_size && (
                              <p className="text-xs text-muted-foreground mt-1">Size: {item.selected_size}</p>
                            )}
                          </div>
                        </Link>

                        {/* Quantity controls */}
                        <div className="flex flex-col items-center justify-center gap-1">
                          {!(item.selected_color as any)?.isGiftCard ? (
                            <div className="flex items-center gap-1 bg-secondary rounded-full p-1">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                              <button
                                onClick={() => {
                                  if (isMaxStockReached) {
                                    toast.error(`Only ${availableStock} available in stock`);
                                    return;
                                  }
                                  updateQuantity(item.id, item.quantity + 1);
                                }}
                                disabled={isMaxStockReached}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  isMaxStockReached ? "opacity-30 cursor-not-allowed text-muted-foreground" : "hover:bg-background"
                                }`}
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Digital (1)</span>
                          )}
                          {isMaxStockReached && availableStock < 9999 && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              Max stock ({availableStock})
                            </span>
                          )}
                        </div>

                        {/* Total price */}
                        <div className="text-right">
                          {isDiscounted ? (
                            <div>
                              <p className="font-semibold text-base text-rose-600 dark:text-rose-400">
                                GH₵{(unitPrice * item.quantity).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground line-through">
                                GH₵{(item.products.price * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          ) : (
                            <p className="font-semibold text-base">
                              GH₵{(unitPrice * item.quantity).toFixed(2)}
                            </p>
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors ml-2"
                          aria-label="Remove item"
                        >
                          <X className="w-4 h-4 pointer-events-none" />
                        </button>
                      </div>

                      {/* Mobile layout */}
                      <div className="flex md:hidden gap-4">
                        <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                          <div className="w-20 h-24 bg-secondary rounded-lg overflow-hidden">
                            <img
                              src={getCartItemImage(item)}
                              alt={item.products.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-semibold text-sm">{item.products.name}</h3>
                                {isDiscounted && (
                                  <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200">
                                    ⚡ Flash Deal
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.products.category}</p>
                              {item.selected_color && !(item.selected_color as any).isGiftCard && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span
                                    className="w-3 h-3 rounded-full border border-gray-300 inline-block"
                                    style={{ backgroundColor: (item.selected_color as any).hex || '#ccc' }}
                                  />
                                  <span className="text-xs text-muted-foreground">{(item.selected_color as any).name}</span>
                                </div>
                              )}
                              {(item.selected_color as any)?.isGiftCard && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <p>To: {(item.selected_color as any).recipientName}</p>
                                </div>
                              )}
                              {item.selected_size && (
                                <p className="text-xs text-muted-foreground mt-1">Size: {item.selected_size}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="text-muted-foreground hover:text-foreground active:scale-90 transition-all select-none touch-manipulation cursor-pointer"
                              aria-label="Remove item"
                            >
                              <X className="w-4 h-4 pointer-events-none" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {!(item.selected_color as any)?.isGiftCard ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                      className="w-7 h-7 border border-border rounded-full flex items-center justify-center hover:bg-secondary active:scale-90 transition-all select-none touch-manipulation cursor-pointer"
                                      aria-label="Decrease quantity"
                                    >
                                      <Minus className="w-3 h-3 pointer-events-none" />
                                    </button>
                                    <span className="text-sm font-medium w-5 text-center select-none tabular-nums">{item.quantity}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isMaxStockReached) {
                                          toast.error(`Only ${availableStock} available in stock`);
                                          return;
                                        }
                                        updateQuantity(item.id, item.quantity + 1);
                                      }}
                                      disabled={isMaxStockReached}
                                      className={`w-7 h-7 border border-border rounded-full flex items-center justify-center select-none touch-manipulation cursor-pointer transition-all ${
                                        isMaxStockReached ? "opacity-30 cursor-not-allowed text-muted-foreground" : "hover:bg-secondary active:scale-90"
                                      }`}
                                      aria-label="Increase quantity"
                                    >
                                      <Plus className="w-3 h-3 pointer-events-none" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs font-medium px-2 py-0.5 bg-secondary rounded text-muted-foreground">Digital Item</span>
                                )}
                              </div>
                              {isMaxStockReached && availableStock < 9999 && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  Max stock ({availableStock})
                                </span>
                              )}
                            </div>
                            <div>
                              {isDiscounted ? (
                                <div className="text-right">
                                  <span className="text-[11px] text-muted-foreground line-through block">
                                    GH₵{(item.products.price * item.quantity).toFixed(2)}
                                  </span>
                                  <span className="font-semibold text-sm text-rose-600 dark:text-rose-400">
                                    GH₵{(unitPrice * item.quantity).toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <p className="font-semibold text-sm">
                                  GH₵{(unitPrice * item.quantity).toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
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
                className="lg:sticky lg:top-24 bg-card/60 backdrop-blur-xs p-6 rounded-2xl border border-border/80 shadow-xs"
              >
                <h2 className="text-lg font-semibold mb-6 uppercase tracking-wider">Order Summary</h2>

                <div className="space-y-4 pb-6 border-b border-border">
                  {savingsTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Original Price</span>
                      <span className="line-through text-muted-foreground">GH₵{originalTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {savingsTotal > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="flex items-center gap-1">⚡ Promotional Discount</span>
                      <span>-GH₵{savingsTotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">GH₵{total.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-xs text-muted-foreground">Calculated at checkout</span>
                  </div>
                </div>

                <div className="flex justify-between py-6 text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary font-bold">GH₵{total.toFixed(2)}</span>
                </div>

                <Link to="/checkout" className="block">
                  <Button className="w-full h-14 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-sm uppercase tracking-widest font-semibold shadow-md">
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
