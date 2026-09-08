import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Flame, ChevronRight, Star, ShoppingBag, Eye } from "lucide-react";

interface MarqueeProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
  department?: string | null;
  sale_price?: number | null;
  sale_ends_at?: string | null;
  colors?: any[] | null;
  status?: string;
}

interface ProductMarqueeProps {
  products: MarqueeProduct[];
  title?: string;
  subtitle?: string;
  speed?: number; // 1 = slow, 2 = normal, 3 = fast
  enabled?: boolean;
}

const DEPT_BADGES: Record<string, { label: string; color: string }> = {
  fashion: { label: "Fashion 👗", color: "bg-pink-500/10 text-pink-700 border-pink-200 dark:text-pink-300 dark:border-pink-800" },
  gadgets: { label: "Gadgets 📱", color: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800" },
  art: { label: "Art 🎨", color: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800" },
  home: { label: "Home 🏠", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800" },
  other: { label: "General 📦", color: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800" },
};

export const ProductMarquee: React.FC<ProductMarqueeProps> = ({
  products,
  title = "Live Marketplace Spotlight",
  subtitle = "Continuous moving showcase of trending products & hot deals",
  speed = 2,
  enabled = true,
}) => {
  // Map speed setting to animation duration (seconds)
  const speedDuration = speed === 1 ? 55 : speed === 3 ? 25 : 38;

  // Unconditionally called hook
  const displayItems = useMemo(() => {
    const valid = (products || []).filter((p) => p && p.image);
    if (valid.length === 0) return [];
    // Ensure we have enough cards to form a smooth seamless loop (duplicate as needed)
    return [...valid, ...valid, ...valid, ...valid];
  }, [products]);

  // If disabled via admin or no valid items, render nothing
  if (!enabled || displayItems.length === 0) return null;

  return (
    <section className="relative w-full py-6 overflow-hidden select-none">
      {/* Header with Live Dot & See All */}
      <div className="flex items-center justify-between px-4 mb-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground font-plus-jakarta">
                {title}
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
              {subtitle}
            </p>
          </div>
        </div>

        <Link
          to="/products"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full"
        >
          <span>Shop All</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Marquee Track Container with Edge Gradient Masks */}
      <div className="relative w-full overflow-hidden pause-marquee-on-hover">
        {/* Left Edge Gradient Fade Mask */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />

        {/* Right Edge Gradient Fade Mask */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-background via-background/80 to-transparent z-10" />

        {/* Moving Marquee Strip */}
        <div
          className="animate-product-marquee gap-3.5 sm:gap-5 py-2 px-2"
          style={{ animationDuration: `${speedDuration}s` }}
        >
          {displayItems.map((product, index) => {
            const deptKey = (product.department || "other").toLowerCase();
            const deptInfo = DEPT_BADGES[deptKey] || DEPT_BADGES.other;
            const origPrice = Number(product.price || 0);
            const salePrice = product.sale_price != null ? Number(product.sale_price) : null;
            const isSaleExpired = Boolean(
              product.sale_ends_at && new Date(product.sale_ends_at).getTime() <= Date.now()
            );
            const hasDiscount = salePrice != null && salePrice > 0 && salePrice < origPrice && !isSaleExpired;
            const discountPercent = hasDiscount && origPrice > 0
              ? Math.round(((origPrice - salePrice!) / origPrice) * 100)
              : null;

            return (
              <Link
                key={`${product.id}-${index}`}
                to={`/product/${product.id}`}
                className="group relative flex flex-col w-[200px] sm:w-[240px] bg-card hover:bg-card/90 border border-border/80 hover:border-primary/50 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 shrink-0 transform hover:-translate-y-1.5"
              >
                {/* Product Image Area */}
                <div className="relative w-full h-36 sm:h-44 bg-secondary/30 overflow-hidden flex items-center justify-center">
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs backdrop-blur-md ${deptInfo.color}`}>
                      {deptInfo.label}
                    </span>

                    {discountPercent ? (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-600 text-white shadow-xs flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 fill-white" />
                        -{discountPercent}%
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        4.9
                      </span>
                    )}
                  </div>

                  {/* Hover Quick Action Indicator */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <span className="bg-white/95 dark:bg-black/90 text-foreground text-[11px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 transform scale-90 group-hover:scale-100 transition-transform">
                      <Eye className="w-3 h-3 text-primary" /> View Product
                    </span>
                  </div>
                </div>

                {/* Product Details Area */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-1.5 bg-card">
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block line-clamp-1">
                      {product.category || "Featured Product"}
                    </span>
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 mt-0.5">
                      {product.name}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-auto">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-foreground">
                        GH₵{(hasDiscount ? salePrice! : origPrice).toFixed(2)}
                      </span>
                      {hasDiscount && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          GH₵{origPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <span className="w-6 h-6 rounded-full bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground text-primary flex items-center justify-center transition-colors shadow-2xs">
                      <ShoppingBag className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
