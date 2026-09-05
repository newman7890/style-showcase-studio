import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Zap, Flame, Clock, ChevronRight, ChevronLeft, ShoppingBag, Store } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCountdown } from "@/hooks/useCountdown";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchFlashDealSettings,
  getFlashDealSettingsFromStorage,
  FlashDealSettings,
  LinkedFlashDeal,
  DEFAULT_FLASH_DEALS_SETTINGS,
} from "@/services/siteSettingsService";

export type { FlashDealSettings, LinkedFlashDeal };

export interface FlashDealProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
  department?: string | null;
  sale_price?: number | null;
  sale_ends_at?: string | null;
  stock?: number;
  sellerName?: string;
  claimedPercent?: number;
}

interface FlashDealsProps {
  products?: any[];
}

const getClaimedPercent = (id: string, customClaimed?: number): number => {
  if (customClaimed && customClaimed > 0) return customClaimed;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return 60 + (Math.abs(hash) % 32); // Between 60% and 91%
};

export const FlashDeals: React.FC<FlashDealsProps> = ({ products = [] }) => {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load settings from Supabase Database (with local storage as fallback)
  const { data: adminSettings = getFlashDealSettingsFromStorage() } = useQuery<FlashDealSettings>({
    queryKey: ["site-settings-flash-deals"],
    queryFn: async () => {
      const { settings } = await fetchFlashDealSettings();
      return settings;
    },
    initialData: getFlashDealSettingsFromStorage(),
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Subscribe to realtime database changes & custom window events
  useEffect(() => {
    // 1. Invalidate query when window receives custom event
    const handleSettingsChange = () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings-flash-deals"] });
    };
    window.addEventListener("flash-deals-settings-changed", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);

    // 2. Realtime listener for cross-device updates (phone, PC, other tabs)
    const channel = supabase
      .channel("public:site_settings_flash_deals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["site-settings-flash-deals"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("flash-deals-settings-changed", handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, [queryClient]);

  // Countdown timer with auto-renew so it never disappears into 00:00:00
  const countdownTarget = adminSettings.endsAt;
  const { formattedHours, formattedMinutes, formattedSeconds } = useCountdown(countdownTarget, true);

  // If explicitly disabled by admin, hide section
  if (!adminSettings.enabled) {
    return null;
  }

  // Display Deals Hierarchy:
  // 1. Explicit admin-configured deals
  // 2. Store products with deal discounts
  // 3. High quality default deals
  const displayDeals: FlashDealProduct[] = useMemo(() => {
    if (adminSettings.deals && adminSettings.deals.length > 0) {
      return adminSettings.deals.map((deal) => ({
        id: deal.productId,
        name: deal.productName,
        image: deal.productImage || "/placeholder.svg",
        price: Number(deal.originalPrice),
        sale_price: Number(deal.flashPrice),
        sellerName: deal.sellerName,
        category: deal.category,
        department: deal.department,
        claimedPercent: deal.claimedPercent,
      }));
    }

    if (products && products.length > 0) {
      const discounted = products.filter((p) => p.sale_price && p.sale_price < p.price);
      const pool = discounted.length > 0 ? discounted : products.slice(0, 6);
      return pool.map((p) => {
        const origPrice = Number(p.price || 100);
        const flashPrice = Number(p.sale_price || Math.round(origPrice * 0.75));
        return {
          id: p.id,
          name: p.name,
          image: p.image || "/placeholder.svg",
          price: origPrice,
          sale_price: flashPrice,
          sellerName: p.sellerName || "Trades Point Official",
          category: p.category,
          department: p.department,
          claimedPercent: getClaimedPercent(p.id),
        };
      });
    }

    return [];
  }, [adminSettings.deals, products]);

  if (displayDeals.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -320 : 320;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleClaim = (e: React.MouseEvent, product: FlashDealProduct) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product.id, 1);
    toast({
      title: "Flash Deal Claimed! ⚡",
      description: `Added "${product.name}" to your cart at GH₵${(product.sale_price || product.price).toFixed(2)}.`,
    });
  };

  return (
    <section className="relative w-full py-6 px-4 max-w-7xl mx-auto select-none">
      <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-orange-500/10 dark:from-rose-950/30 dark:via-amber-950/20 dark:to-orange-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-3xl p-4 sm:p-6 shadow-sm">
        
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground font-plus-jakarta flex items-center gap-1.5">
                  {adminSettings.title || "Lightning Flash Deals"}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wider animate-pulse">
                  <Flame className="w-3 h-3 fill-white" /> Live
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {adminSettings.subtitle || "Limited quantities at special promotional prices"}
              </p>
            </div>
          </div>

          {/* Countdown Clock */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 bg-background/80 dark:bg-card/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-border/80 shadow-xs">
              <Clock className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                Ends in:
              </span>
              <div className="flex items-center gap-1 font-mono font-bold text-sm text-foreground">
                <span className="bg-rose-600 text-white px-2 py-0.5 rounded-md text-xs">
                  {formattedHours}
                </span>
                <span className="text-rose-600 font-extrabold">:</span>
                <span className="bg-rose-600 text-white px-2 py-0.5 rounded-md text-xs">
                  {formattedMinutes}
                </span>
                <span className="text-rose-600 font-extrabold">:</span>
                <span className="bg-rose-600 text-white px-2 py-0.5 rounded-md text-xs">
                  {formattedSeconds}
                </span>
              </div>
            </div>

            {/* Scroll navigation buttons for desktop */}
            {displayDeals.length > 3 && (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => scroll("left")}
                  aria-label="Previous Deals"
                  className="w-8 h-8 rounded-full border border-border/80 bg-background hover:bg-secondary flex items-center justify-center text-foreground transition-colors shadow-2xs cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scroll("right")}
                  aria-label="Next Deals"
                  className="w-8 h-8 rounded-full border border-border/80 bg-background hover:bg-secondary flex items-center justify-center text-foreground transition-colors shadow-2xs cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Deals Slider Track */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 pt-1 hide-scrollbar snap-x snap-mandatory scroll-smooth"
        >
          {displayDeals.map((product) => {
            const salePrice = product.sale_price || product.price * 0.8;
            const originalPrice = product.price;
            const discountPercent = Math.max(1, Math.round(((originalPrice - salePrice) / originalPrice) * 100));
            const claimed = getClaimedPercent(product.id, product.claimedPercent);

            return (
              <div
                key={product.id}
                className="w-[240px] sm:w-[270px] shrink-0 snap-start bg-card hover:bg-card/95 border border-border/80 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                <Link to={`/product/${product.id}`} className="block relative">
                  {/* Image Container */}
                  <div className="relative w-full h-44 sm:h-48 bg-secondary/30 overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                      loading="lazy"
                    />

                    {/* Discount Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                      <span className="text-xs font-black px-2 py-1 rounded-lg bg-rose-600 text-white shadow-md flex items-center gap-0.5">
                        <Flame className="w-3 h-3 fill-white" />
                        -{discountPercent}%
                      </span>
                    </div>

                    {/* Limited Deal Pill */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-xs flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /> Deal
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Card Content */}
                <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400 block truncate">
                        {product.category || "Flash Deal"}
                      </span>
                      {product.sellerName && (
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 truncate max-w-[110px]">
                          <Store className="w-2.5 h-2.5 text-primary shrink-0" />
                          {product.sellerName}
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/product/${product.id}`}
                      className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug"
                    >
                      {product.name}
                    </Link>
                  </div>

                  {/* Pricing */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
                      GH₵{salePrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground line-through">
                      GH₵{originalPrice.toFixed(2)}
                    </span>
                  </div>

                  {/* Claimed Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                        <Flame className="w-3 h-3 fill-rose-600" />
                        {claimed}% Claimed
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Limited Stock
                      </span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-rose-600 rounded-full transition-all duration-700"
                        style={{ width: `${claimed}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => handleClaim(e, product)}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all active:scale-98 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Claim Deal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
