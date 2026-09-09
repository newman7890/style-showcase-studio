import { SEO } from "@/components/SEO";
import { NewsletterSubscribe } from "@/components/NewsletterSubscribe";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useMemo, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Testimonials } from "@/components/home/Testimonials";
import { ProductMarquee } from "@/components/home/ProductMarquee";
import { FlashDeals } from "@/components/home/FlashDeals";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/hooks/useCart";
import {
  fetchSpotlightSettings,
  getSpotlightSettingsFromStorage,
  SpotlightSettings,
} from "@/services/siteSettingsService";
import {
  Search,
  Camera,
  MapPin,
  ChevronDown,
  Zap,
  Laptop,
  Shirt,
  Home as HomeIcon,
  UtensilsCrossed,
  Puzzle,
  Star,
  StarHalf,
  ShoppingCart,
  Menu,
  User,
  ScanBarcode,
  ChevronRight,
  Tag,
  Gift,
  Flame,
  Heart,
  MessageCircle,
  Mail,
  ShoppingBag,
  Footprints,
  Pocket,
  Layers,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  slug: string;
  department?: string | null;
  image: string | null;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
  sale_price?: number | null;
  sale_ends_at?: string | null;
}

// ─── Static category icon map ──────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  fashion: Shirt,
  clothing: Shirt,
  jeans: Pocket,
  "t-shirts": Shirt,
  tshirts: Shirt,
  jackets: Layers,
  shoes: Footprints,
  bags: ShoppingBag,
  electronics: Laptop,
  gadgets: Laptop,
  home: HomeIcon,
  kitchen: UtensilsCrossed,
  food: UtensilsCrossed,
  toys: Puzzle,
  deals: Zap,
  other: Tag,
};

const DEFAULT_CATEGORY_ICONS = [Zap, Laptop, Shirt, HomeIcon, UtensilsCrossed, Puzzle];

// ─── Default fallback category image URLs ─────────────────────────────────────
const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  paintings: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&q=80",
  "books-stationery": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
  jeans: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80",
  "phones-tablets": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
  "mens-clothing": "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=800&q=80",
  "womens-clothing": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
  "shoes-sneakers": "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80",
  "kitchen-dining": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80",
  "audio-headphones": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
  fashion: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80",
  gadgets: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
  art: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&q=80",
  home: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80",
};

// ─── Star Rating helper ────────────────────────────────────────────────────────
const StarRating = ({ rating, count }: { rating: number; count: number }) => {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f${i}`} className="w-3 h-3 fill-primary text-primary" />
        ))}
        {half && <StarHalf className="w-3 h-3 fill-primary text-primary" />}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e${i}`} className="w-3 h-3 text-muted-foreground/30" />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">({count.toLocaleString()})</span>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const Home = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { addToCart, cartItems } = useCart();
  const navigate = useNavigate();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const queryClient = useQueryClient();

  // ── Spotlight Marquee Settings (Database + Local fallback + Realtime) ──────
  const { data: spotlightSettings = getSpotlightSettingsFromStorage() } = useQuery<SpotlightSettings>({
    queryKey: ["site-settings-spotlight"],
    queryFn: async () => {
      const { settings } = await fetchSpotlightSettings();
      return settings;
    },
    initialData: getSpotlightSettingsFromStorage(),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const handleSettingsChange = () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings-spotlight"] });
    };
    window.addEventListener("spotlight-settings-changed", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);

    const channel = supabase
      .channel("public:site_settings_spotlight")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["site-settings-spotlight"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("spotlight-settings-changed", handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, [queryClient]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: featuredProducts = [] } = useQuery<Product[]>({
    queryKey: ["featured-products-home", spotlightSettings.pinnedProductIds],
    queryFn: async () => {
      const pinnedIds = (spotlightSettings.pinnedProductIds || []).filter(Boolean);
      let pinnedItems: Product[] = [];
      if (pinnedIds.length > 0) {
        const { data: pinnedData } = await supabase
          .from("products")
          .select("id, name, price, image, category, department, sale_price, sale_ends_at, colors, status")
          .in("id", pinnedIds);
        if (pinnedData) {
          pinnedItems = pinnedData;
        }
      }

      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image, category, department, sale_price, sale_ends_at, colors, status")
        .order("created_at", { ascending: false })
        .limit(36);
      if (error) throw error;

      const combined = [...pinnedItems];
      (data || []).forEach((item) => {
        if (!combined.some((p) => p.id === item.id)) {
          combined.push(item);
        }
      });

      return combined;
    },
  });

  const marqueeDisplayProducts = useMemo(() => {
    if (!spotlightSettings.pinnedProductIds || spotlightSettings.pinnedProductIds.length === 0) {
      return featuredProducts;
    }
    const pinned = spotlightSettings.pinnedProductIds
      .map((id) => featuredProducts.find((p) => p.id === id))
      .filter(Boolean) as Product[];

    const remaining = featuredProducts.filter(
      (p) => !spotlightSettings.pinnedProductIds.includes(p.id)
    );

    return [...pinned, ...remaining];
  }, [featuredProducts, spotlightSettings.pinnedProductIds]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["homepage-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: marketingBanners = [] } = useQuery<{ id: string; title: string; badge: string; label: string; image_url: string; link_url: string; placement: string }[]>({
    queryKey: ["marketing-banners-home"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("marketing_banners")
          .select("id, title, badge, label, image_url, link_url, placement")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const dealBanners = useMemo(() => {
    return marketingBanners.filter((b) => !b.placement || b.placement === "deal_cards");
  }, [marketingBanners]);

  const promoBanners = useMemo(() => {
    return marketingBanners.filter((b) => b.placement === "promo_banner");
  }, [marketingBanners]);

  const handleAdClick = async (adId?: string, rawLink?: string) => {
    if (adId) {
      try {
        await (supabase as any).rpc("increment_banner_click", { banner_id: adId }).catch(() => {});
      } catch {}
    }
    handleDealClick(rawLink);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddToCart = async (product: Product) => {
    // useCart.addToCart handles its own success/error toasts (including the
    // signed-out case), so we don't fire a duplicate/false success toast here.
    await addToCart(product.id, 1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleDealClick = (rawLink?: string) => {
    if (!rawLink) {
      navigate("/department/home");
      return;
    }
    const target = rawLink.trim();
    if (!target) {
      navigate("/department/home");
      return;
    }
    if (target.startsWith("http://") || target.startsWith("https://")) {
      window.location.href = target;
      return;
    }

    const clean = target.toLowerCase().replace(/^\/+/, "").trim();

    // Direct section & category aliases
    if (clean === "art" || clean === "painted art" || clean === "art gallery" || clean === "art-gallery") {
      navigate("/art");
      return;
    }
    if (clean === "fashion" || clean === "clothing" || clean === "department/fashion") {
      navigate("/department/fashion");
      return;
    }
    if (clean === "gadgets" || clean === "electronics" || clean === "department/gadgets") {
      navigate("/department/gadgets");
      return;
    }
    if (clean === "home" || clean === "kitchen" || clean === "department/home") {
      navigate("/department/home");
      return;
    }
    if (clean === "other" || clean === "department/other") {
      navigate("/department/other");
      return;
    }
    if (clean === "products" || clean === "all" || clean === "deals") {
      navigate("/department/home");
      return;
    }

    // If it's a relative path starting with slash (e.g. /product/123 or /art)
    if (target.startsWith("/")) {
      navigate(target);
      return;
    }

    // Otherwise, treat as a search query for products matching that title/term!
    navigate(`/department/home?search=${encodeURIComponent(target)}`);
  };

  // ── Category pill data (DB or fallback) ──────────────────────────────────
  const categoryItems =
    categories.length > 0
      ? categories.map((cat, i) => ({
          id: cat.id,
          label: cat.name,
          slug: cat.slug,
          department: cat.department || "home",
          Icon: CATEGORY_ICONS[cat.slug.toLowerCase()] ?? DEFAULT_CATEGORY_ICONS[i % DEFAULT_CATEGORY_ICONS.length],
        }))
      : [
          { id: "deals", label: "Deals", slug: "deals", department: "home", Icon: Zap },
          { id: "electronics", label: "Electronics", slug: "electronics", department: "gadgets", Icon: Laptop },
          { id: "fashion", label: "Fashion", slug: "fashion", department: "fashion", Icon: Shirt },
          { id: "home", label: "Home", slug: "home", department: "home", Icon: HomeIcon },
          { id: "kitchen", label: "Kitchen", slug: "kitchen", department: "home", Icon: UtensilsCrossed },
          { id: "toys", label: "Toys", slug: "toys", department: "other", Icon: Puzzle },
        ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background font-inter antialiased">
      <SEO
        title="Shop More. Save More. Live Better."
        description="Discover top products, electronics, fashion, gadgets, home decor, and authentic fine art at Trades Point. Enjoy instant delivery and secure checkout."
        keywords={[
          "Trades Point",
          "Online Marketplace Ghana",
          "Shop Fashion Ghana",
          "Buy Electronics Ghana",
          "Home Decor Store",
          "Ghana Online Shopping",
          "Paystack Shopping Ghana",
          "Fine Art Marketplace"
        ]}
        schema={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Trades Point",
            "url": "https://tradespoint.store",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://tradespoint.store/department/home?search={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Trades Point",
            "url": "https://tradespoint.store",
            "logo": "https://tradespoint.store/logo.png"
          }
        ]}
      />
      
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Header />




      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex flex-col gap-6 pb-24 pt-4 max-w-7xl mx-auto w-full">

        {/* Hero Section */}
        <section className="px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#f2f4f3] rounded-3xl p-6 md:p-10 lg:p-14 relative overflow-hidden">
            {/* Left Content (Text) */}
            <div className="flex flex-col gap-5 z-10 justify-center order-2 md:order-1">
              <div className="inline-flex items-center gap-2 bg-[#9bcdb1] text-white px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-widest w-max">
                <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
                Spring 2026 Collection
              </div>
              
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-[#1c1c1c] leading-[1.05] tracking-tight">
                Wear what defines<br/>you
              </h2>
              
              <p className="text-[#647187] text-base md:text-lg max-w-md leading-relaxed mt-1">
                Thoughtfully crafted essentials that blend comfort with contemporary style. Made for people who move.
              </p>
              
              <div className="flex items-center gap-5 mt-3">
                <Link to="/products" className="bg-[#2d8a57] hover:bg-[#237046] text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 transition-colors text-sm">
                  Shop Now <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              <div className="flex items-center gap-8 mt-6 pt-6 border-t border-gray-200/60">
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-bold text-[#1c1c1c]">10K+</span>
                  <span className="text-[11px] text-[#647187]">Happy Customers</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-bold text-[#1c1c1c]">500+</span>
                  <span className="text-[11px] text-[#647187]">Products</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-bold text-[#1c1c1c]">4.9</span>
                  <span className="text-[11px] text-[#647187]">Avg Rating</span>
                </div>
              </div>
            </div>
            
            {/* Right Image */}
            <div className="relative h-[300px] md:h-full min-h-[400px] rounded-2xl overflow-hidden order-1 md:order-2">
              <img 
                src="/hero-image.jpg" 
                alt="Spring Collection Model" 
                className="absolute inset-0 w-full h-full object-cover object-top rounded-2xl"
              />
            </div>
          </div>
        </section>

        {/* ── Infinite Live Product Showcase Marquee ── */}
        <ProductMarquee
          products={marqueeDisplayProducts}
          title={spotlightSettings.title}
          subtitle={spotlightSettings.subtitle}
          speed={spotlightSettings.speed}
          enabled={spotlightSettings.enabled}
        />

        {/* ── Lightning Flash Deals with Live Countdown ── */}
        <FlashDeals products={featuredProducts} />

        {/* Deal of the Day (Only displayed when real marketing banners exist) */}
        {dealBanners.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground font-plus-jakarta">
                  Deal of the Day
                </h2>
              </div>
              <Link
                to="/department/home"
                className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
              >
                See all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="overflow-x-auto hide-scrollbar">
              <div className="flex gap-4 px-4 min-w-max">
                {dealBanners.map((deal, i) => (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="w-[260px] bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 flex-shrink-0 cursor-pointer"
                    onClick={() => handleDealClick(deal.link_url)}
                  >
                    <div className="h-36 bg-secondary/50 overflow-hidden">
                      <img
                        src={deal.image_url}
                        alt={deal.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-3 flex flex-col gap-1.5">
                      <div className="flex gap-2 items-center">
                        {deal.badge && (
                          <span className="bg-primary text-primary-foreground text-[11px] font-semibold px-2 py-0.5 rounded">
                            {deal.badge}
                          </span>
                        )}
                        {deal.label && (
                          <span className="text-primary font-bold text-[11px] uppercase tracking-wide">
                            {deal.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground font-medium line-clamp-1">{deal.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Promotional Banner – Gift Cards */}
        <section className="px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative w-full h-40 rounded-2xl overflow-hidden bg-primary/20"
          >
            {/* Decorative circles */}
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/40" />
            <div className="absolute -right-2 bottom-0 w-20 h-20 rounded-full bg-primary/30" />
            <div className="absolute right-4 top-4 opacity-30">
              <Gift className="w-24 h-24 text-primary" />
            </div>
            <div className="relative z-10 p-5 flex flex-col justify-center h-full">
              <h3 className="text-2xl font-bold text-foreground font-plus-jakarta">
                Gift Cards
              </h3>
              <p className="text-sm text-foreground/80 mt-0.5">
                Instant digital delivery for any occasion.
              </p>
              <Link to="/gift-cards" className="mt-3 self-start">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="px-5 py-1.5 bg-foreground text-background rounded-full text-xs font-semibold hover:bg-foreground/90 transition-colors"
                >
                  Buy Now
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Browse by Category grid */}
        {categories.length > 0 && (
          <section className="flex flex-col gap-3 px-4">
            <h2 className="text-lg font-semibold text-foreground font-plus-jakarta">
              Shop by Category
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {categories.slice(0, 4).map((cat, i) => {
                const categoryImg =
                  cat.image ||
                  featuredProducts.find((p) => {
                    const pSlug = (p.category || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    return p.category === cat.name || pSlug === cat.slug || pSlug.includes(cat.slug);
                  })?.image;

                return (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Link
                      to={`/department/${cat.department || "home"}?category=${cat.slug}`}
                      className="block relative aspect-[4/3] bg-secondary/50 rounded-xl overflow-hidden group"
                    >
                      {categoryImg ? (
                        <img
                          src={categoryImg}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {(() => {
                            const Icon =
                              CATEGORY_ICONS[cat.slug.toLowerCase()] ??
                              DEFAULT_CATEGORY_ICONS[i % DEFAULT_CATEGORY_ICONS.length];
                            return <Icon className="w-12 h-12 text-primary opacity-50" />;
                          })()}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-semibold">{cat.name}</p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Testimonials */}
        <Testimonials />

        {/* Newsletter Section */}
        <NewsletterSubscribe variant="card" />
      </main>

      {/* ── Custom bottom nav (Stitch-style, wraps the existing BottomNav) ── */}
      <BottomNav />
    </div>
  );
};

export default Home;