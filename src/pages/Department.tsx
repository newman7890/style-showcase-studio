import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
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

const DEPARTMENTS: Record<string, { title: string; tagline: string; accent: string }> = {
  fashion: {
    title: "Fashion",
    tagline: "Apparel, accessories and seasonal essentials.",
    accent: "from-rose-500/10 to-amber-500/10",
  },
  gadgets: {
    title: "Gadgets",
    tagline: "Phones, audio, wearables and tech accessories.",
    accent: "from-blue-500/10 to-violet-500/10",
  },
  home: {
    title: "Home & Living",
    tagline: "Decor, kitchen, and lifestyle essentials.",
    accent: "from-emerald-500/10 to-teal-500/10",
  },
  other: {
    title: "Other",
    tagline: "Everything else worth picking up.",
    accent: "from-slate-500/10 to-zinc-500/10",
  },
};

const Department = () => {
  const { slug = "fashion" } = useParams<{ slug: string }>();
  const meta = DEPARTMENTS[slug] || { title: slug, tagline: "", accent: "from-secondary to-secondary" };
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const [prodRes, catRes] = await Promise.all([
        supabase.from("products").select("*").eq("department", slug).order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name, slug, image").eq("department", slug).eq("is_active", true).order("display_order", { ascending: true }),
      ]);
      if (!prodRes.error) setProducts((prodRes.data as Product[]) || []);
      if (!catRes.error) setCategories((catRes.data as Category[]) || []);
      setLoading(false);
    };
    load();
  }, [slug]);

  // SEO
  useEffect(() => {
    document.title = `${meta.title} — Joyce's Fashion Enterprise`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", `Shop ${meta.title}: ${meta.tagline}`);
  }, [slug, meta.title, meta.tagline]);

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20">
        {/* Hero */}
        <section className={`bg-gradient-to-br ${meta.accent} border-b border-border`}>
          <div className="container mx-auto px-4 max-w-6xl py-14 md:py-20">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3"
            >
              Department
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl md:text-6xl font-bold tracking-tight mb-3"
            >
              {meta.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-muted-foreground max-w-xl"
            >
              {meta.tagline}
            </motion.p>
          </div>
        </section>

        {/* Categories */}
        {categories.length > 0 && (
          <section className="container mx-auto px-4 max-w-6xl py-10">
            <h2 className="text-lg font-semibold mb-4">Browse by category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((cat, i) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={`/products?category=${cat.slug}`} className="group block relative overflow-hidden rounded-2xl aspect-square">
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <span className="text-2xl font-bold text-muted-foreground">{cat.name[0]}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-semibold">{cat.name}</h3>
                      <p className="text-white/80 text-xs flex items-center gap-1">Shop <ArrowRight className="w-3 h-3" /></p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Products */}
        <section className="container mx-auto px-4 max-w-6xl py-6 md:py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">All {meta.title}</h2>
            <span className="text-sm text-muted-foreground">{products.length} items</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium mb-1">Nothing here yet</h3>
              <p className="text-sm text-muted-foreground">Check back soon — admins are stocking this department.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.4) }}
                >
                  <ProductCard {...product} />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </>
  );
};

export default Department;
