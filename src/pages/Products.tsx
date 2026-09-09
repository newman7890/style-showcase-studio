import { SEO } from "@/components/SEO";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, X, LayoutGrid, Rows3, Sparkles, ChevronRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

const Products = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
  const [shopBanners, setShopBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [showInStock, setShowInStock] = useState(false);
  const [showOnSale, setShowOnSale] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3>(2);
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const newArrivalsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Set active category from URL on load
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam) setActiveCategory(categoryParam);
  }, [searchParams]);

  const fetchProducts = async () => {
    try {
      const [prodRes, catRes, bannerRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("name, slug").eq("is_active", true).order("display_order", { ascending: true }),
        (supabase as any).from("marketing_banners").select("*").eq("is_active", true).eq("placement", "shop_banner").order("display_order", { ascending: true }),
      ]);

      if (bannerRes?.data) setShopBanners(bannerRes.data);

      let loadedCats = catRes.data || [];

      // Also merge from localStorage cache if available
      try {
        const localCached = localStorage.getItem("local_custom_categories");
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (Array.isArray(parsed)) {
            const seenSlugs = new Set(loadedCats.map((c) => c.slug));
            parsed.forEach((item: any) => {
              if (item.slug && item.name && !seenSlugs.has(item.slug)) {
                seenSlugs.add(item.slug);
                loadedCats.push({ name: item.name, slug: item.slug });
              }
            });
          }
        }
      } catch {}

      if (!prodRes.error && prodRes.data) {
        setProducts(prodRes.data);
        const max = Math.max(...prodRes.data.map((p: any) => p.price), 100);
        setMaxPrice(Math.ceil(max));
        setPriceRange([0, Math.ceil(max)]);

        // Extract distinct categories present on live products so they appear in category filter pills
        const existingNames = new Set(loadedCats.map((c) => c.name.toLowerCase().trim()));
        const existingSlugs = new Set(loadedCats.map((c) => c.slug.toLowerCase().trim()));
        prodRes.data.forEach((p: any) => {
          if (p.category && !existingNames.has(p.category.toLowerCase().trim())) {
            const autoSlug = p.category.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
            if (!existingSlugs.has(autoSlug)) {
              existingNames.add(p.category.toLowerCase().trim());
              existingSlugs.add(autoSlug);
              loadedCats.push({ name: p.category, slug: autoSlug });
            }
          }
        });
      }
      
      setCategories(loadedCats);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to new arrivals section when navigated with ?section=new-arrivals
  useEffect(() => {
    if (!loading && searchParams.get("section") === "new-arrivals" && newArrivalsRef.current) {
      setTimeout(() => {
        newArrivalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [loading, searchParams]);

  const newArrivals = [...products]
    .sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime())
    .slice(0, 8);

  const filteredProducts = products.filter((p) => {
    // "new" is a virtual category — show only the newest products
    if (activeCategory === "new") {
      const isNewArrival = newArrivals.some(n => n.id === p.id);
      if (!isNewArrival) return false;
    } else if (activeCategory !== "all") {
      const pCatLower = (p.category || "").toLowerCase().trim();
      const activeCatLower = activeCategory.toLowerCase().trim();
      const pCatSlug = pCatLower.replace(/[^a-z0-9]+/g, "-");
      const matchesCategory =
        pCatLower === activeCatLower ||
        pCatSlug === activeCatLower ||
        (categories.find(c => c.slug === activeCatLower)?.name.toLowerCase() === pCatLower);
      if (!matchesCategory) return false;
    }
    const matchesSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = p.price >= priceRange[0] && p.price <= priceRange[1];
    const matchesStock = !showInStock || p.stock > 0;
    const matchesSale =
      !showOnSale ||
      (p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price));
    return matchesSearch && matchesPrice && matchesStock && matchesSale;
  });

  const activeFilters =
    (showInStock ? 1 : 0) +
    (showOnSale ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0);

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-16 pb-20 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">{t("loading")}</span>
          </motion.div>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <SEO
        title="Explore All Products"
        description="Browse the complete catalog of fashion, electronics, gadgets, home goods, and art on Trades Point. Enjoy deals, low prices, and fast delivery."
        keywords={[
          "Trades Point Products",
          "Buy Clothes Online Ghana",
          "Buy Gadgets Ghana",
          "Ghana Online Marketplace",
          "Deals and Discounts Ghana"
        ]}
      />
      <Header />
      <main className="min-h-screen pt-16 pb-20 bg-background">
        <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-1">
              {t("newProducts")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} available
            </p>
          </motion.div>

          {/* Shop Top Featured Banner */}
          {shopBanners.length > 0 && searchQuery === "" && activeCategory === "all" && (
            <div className="mb-8 flex flex-col gap-4">
              {shopBanners.map((banner) => (
                <div
                  key={banner.id}
                  onClick={async () => {
                    try {
                      (supabase as any).rpc("increment_banner_click", { banner_id: banner.id }).catch(() => {});
                    } catch {}

                    const link = (banner.link_url || "").trim();
                    const title = (banner.title || "").trim();
                    const img = (banner.image_url || "").trim();

                    // Direct product link
                    if (/^\/products?\/[a-zA-Z0-9_-]+$/i.test(link)) {
                      window.location.href = `/product/${link.replace(/^\/products?\//i, "")}`;
                      return;
                    }

                    // Raw UUID in link_url
                    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(link)) {
                      window.location.href = `/product/${link}`;
                      return;
                    }

                    // 1. Match by Image
                    if (img) {
                      const filename = img.split("/").pop()?.split("?")[0];
                      const matchedProd = products.find((p) => {
                        if (p.image === img) return true;
                        if (filename && filename.length > 5 && p.image?.includes(filename)) return true;
                        return false;
                      });
                      if (matchedProd) {
                        window.location.href = `/product/${matchedProd.id}`;
                        return;
                      }
                    }

                    // 2. Match by Title
                    if (title) {
                      const matchedProd = products.find((p) =>
                        p.name.toLowerCase().includes(title.toLowerCase()) ||
                        title.toLowerCase().includes(p.name.toLowerCase()) ||
                        p.category?.toLowerCase() === title.toLowerCase()
                      );
                      if (matchedProd) {
                        window.location.href = `/product/${matchedProd.id}`;
                        return;
                      }

                      try {
                        const { data: dbMatches } = await supabase
                          .from("products")
                          .select("id")
                          .or(`name.ilike.%${title}%,category.ilike.%${title}%`)
                          .limit(1);
                        if (dbMatches && dbMatches.length > 0) {
                          window.location.href = `/product/${dbMatches[0].id}`;
                          return;
                        }
                      } catch {}
                    }

                    // 3. Fallback to first available product
                    if (products.length > 0) {
                      window.location.href = `/product/${products[0].id}`;
                      return;
                    }

                    if (link.startsWith("/")) {
                      window.location.href = link;
                    }
                  }}
                  className="relative w-full h-44 sm:h-56 rounded-2xl overflow-hidden cursor-pointer shadow-md group border border-border"
                >
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent flex flex-col justify-center p-6 md:p-8">
                    {banner.badge && (
                      <span className="bg-primary text-primary-foreground text-[11px] font-bold px-2.5 py-0.5 rounded w-max mb-2 uppercase tracking-wide">
                        {banner.badge}
                      </span>
                    )}
                    <h3 className="text-xl md:text-3xl font-black text-white font-plus-jakarta max-w-lg">
                      {banner.title}
                    </h3>
                    {banner.label && (
                      <p className="text-xs md:text-sm text-white/90 mt-1 max-w-md">
                        {banner.label}
                      </p>
                    )}
                    <div className="mt-3">
                      <span className="px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors inline-flex items-center gap-1.5">
                        Shop Now <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Arrivals Section — only when browsing all products with no search */}
          {activeCategory === "all" && searchQuery === "" && (
            <>
              <motion.div
                ref={newArrivalsRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mb-12 scroll-mt-20"
              >
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg md:text-xl font-bold tracking-tight">New Arrivals</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {newArrivals.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.06, 0.4) }}
                    >
                      <ProductCard
                        {...product}
                        sale_price={product.sale_price}
                        sale_ends_at={product.sale_ends_at}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <div className="border-t border-border/40 mb-8" />
            </>
          )}

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex gap-2 mb-6"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("search")}
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
          </motion.div>

          {/* Categories + Grid Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between mb-8"
          >
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {[{ name: t("all"), slug: "all" }, ...categories].map((category) => (
                <button
                  key={category.slug}
                  onClick={() => setActiveCategory(category.slug)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                    activeCategory === category.slug
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-1 ml-4">
              <button
                onClick={() => setGridCols(2)}
                className={`p-2 rounded-lg transition-colors ${
                  gridCols === 2 ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridCols(3)}
                className={`p-2 rounded-lg transition-colors ${
                  gridCols === 3 ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Rows3 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Product Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory + searchQuery}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className={`grid gap-4 md:gap-6 ${
                gridCols === 3
                  ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.06, 0.5) }}
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
                  <h3 className="text-base font-medium mb-1">{t("noProductsFound")}</h3>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters or search</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default Products;
