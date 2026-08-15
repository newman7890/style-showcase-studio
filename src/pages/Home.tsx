import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { Testimonials } from "@/components/home/Testimonials";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/hooks/useCart";
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
  paintings: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&q=80",
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
  art: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&q=80",
  home: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80",
};

// ─── Static deal data ──────────────────────────────────────────────────────────
const DEALS = [
  {
    id: "d1",
    badge: "Up to 40% off",
    label: "Prime Deal",
    title: "Pro Audio Noise-Canceling Headphones",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGe2obWm7B8tF06EoEkZGoG9dgS9f8-WMZm58vPj5G9o9Gx0Y11s7SZ3iYyEg9a2R0DCwEOCwnNyrIBYhJh9WhKlORgeYl3cKvQ9I6XA1wggzqro8gOZAA5yV1qwkBk6Gnq1C246Civ5eYP8Jn6Nno-uNANLidtv5eCM4WJF0K2RN7Mki-PpHmifaCqrY1IDlR768uUMsjcxITNKSef5gwBCTY897ygYYDdkyBHAitj-1je4T3uTNQhA",
  },
  {
    id: "d2",
    badge: "35% off",
    label: "Deal of the Day",
    title: "Smart Echo Generation 5",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBU_L-WcJaL-7RbKpz7UhosdyqOYav71FFuyvZcXLXGqQXXgYwql-DF7nfOs44H8DpxGe4oojj3BCg1vApY9Q7o3XJXvQvYHJy6EpHISL0FNtZY7LSNkmvtT74Os7d9N0_ia4a3iEO-3qCFPKj4zByTGqo2JzFbh4b49aBm6ih-LiEXOk644OItEDnpvHY8QT41YWViQNpxphyWBkiQ1Amqqn7F7wEurmpxIYrmrKq0NRjWkA8_DcUDZg",
  },
  {
    id: "d3",
    badge: "20% off",
    label: "Flash Sale",
    title: "4K Ultra HD Smart TV 55\"",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9K9LiiN9GYBhU2kkcQpLFJ_REWUqXr1atjGN7i2aHvMvHv1pl_KU7t1SZy9A6tI4ebjSpMIZEdAKtvk_tZ0WqsAhpb-winpiNFBj19STePXr7mo5VJiKFUj_1oUQTQeAC2-GP8BzMpOe2JuoGOG_KiXwul9-j7rv07bucxcADPeypUEhuwmAt4zMs4DtoUdI64M5eyBK08G21c-2wtZD9N2CfzPdWrsyHVkFSi6HfL4YZyvhQY67Dww",
  },
];

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

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: featuredProducts = [] } = useQuery<Product[]>({
    queryKey: ["featured-products-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image, sale_price, sale_ends_at")
        .limit(4);
      if (error) throw error;
      return data || [];
    },
  });

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
    const deals = marketingBanners.filter((b) => !b.placement || b.placement === "deal_cards");
    return deals.length > 0 ? deals : DEALS.map((d) => ({ ...d, link_url: "/department/home", placement: "deal_cards", image_url: d.image }));
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
                <Link to="/department/home?category=new" className="text-[#647187] hover:text-[#1c1c1c] font-medium flex items-center gap-1 transition-colors text-sm">
                  New Arrivals <ChevronRight className="w-4 h-4" />
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

        {/* Category Scroll */}
        <section className="overflow-x-auto hide-scrollbar">
          <div className="flex gap-4 px-4 min-w-max">
            {categoryItems.map(({ id, label, slug, department, Icon }, idx) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  to={`/department/${department}?category=${slug}`}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center border border-border group-hover:bg-primary/10 group-active:scale-95 transition-all duration-200">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">
                    {label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Deal of the Day */}
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
              {(marketingBanners.length > 0
                ? marketingBanners.map((b) => ({ id: b.id, badge: b.badge, label: b.label, title: b.title, image: b.image_url, link: b.link_url }))
                : DEALS.map((d) => ({ ...d, link: "/department/home" }))
              ).map((deal, i) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="w-[260px] bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 flex-shrink-0 cursor-pointer"
                  onClick={() => handleDealClick(deal.link)}
                >
                  <div className="h-36 bg-secondary/50 overflow-hidden">
                    <img
                      src={deal.image}
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

        {/* Recommended For You */}
        <section className="flex flex-col gap-3 px-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground font-plus-jakarta">
              Recommended for you
            </h2>
            <Link
              to="/department/home"
              className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {(featuredProducts.length > 0 ? featuredProducts : FALLBACK_PRODUCTS).slice(0, 4).map(
              (product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProductCard {...product} />
                </motion.div>
              )
            )}
          </div>
        </section>

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
                  DEFAULT_CATEGORY_IMAGES[cat.slug.toLowerCase()] ||
                  featuredProducts.find((p) => p.category === cat.slug)?.image;

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
        <section className="px-4 py-10 bg-[#f2f4f3] mt-4 flex flex-col items-center text-center rounded-3xl mx-4 lg:mx-0">
          <div className="w-14 h-14 bg-[#e8f3ec] rounded-full flex items-center justify-center mb-4">
            <Mail className="w-7 h-7 text-[#2d8a57]" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-[#1c1c1c] mb-2 font-plus-jakarta">
            Subscribe to our newsletter
          </h2>
          <p className="text-[#647187] text-sm mb-6 max-w-sm">
            Get updates on new collections and special offers.
          </p>
          <form 
            className="w-full max-w-sm flex flex-col gap-3" 
            onSubmit={(e) => { 
              e.preventDefault(); 
              toast({title: "Subscribed!", description: "You're on the list for updates."}); 
              (e.target as HTMLFormElement).reset();
            }}
          >
            <input 
              type="email" 
              placeholder="Your email address" 
              required
              className="w-full px-4 py-3 rounded-full border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-[#2d8a57]/50 shadow-sm text-sm"
            />
            <button 
              type="submit" 
              className="w-full bg-[#329363] text-white font-semibold py-3 rounded-full hover:bg-[#237046] transition-colors text-sm"
            >
              Subscribe
            </button>
          </form>
          <Link to="/settings/privacy" className="text-xs text-[#647187] mt-4 hover:underline">
            Privacy Policy
          </Link>
        </section>
      </main>

      {/* ── Custom bottom nav (Stitch-style, wraps the existing BottomNav) ── */}
      <BottomNav />
    </div>
  );
};

// ─── Fallback products (shown if DB returns empty) ─────────────────────────────
const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "f1",
    name: "Gooseneck Electric Tea Kettle, 1.0L Stainless Steel",
    price: 49.99,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDa6taF4pfGfDeEbj6gI0UqVcW13-hfSuj-yzfbS97e7CpvvEj2MpdusoV1GK4I4aXp3GMePAyUcYRMn6UEoXG-4NpzDFyl0hAcsVr78Mgvi0AWBJMhKBrIQqMoGUhS_6YnLsVMSByCF3DOqtKnsvOKXdBzwhf4ZmR79ln7FZZARxen9df5LyFhP5PCQ2jU5BDmwNyaDvv7c9J_dEPX8SYGS6FeRUp15fvzgP81YTzAr8Xl0PgdZf7rVw",
  },
  {
    id: "f2",
    name: "Mechanical Gaming Keyboard with Custom RGB Lighting",
    price: 129.0,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9K9LiiN9GYBhU2kkcQpLFJ_REWUqXr1atjGN7i2aHvMvHv1pl_KU7t1SZy9A6tI4ebjSpMIZEdAKtvk_tZ0WqsAhpb-winpiNFBj19STePXr7mo5VJiKFUj_1oUQTQeAC2-GP8BzMpOe2JuoGOG_KiXwul9-j7rv07bucxcADPeypUEhuwmAt4zMs4DtoUdI64M5eyBK08G21c-2wtZD9N2CfzPdWrsyHVkFSi6HfL4YZyvhQY67Dww",
  },
  {
    id: "f3",
    name: "Premium Leather Minimalist Sneakers - All White",
    price: 85.0,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAx9OMmKiR2vh58mD2gJx1lXPjAUjjVMj__eWCsbE-gJJY0zTqL5kj00pu8BOuwDxuCWCnbNeDkoXnrCaGtFdAtoYD4EByVQJBaSwI3xcBfREqg2veru_w_1S9dhEFZ9OAliGPHKPleQUtu4i7CLU_yeEbLGi0-_2Nv6Zi6H47fUDH22e4INnDLfBtmCqcVrWzUIz7oMD4loEU0oLUElIhuguFwu0vpQojPqLgPalD-kNxMdG3HPNeqMw",
  },
  {
    id: "f4",
    name: "Handmade Ceramic Coffee Mugs (Set of 4)",
    price: 34.5,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCOkxmt1DVJAyrPjtoD2w1oN3RtgzInTlhe_butszVRKPPri2MtPJvw0qvDqaideRjD7-UGamO_oOiOX3BK3KjcpIRct50xp1JcrJjwEVX9twLUtsXzp8i8LMcLEFXkOvfc8VYFDAuizIAcZejZcZeFmYY6G4FCbNM-5_OV_PrF0LtqHCv-a5ci24GLAm3CGILfBNj5KgtnBsO20znHatwew_DDeHgDkyHmLuwf3kghDHCug-lQZ_-PDg",
  },
];

export default Home;