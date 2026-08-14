import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Palette, Search, Sparkles, ShoppingBag, Heart, ShieldCheck, ArrowRight, Brush, Frame, Image as ImageIcon, SlidersHorizontal, Check } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  department: string | null;
  description: string | null;
  stock: number;
  seller_id?: string;
  created_at?: string;
}

const ART_CATEGORIES = [
  { id: "all", label: "All Artworks", icon: Palette },
  { id: "paintings", label: "Paintings", icon: Brush },
  { id: "digital", label: "Digital Art", icon: Sparkles },
  { id: "sculptures", label: "Sculptures", icon: Frame },
  { id: "photography", label: "Photography", icon: ImageIcon },
  { id: "crafts", label: "Handcrafts", icon: Palette },
];

const FEATURED_FALLBACK_ARTWORKS: Product[] = [
  {
    id: "art-demo-1",
    name: "Golden Horizons - Original Canvas",
    price: 1850.00,
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80",
    category: "Paintings",
    department: "art",
    description: "Oil on canvas, 120x90cm. Abstract warm tones capturing sunset reflections.",
    stock: 1
  },
  {
    id: "art-demo-2",
    name: "Ethereal Neon Dreams #04",
    price: 650.00,
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    category: "Digital Art",
    department: "art",
    description: "Limited Edition 4K Digital Print on metallic paper. Signed by artist.",
    stock: 5
  },
  {
    id: "art-demo-3",
    name: "Bronze Ancestral Form",
    price: 3200.00,
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80",
    category: "Sculptures",
    department: "art",
    description: "Hand-carved bronze figure celebrating West African heritage.",
    stock: 1
  },
  {
    id: "art-demo-4",
    name: "Mist over Akwapim Ridge",
    price: 950.00,
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    category: "Photography",
    department: "art",
    description: "Archival fine art photograph printed on Hahnemühle paper.",
    stock: 3
  },
  {
    id: "art-demo-5",
    name: "Terracotta Vessel & Beads",
    price: 450.00,
    image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80",
    category: "Handcrafts",
    department: "art",
    description: "Traditional hand-baked clay pottery with glass beadwork accents.",
    stock: 4
  },
  {
    id: "art-demo-6",
    name: "Vibrant Rhythms of Accra",
    price: 2100.00,
    image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80",
    category: "Paintings",
    department: "art",
    description: "Mixed media on stretched linen. High texture acrylics and gold leaf.",
    stock: 1
  }
];

export default function ArtGallery() {
  const [artworks, setArtworks] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("featured");
  const [loading, setLoading] = useState<boolean>(true);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { toast } = useToast();

  useEffect(() => {
    fetchArtworks();
  }, []);

  const fetchArtworks = async () => {
    setLoading(true);
    try {
      // Query products where department is 'art' or category contains art terms
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .or("department.eq.art,category.ilike.%art%,category.ilike.%painting%,category.ilike.%sculpture%")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setArtworks(data as Product[]);
      } else {
        // Use high quality fallback artworks if no art products in DB yet
        setArtworks(FEATURED_FALLBACK_ARTWORKS);
      }
    } catch (err) {
      console.error("Error loading artworks:", err);
      setArtworks(FEATURED_FALLBACK_ARTWORKS);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (art: Product) => {
    addToCart({
      id: art.id,
      name: art.name,
      price: art.price,
      image: art.image,
      quantity: 1,
    });
    setAddedIds((prev) => ({ ...prev, [art.id]: true }));
    setTimeout(() => setAddedIds((prev) => ({ ...prev, [art.id]: false })), 2000);
    toast({
      title: "Artwork Added!",
      description: `"${art.name}" has been added to your shopping cart.`,
    });
  };

  // Filtering & Sorting
  const filteredArtworks = artworks
    .filter((art) => {
      const matchesCategory =
        selectedCategory === "all" ||
        art.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesSearch =
        art.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (art.description && art.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "low") return a.price - b.price;
      if (sortBy === "high") return b.price - a.price;
      return 0;
    });

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-950 text-slate-100 pt-20 pb-28">
        {/* Gallery Hero Banner */}
        <section className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 py-12 md:py-20">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto text-center space-y-4"
            >

              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-slate-100 to-purple-200">
                The Art Showcase & Gallery
              </h1>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                Discover original paintings, digital creations, handcrafted sculptures, and fine art prints directly from authentic creators and visual artists.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Category Pills & Search Controls */}
        <section className="sticky top-16 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 py-4">
          <div className="container mx-auto px-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none pb-1 md:pb-0">
              {ART_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <Button
                    key={cat.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`rounded-full px-4 text-xs font-medium shrink-0 transition-all gap-1.5 ${
                      isActive
                        ? "bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold"
                        : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>

            {/* Search & Sort */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search artwork or medium..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-900/80 border-slate-800 text-slate-200 text-xs rounded-full focus:border-amber-500/50"
                />
              </div>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36 bg-slate-900/80 border-slate-800 text-slate-200 text-xs rounded-full">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="low">Price: Low to High</SelectItem>
                  <SelectItem value="high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Gallery Grid */}
        <section className="container mx-auto px-4 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
              <Sparkles className="w-6 h-6 animate-spin text-amber-400" />
              <span>Loading art gallery...</span>
            </div>
          ) : filteredArtworks.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8 max-w-md mx-auto">
              <Palette className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-200">No artworks found</h3>
              <p className="text-xs text-slate-400 mt-1">Try selecting another category or clear your search query.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchQuery("");
                }}
                className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredArtworks.map((art) => {
                  const isFav = isFavorite(art.id);
                  const isJustAdded = addedIds[art.id];
                  return (
                    <motion.div
                      key={art.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="bg-slate-900/70 border-slate-800/80 overflow-hidden group hover:border-slate-700 transition-all duration-300 flex flex-col h-full shadow-lg hover:shadow-purple-950/20">
                        {/* Artwork Frame Image */}
                        <div className="relative aspect-[4/3] overflow-hidden bg-slate-950">
                          <img
                            src={art.image}
                            alt={art.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          
                          {/* Medium Badge */}
                          <Badge className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-amber-300 border-amber-500/30 text-[10px] uppercase font-semibold">
                            {art.category}
                          </Badge>

                          {/* Favorite Button */}
                          <button
                            onClick={() => toggleFavorite(art as any)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/70 backdrop-blur-md border border-slate-800 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <Heart className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
                          </button>
                        </div>

                        {/* Details Content */}
                        <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium mb-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Authentic Work
                            </div>
                            <Link to={`/product/${art.id}`} className="hover:text-amber-300 transition-colors">
                              <h3 className="font-semibold text-slate-100 text-base leading-snug line-clamp-1">
                                {art.name}
                              </h3>
                            </Link>
                            {art.description && (
                              <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                                {art.description}
                              </p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Original Price</div>
                              <div className="text-lg font-bold text-slate-100">
                                GH₵{Number(art.price).toFixed(2)}
                              </div>
                            </div>

                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(art)}
                              className={`rounded-full px-4 text-xs font-semibold gap-1.5 transition-all ${
                                isJustAdded
                                  ? "bg-emerald-500 text-slate-950"
                                  : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                              }`}
                            >
                              {isJustAdded ? (
                                <>
                                  <Check className="w-4 h-4" /> Added
                                </>
                              ) : (
                                <>
                                  <ShoppingBag className="w-4 h-4" /> Buy Art
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Sell Your Art CTA */}
        <section className="container mx-auto px-4 mt-12">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-900/40 via-slate-900 to-amber-900/30 border border-purple-500/20 p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs uppercase tracking-widest">
                Artist & Creator Community
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100">
                Are you an Artist or Craft Creator?
              </h2>
              <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                List your original paintings, handmade crafts, and digital artworks on our platform to reach thousands of art collectors.
              </p>
            </div>

            <Link to="/sell">
              <Button size="lg" className="rounded-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold px-8 gap-2 shadow-lg shadow-amber-500/20">
                Sell Your Artwork <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
