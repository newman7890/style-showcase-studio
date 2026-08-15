import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Search, Truck, ShieldCheck, RotateCcw, Headphones, 
  Award, Heart, Package, Clock, SlidersHorizontal, X, LayoutGrid, 
  Rows3, Sparkles 
} from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  sale_price?: number | null;
  sale_ends_at?: string | null;
  created_at?: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}

const DEPARTMENTS: Record<string, { title: string; tagline: string }> = {
  fashion: { title: "Fashion", tagline: "Apparel, accessories and seasonal essentials." },
  gadgets: { title: "Gadgets", tagline: "Phones, audio, wearables and tech accessories." },
  home: { title: "Home & Living", tagline: "Decor, kitchen, and lifestyle essentials." },
  art: { title: "Art & Collectibles", tagline: "Original paintings, sculptures, digital prints and handcrafts." },
  other: { title: "Other", tagline: "Everything else worth picking up." },
};

// ---------- Hero variants ----------

const FashionHero = ({ heroImg }: { heroImg?: string }) => (
  <section className="bg-[hsl(var(--secondary))] border-b border-border">
    <div className="container mx-auto px-4 max-w-7xl py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
      <div>
        <p className="text-xs tracking-[0.25em] uppercase text-primary font-semibold mb-4">New Season Collection</p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.02] tracking-tight mb-5">
          Elevate Your<br />Style This Season
        </h1>
        <p className="text-muted-foreground max-w-md mb-7">
          Discover the latest trends in clothing, footwear and accessories for every occasion.
        </p>
        <div className="flex gap-3 mb-8">
          <Button asChild size="lg" className="rounded-full px-7"><Link to="/department/fashion">Shop Now <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-7"><Link to="/department/home">Explore Store</Link></Button>
        </div>
        <div className="flex flex-wrap gap-6 pt-2">
          <div className="flex items-center gap-2"><Heart className="w-5 h-5 text-primary" /><div><p className="font-bold text-sm">50,000+</p><p className="text-xs text-muted-foreground">Happy Customers</p></div></div>
          <div className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" /><div><p className="font-bold text-sm">1000+</p><p className="text-xs text-muted-foreground">Premium Products</p></div></div>
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /><div><p className="font-bold text-sm">30 Days</p><p className="text-xs text-muted-foreground">Easy Returns</p></div></div>
        </div>
      </div>
      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-muted">
        {heroImg ? (
          <img src={heroImg} alt="Fashion collection" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-200 to-amber-200" />
        )}
        <div className="absolute top-6 right-6 w-24 h-24 md:w-28 md:h-28 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center font-bold text-center shadow-lg">
          <span className="text-[10px] tracking-wider">UP TO</span>
          <span className="text-2xl leading-none">60%</span>
          <span className="text-[10px] tracking-wider">OFF</span>
        </div>
      </div>
    </div>
  </section>
);

const GadgetsHero = ({ heroImg }: { heroImg?: string }) => (
  <>
    <section className="bg-gradient-to-br from-[hsl(var(--secondary))] to-background border-b border-border">
      <div className="container mx-auto px-4 max-w-7xl py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> The Best Online Tech Store</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-4">
            Upgrade Every Moment<br /><span className="text-primary">With Smarter Tech</span>
          </h1>
          <p className="text-muted-foreground max-w-md mb-6">
            Discover premium gadgets, audio, wearables and accessories — everything you need for modern living.
          </p>
          <div className="flex gap-3">
            <Button asChild size="lg" className="rounded-full px-7"><Link to="/department/gadgets">Shop Now</Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7"><Link to="/department/home">Explore Store</Link></Button>
          </div>
        </div>
        <div className="relative aspect-[16/11] rounded-3xl overflow-hidden bg-muted">
          {heroImg ? <img src={heroImg} alt="Gadgets" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-slate-300 to-slate-500" />}
        </div>
      </div>
    </section>
    <section className="container mx-auto px-4 max-w-7xl -mt-6 relative z-10">
      <div className="bg-card border border-border rounded-2xl shadow-sm px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: Truck, title: "Free Delivery", sub: "On orders over GH₵300" },
          { icon: ShieldCheck, title: "Secure Payments", sub: "100% secure checkout" },
          { icon: RotateCcw, title: "Easy Returns", sub: "30-day return policy" },
          { icon: Award, title: "Warranty", sub: "Up to 2 years" },
          { icon: Headphones, title: "24/7 Support", sub: "Dedicated support" },
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <f.icon className="w-6 h-6 text-primary shrink-0" />
            <div><p className="text-sm font-semibold leading-tight">{f.title}</p><p className="text-xs text-muted-foreground">{f.sub}</p></div>
          </div>
        ))}
      </div>
    </section>
  </>
);

const HomeLivingHero = ({ heroImg }: { heroImg?: string }) => (
  <section className="relative h-[45vh] min-h-[320px] overflow-hidden border-b border-border">
    {heroImg ? (
      <img src={heroImg} alt="Home & Living" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-200" />
    )}
    <div className="absolute inset-0 bg-black/30" />
    <div className="relative h-full container mx-auto px-4 max-w-7xl flex flex-col justify-end pb-10">
      <h1 className="font-serif text-white text-5xl md:text-8xl leading-none tracking-tight font-bold drop-shadow-2xl mb-2">
        Shop
      </h1>
      <p className="text-white/90 text-sm md:text-lg max-w-md font-medium drop-shadow">
        Explore everything for your lifestyle & home.
      </p>
    </div>
  </section>
);

// ---------- Main Department / Shop Page ----------

const Department = () => {
  const { slug = "home" } = useParams<{ slug: string }>();
  const meta = DEPARTMENTS[slug] || { title: slug, tagline: "" };
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Shop filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [showInStock, setShowInStock] = useState(false);
  const [showOnSale, setShowOnSale] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3>(3);

  const newArrivalsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const catParam = searchParams.get("category");
    if (catParam) setActiveCategory(catParam);
    const searchParam = searchParams.get("search");
    if (searchParam) setSearchQuery(searchParam);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const prodQuery = slug === "home" 
        ? supabase.from("products").select("*").order("created_at", { ascending: false })
        : supabase.from("products").select("*").eq("department", slug).order("created_at", { ascending: false });

      const catQuery = slug === "home"
        ? supabase.from("categories").select("id, name, slug, image").eq("is_active", true).order("display_order", { ascending: true })
        : supabase.from("categories").select("id, name, slug, image").eq("department", slug).eq("is_active", true).order("display_order", { ascending: true });

      const [prodRes, catRes] = await Promise.all([prodQuery, catQuery]);
      if (!prodRes.error && prodRes.data) {
        const prodData = prodRes.data as Product[];
        setProducts(prodData);
        if (prodData.length > 0) {
          const max = Math.max(...prodData.map((p) => p.price), 100);
          setMaxPrice(Math.ceil(max));
          setPriceRange([0, Math.ceil(max)]);
        }
      }
      if (!catRes.error) setCategories((catRes.data as Category[]) || []);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    document.title = `${meta.title} — Cynt`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", `Shop ${meta.title}: ${meta.tagline}`);
  }, [slug, meta.title, meta.tagline]);

  const heroImg = useMemo(() => products.find((p) => p.image)?.image, [products]);
  const featured = products.slice(0, 3);

  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime())
      .slice(0, 8);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === "all" || p.category === activeCategory;
      if (!matchesCategory) return false;

      const matchesSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      const matchesPrice = p.price >= priceRange[0] && p.price <= priceRange[1];
      if (!matchesPrice) return false;

      const matchesStock = !showInStock || p.stock > 0;
      if (!matchesStock) return false;

      const matchesSale =
        !showOnSale ||
        (p.sale_price != null && p.sale_ends_at && new Date(p.sale_ends_at) > new Date());
      if (!matchesSale) return false;

      return true;
    });
  }, [products, activeCategory, searchQuery, priceRange, showInStock, showOnSale]);

  const activeFilters =
    (showInStock ? 1 : 0) +
    (showOnSale ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0);

  const renderHero = () => {
    if (slug === "fashion") return <FashionHero heroImg={heroImg} />;
    if (slug === "gadgets") return <GadgetsHero heroImg={heroImg} />;
    if (slug === "home") return <HomeLivingHero heroImg={heroImg} />;
    return (
      <section className="bg-secondary border-b border-border">
        <div className="container mx-auto px-4 max-w-7xl py-14">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-3">{meta.title}</h1>
          <p className="text-muted-foreground max-w-xl">{meta.tagline}</p>
        </div>
      </section>
    );
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20 bg-background">
        {renderHero()}

        {/* Circular categories (fashion & gadgets style) */}
        {categories.length > 0 && slug !== "home" && (
          <section className="container mx-auto px-4 max-w-7xl py-10">
            <div className="flex gap-5 md:gap-7 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat, i) => (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <button onClick={() => setActiveCategory(cat.slug)} className="group flex flex-col items-center gap-2 min-w-[76px]">
                    <div className={`w-[72px] h-[72px] md:w-20 md:h-20 rounded-full overflow-hidden ring-1 transition ${activeCategory === cat.slug ? "ring-2 ring-primary" : "ring-border group-hover:ring-primary"}`}>
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center text-lg font-bold text-muted-foreground">{cat.name[0]}</div>
                      )}
                    </div>
                    <span className="text-xs text-center text-foreground/80 group-hover:text-primary">{cat.name}</span>
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Featured collection banners (fashion, art, gadgets) */}
        {slug !== "home" && (
          <section className="container mx-auto px-4 max-w-7xl pb-6">
            <div className="grid md:grid-cols-3 gap-4">
              {(slug === "fashion" ? [
                { 
                  title: "Men's Collection", 
                  sub: "Casual. Stylish. Timeless.", 
                  categorySlug: "mens-clothing",
                  keywords: ["men", "mens", "shirt", "suit", "jacket", "pant", "male"],
                  cls: "bg-foreground text-background" 
                },
                { 
                  title: "Women's Collection", 
                  sub: "Chic looks for every moment.", 
                  categorySlug: "womens-clothing",
                  keywords: ["women", "womens", "dress", "skirt", "top", "female", "lady"],
                  cls: "bg-[hsl(var(--secondary))]" 
                },
                { 
                  title: "Sneaker Fest", 
                  sub: "Step up your style game.", 
                  categorySlug: "shoes-sneakers",
                  keywords: ["shoe", "sneaker", "boot", "footwear", "runner"],
                  cls: "bg-[hsl(var(--muted))]" 
                },
              ] : slug === "art" ? [
                { 
                  title: "Original Paintings", 
                  sub: "Hand-painted canvas & acrylics.", 
                  categorySlug: "paintings",
                  keywords: ["paint", "painting", "canvas", "acrylic"],
                  cls: "bg-foreground text-background" 
                },
                { 
                  title: "Digital Creations", 
                  sub: "NFTs, digital prints & 3D art.", 
                  categorySlug: "digital-art",
                  keywords: ["digital", "print", "nft", "3d"],
                  cls: "bg-[hsl(var(--secondary))]" 
                },
                { 
                  title: "Sculptures & Crafts", 
                  sub: "Handmade heritage creations.", 
                  categorySlug: "sculptures",
                  keywords: ["sculpture", "craft", "handcraft", "statue"],
                  cls: "bg-[hsl(var(--muted))]" 
                },
              ] : [
                { 
                  title: "Audio Gear", 
                  sub: "Premium sound, every day.", 
                  categorySlug: "audio-headphones",
                  keywords: ["audio", "headphone", "earbud", "speaker"],
                  cls: "bg-foreground text-background" 
                },
                { 
                  title: "Smart Home", 
                  sub: "Automate your everyday.", 
                  categorySlug: "smart-home",
                  keywords: ["smart", "home", "automation"],
                  cls: "bg-[hsl(var(--secondary))]" 
                },
                { 
                  title: "Wearables", 
                  sub: "Track. Move. Achieve.", 
                  categorySlug: "wearables",
                  keywords: ["wearable", "watch", "tracker", "band"],
                  cls: "bg-[hsl(var(--muted))]" 
                },
              ]).map((b, i) => {
                const matchedProduct = products.find(p => 
                  b.keywords.some(kw => 
                    p.category.toLowerCase().includes(kw) || 
                    p.name.toLowerCase().includes(kw)
                  )
                );

                return (
                  <button 
                    key={i} 
                    onClick={() => setActiveCategory(b.categorySlug)}
                    className={`${b.cls} rounded-2xl p-6 min-h-[180px] flex flex-col justify-between hover:opacity-95 transition relative overflow-hidden group text-left cursor-pointer`}
                  >
                    <div className="max-w-[60%] md:max-w-[65%]">
                      <h3 className="text-xl font-bold uppercase leading-tight">{b.title}</h3>
                      <p className="text-sm opacity-80 mt-1">{b.sub}</p>
                    </div>
                    <span className="text-sm font-medium inline-flex items-center gap-1 mt-4">
                      Shop Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    {matchedProduct?.image && (
                      <div className="absolute right-3 bottom-3 w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-background/80 backdrop-blur-sm">
                        <img 
                          src={matchedProduct.image} 
                          alt={matchedProduct.name || ""} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Main Content Area: Sidebar + Toolbar + Product Grid */}
        <section className="container mx-auto px-4 max-w-7xl py-8">
          
          {/* Shop Search & Filter Toolbar */}
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search all products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl border-border/60 bg-secondary/30 focus:bg-background transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Filters Drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative shrink-0 h-11 w-11 rounded-xl border-border/60"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {activeFilters > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-foreground text-background text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeFilters}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="text-lg">Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-8 mt-8">
                  <div>
                    <h4 className="text-sm font-medium mb-4 text-foreground">Price Range</h4>
                    <Slider
                      min={0}
                      max={maxPrice}
                      step={1}
                      value={priceRange}
                      onValueChange={(val) => setPriceRange(val as [number, number])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-3 font-medium">
                      <span>GH₵{priceRange[0]}</span>
                      <span>GH₵{priceRange[1]}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Availability</h4>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={showInStock}
                        onChange={(e) => setShowInStock(e.target.checked)}
                        className="w-4 h-4 rounded border-border accent-foreground"
                      />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        In Stock Only
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={showOnSale}
                        onChange={(e) => setShowOnSale(e.target.checked)}
                        className="w-4 h-4 rounded border-border accent-foreground"
                      />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        On Sale
                      </span>
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-11"
                    onClick={() => {
                      setPriceRange([0, maxPrice]);
                      setShowInStock(false);
                      setShowOnSale(false);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" /> Clear All Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Grid Layout Toggle */}
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => setGridCols(2)}
                className={`p-2.5 rounded-xl border border-border/60 transition-colors ${
                  gridCols === 2 ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="2 Columns"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridCols(3)}
                className={`p-2.5 rounded-xl border border-border/60 transition-colors ${
                  gridCols === 3 ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="3 Columns"
              >
                <Rows3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-[220px_1fr] gap-8">
            
            {/* Category Sidebar */}
            <aside className="hidden md:block">
              <div className="bg-card border border-border rounded-2xl p-4 sticky top-24">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">
                  Categories
                </p>
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`w-full flex items-center gap-2 py-2 text-sm font-medium transition-colors text-left ${
                    activeCategory === "all" ? "text-primary font-bold" : "text-foreground/80 hover:text-primary"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${activeCategory === "all" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  All Products
                </button>

                <div className="h-px bg-border my-2" />

                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.slug)}
                    className={`w-full flex items-center gap-2 py-2 text-sm transition-colors text-left ${
                      activeCategory === c.slug ? "text-primary font-bold" : "text-foreground/80 hover:text-primary"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${activeCategory === c.slug ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </aside>

            {/* Main Products Grid Column */}
            <div>
              {/* Active Category Title & Count */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                    {activeCategory === "all" 
                      ? (slug === "home" ? "Give All You Need" : `All ${meta.title}`) 
                      : (categories.find(c => c.slug === activeCategory)?.name || activeCategory)}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} available
                  </p>
                </div>

                {/* Mobile Category Select */}
                <div className="md:hidden">
                  <select
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                    className="text-xs bg-secondary border border-border rounded-xl px-3 py-2 text-foreground font-medium outline-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* New Arrivals Section — only when browsing all products without search */}
              {activeCategory === "all" && searchQuery === "" && newArrivals.length > 0 && (
                <div ref={newArrivalsRef} className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-base font-bold tracking-tight">New Arrivals</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {newArrivals.slice(0, 4).map((product, index) => (
                      <motion.div
                        key={`new-${product.id}`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 0.3) }}
                      >
                        <ProductCard
                          {...product}
                          sale_price={product.sale_price}
                          sale_ends_at={product.sale_ends_at}
                        />
                      </motion.div>
                    ))}
                  </div>
                  <div className="border-t border-border/40 mt-8 mb-6" />
                </div>
              )}

              {/* Products Grid */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory + searchQuery}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`grid gap-4 md:gap-6 ${
                    gridCols === 3
                      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                      : "grid-cols-2 md:grid-cols-3"
                  }`}
                >
                  {loading ? (
                    <div className="col-span-full flex justify-center py-20">
                      <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map((product, index) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.04, 0.4) }}
                      >
                        <ProductCard
                          {...product}
                          sale_price={product.sale_price}
                          sale_ends_at={product.sale_ends_at}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4">
                        <Search className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-base font-medium mb-1">No products found</h3>
                      <p className="text-sm text-muted-foreground">Try adjusting your filters or search query</p>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Home Newsletter CTA */}
          {slug === "home" && (
            <div className="mt-16 bg-foreground text-background rounded-3xl p-8 md:p-12 grid md:grid-cols-2 gap-6 items-center">
              <div>
                <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-2">Ready to Get<br />Our New Stuff?</h3>
              </div>
              <div>
                <p className="text-sm opacity-80 mb-4">We'll listen to your needs and craft a shopping experience that's right for you.</p>
                <div className="flex gap-2 bg-background rounded-full p-1">
                  <input placeholder="Your Email" className="flex-1 bg-transparent px-4 text-sm text-foreground outline-none" />
                  <Button className="rounded-full">Send</Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </>
  );
};

export default Department;
