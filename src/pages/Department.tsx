import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Search, Truck, ShieldCheck, RotateCcw, Headphones, Award, Heart, Package, Clock } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
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
          <Button asChild size="lg" className="rounded-full px-7"><Link to="/products?department=fashion">Shop Now <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-7"><Link to="/products">Explore Collections</Link></Button>
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
            <Button asChild size="lg" className="rounded-full px-7"><Link to="/products?department=gadgets">Shop Now</Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7"><Link to="/products">Explore Collections</Link></Button>
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
  <section className="relative h-[55vh] min-h-[380px] overflow-hidden border-b border-border">
    {heroImg ? (
      <img src={heroImg} alt="Home & Living" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-200" />
    )}
    <div className="absolute inset-0 bg-black/25" />
    <div className="relative h-full container mx-auto px-4 max-w-7xl flex items-end pb-10">
      <h1 className="font-serif text-white text-[22vw] md:text-[16rem] leading-[0.85] tracking-tight font-bold drop-shadow-2xl">
        Shop
      </h1>
    </div>
    <div className="absolute bottom-6 right-6 hidden md:flex items-center gap-2 bg-card border border-border rounded-full px-5 py-3 shadow-lg">
      <Search className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Give All You Need for Home</span>
    </div>
  </section>
);

// ---------- Page ----------

const Department = () => {
  const { slug = "fashion" } = useParams<{ slug: string }>();
  const meta = DEPARTMENTS[slug] || { title: slug, tagline: "" };
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [prodRes, catRes] = await Promise.all([
        supabase.from("products").select("*").eq("department", slug).order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name, slug, image").eq("department", slug).eq("is_active", true).order("display_order", { ascending: true }),
      ]);
      if (!prodRes.error) setProducts((prodRes.data as Product[]) || []);
      if (!catRes.error) setCategories((catRes.data as Category[]) || []);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    document.title = `${meta.title} — Joyce's Fashion Enterprise`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", `Shop ${meta.title}: ${meta.tagline}`);
  }, [slug, meta.title, meta.tagline]);

  const heroImg = useMemo(() => products.find((p) => p.image)?.image, [products]);
  const featured = products.slice(0, 3);
  const rest = products;

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
      <main className="min-h-screen pt-16 pb-20">
        {renderHero()}

        {/* Circular categories (fashion & gadgets style) */}
        {categories.length > 0 && slug !== "home" && (
          <section className="container mx-auto px-4 max-w-7xl py-10">
            <div className="flex gap-5 md:gap-7 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat, i) => (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link to={`/products?category=${cat.slug}`} className="group flex flex-col items-center gap-2 min-w-[76px]">
                    <div className="w-[72px] h-[72px] md:w-20 md:h-20 rounded-full overflow-hidden ring-1 ring-border group-hover:ring-primary transition">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center text-lg font-bold text-muted-foreground">{cat.name[0]}</div>
                      )}
                    </div>
                    <span className="text-xs text-center text-foreground/80 group-hover:text-primary">{cat.name}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Featured collection banners (fashion & gadgets) */}
        {slug !== "home" && featured.length >= 1 && (
          <section className="container mx-auto px-4 max-w-7xl pb-6">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: slug === "fashion" ? "Men's Collection" : "Audio Gear", sub: slug === "fashion" ? "Casual. Stylish. Timeless." : "Premium sound, every day.", cls: "bg-foreground text-background" },
                { title: slug === "fashion" ? "Women's Collection" : "Smart Home", sub: slug === "fashion" ? "Chic looks for every moment." : "Automate your everyday.", cls: "bg-[hsl(var(--secondary))]" },
                { title: slug === "fashion" ? "Sneaker Fest" : "Wearables", sub: slug === "fashion" ? "Step up your style game." : "Track. Move. Achieve.", cls: "bg-[hsl(var(--muted))]" },
              ].map((b, i) => (
                <Link key={i} to="/products" className={`${b.cls} rounded-2xl p-6 min-h-[180px] flex flex-col justify-between hover:opacity-95 transition relative overflow-hidden`}>
                  <div>
                    <h3 className="text-xl font-bold uppercase leading-tight">{b.title}</h3>
                    <p className="text-sm opacity-80 mt-1">{b.sub}</p>
                  </div>
                  <span className="text-sm font-medium inline-flex items-center gap-1">Shop Now <ArrowRight className="w-4 h-4" /></span>
                  {featured[i]?.image && <img src={featured[i].image} alt="" className="absolute right-0 bottom-0 h-32 w-auto object-contain opacity-90" />}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Home & Living: sidebar + product grid layout */}
        {slug === "home" ? (
          <section className="container mx-auto px-4 max-w-7xl py-10">
            <div className="grid md:grid-cols-[220px_1fr] gap-8">
              <aside className="hidden md:block">
                <div className="bg-card border border-border rounded-2xl p-4 sticky top-24">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Category</p>
                  <Link to="/products?department=home" className="flex items-center justify-between py-2 text-sm font-medium text-primary">
                    All Products <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">{products.length}</span>
                  </Link>
                  <div className="h-px bg-border my-2" />
                  {categories.map((c) => (
                    <Link key={c.id} to={`/products?category=${c.slug}`} className="flex items-center gap-2 py-2 text-sm text-foreground/80 hover:text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />{c.name}
                    </Link>
                  ))}
                </div>
              </aside>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Give All You Need</h2>
                    <p className="text-sm text-muted-foreground">{products.length} products</p>
                  </div>
                </div>
                {loading ? (
                  <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" /></div>
                ) : products.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4 mx-auto"><Search className="w-6 h-6 text-muted-foreground" /></div>
                    <h3 className="text-base font-medium mb-1">Nothing here yet</h3>
                    <p className="text-sm text-muted-foreground">Check back soon.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {products.map((p, i) => (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
                        <ProductCard {...p} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ready to get CTA */}
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
          </section>
        ) : (
          <section className="container mx-auto px-4 max-w-7xl py-6 md:py-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">All {meta.title}</h2>
              <span className="text-sm text-muted-foreground">{products.length} items</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" /></div>
            ) : rest.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4 mx-auto"><Search className="w-6 h-6 text-muted-foreground" /></div>
                <h3 className="text-base font-medium mb-1">Nothing here yet</h3>
                <p className="text-sm text-muted-foreground">Check back soon.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {rest.map((product, index) => (
                  <motion.div key={product.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.05, 0.4) }}>
                    <ProductCard {...product} />
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <BottomNav />
    </>
  );
};

export default Department;
