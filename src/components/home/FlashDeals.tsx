import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Zap, Flame, Clock, ChevronRight, ChevronLeft, ShoppingBag, Store } from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { getFlashDealSettings, FlashDealSettings, LinkedFlashDeal } from "@/components/admin/FlashDealsManagement";

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
  products?: FlashDealProduct[];
}

// Fallback high-energy deals if database has few live sale items
const DEFAULT_FLASH_ITEMS: FlashDealProduct[] = [
  {
    id: "fd1",
    name: "Noise-Cancelling Wireless Pro Earbuds",
    price: 340,
    sale_price: 199,
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80",
    category: "Gadgets",
    department: "gadgets",
    stock: 8,
    sellerName: "SoundCore Hub",
    claimedPercent: 88,
  },
  {
    id: "fd2",
    name: "Minimalist Oversized Vintage Denim Jacket",
    price: 280,
    sale_price: 175,
    image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&q=80",
    category: "Fashion",
    department: "fashion",
    stock: 5,
    sellerName: "Urban Streetwear",
    claimedPercent: 72,
  },
  {
    id: "fd3",
    name: "Nordic Ceramic Ambient Glow Table Lamp",
    price: 210,
    sale_price: 135,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80",
    category: "Home Decor",
    department: "home",
    stock: 12,
    sellerName: "Nordic Living",
    claimedPercent: 64,
  },
  {
    id: "fd4",
    name: "Ultra-Fast Smartwatch Series 9 Titan",
    price: 490,
    sale_price: 310,
    image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80",
    category: "Gadgets",
    department: "gadgets",
    stock: 4,
    sellerName: "Apex Tech",
    claimedPercent: 93,
  },
  {
    id: "fd5",
    name: "Handcrafted Luxury Leather Crossbody Bag",
    price: 380,
    sale_price: 245,
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
    category: "Fashion",
    department: "fashion",
    stock: 6,
    sellerName: "AfroChic Crafts",
    claimedPercent: 81,
  },
];

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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Admin Flash Deals Settings
  const [adminSettings, setAdminSettings] = useState<FlashDealSettings>(getFlashDealSettings);

  useEffect(() => {
    const handleSettingsChange = () => {
      setAdminSettings(getFlashDealSettings());
    };
    window.addEventListener("flash-deals-settings-changed", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      window.removeEventListener("flash-deals-settings-changed", handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  const countdownTarget = adminSettings.endsAt;
  const { formattedHours, formattedMinutes, formattedSeconds, isExpired } = useCountdown(countdownTarget);

  // If disabled by admin, hide section
  if (!adminSettings.enabled) {
    return null;
  }

  // Display items: Prioritize admin-linked deals (which can come from any seller)
  const displayDeals: FlashDealProduct[] = useMemo(() => {
    if (adminSettings.deals && adminSettings.deals.length > 0) {
      return adminSettings.deals.map((deal) => ({
        id: deal.productId,
        name: deal.productName,
        image: deal.productImage,
        price: deal.originalPrice,
        sale_price: deal.flashPrice,
        sellerName: deal.sellerName,
        category: deal.category,
        department: deal.department,
        claimedPercent: deal.claimedPercent,
      }));
    }

    // Otherwise fallback to live products on sale
    const saleItems = (products || []).filter(
      (p) => p && p.sale_price && p.sale_price < p.price && p.image
    );
    if (saleItems.length >= 4) return saleItems;
    return [...saleItems, ...DEFAULT_FLASH_ITEMS.filter((f) => !saleItems.some((s) => s.id === f.id))];
  }, [adminSettings.deals, products]);

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
                        {product.category || "Hot Deal"}
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
