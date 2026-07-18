import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Heart, ShoppingBag, Star, 
  Search, Truck, RotateCcw, Lock, 
  Settings, Users, CheckCircle2, Hexagon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProductReviews } from "@/components/ProductReviews";
import { Separator } from "@/components/ui/separator";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  images?: string[];
  category: string;
  description?: string;
  sale_price?: number | null;
  sale_ends_at?: string | null;
  stock?: number;
}

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Mock UI state for new design
  const [selectedColor, setSelectedColor] = useState("Charcoal Gray");
  const [selectedSize, setSelectedSize] = useState("M");
  const [activeTab, setActiveTab] = useState("Details");

  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { t } = useLanguage();

  useEffect(() => {
    fetchProduct();
    setCurrentImageIndex(0);
    setQuantity(1);
    window.scrollTo(0, 0);
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      if (productData) {
        const { data: relatedData } = await supabase
          .from("products")
          .select("*")
          .eq("category", productData.category)
          .neq("id", id)
          .limit(4);

        setRelatedProducts(relatedData || []);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(product.id, 1);
      toast.success(t("addedToCart"));
    }
  };

  const handleToggleFavorite = () => {
    if (product) {
      toggleFavorite(product.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("noProductsFound")}</p>
      </div>
    );
  }

  // Use up to 5 images for the vertical gallery, duplicating the main image if necessary just to show the layout
  const productImages = product.images && product.images.length > 0 
    ? product.images 
    : Array(5).fill(product.image);

  const isOnSale = product.sale_price != null && product.sale_ends_at && new Date(product.sale_ends_at) > new Date();
  const displayPrice = isOnSale ? product.sale_price! : product.price;

  // Mock colors
  const colors = [
    { name: "Charcoal Gray", hex: "#4b4f54" },
    { name: "Light Gray", hex: "#d1d5db" },
    { name: "Beige", hex: "#e5e0d8" },
    { name: "Black", hex: "#000000" }
  ];

  const sizes = ["S", "M", "L", "XL", "XXL"];
  const tabs = ["Details", "Materials", "Size & Fit", "Shipping & Returns"];

  return (
    <main className="min-h-screen bg-white font-sans text-black pb-20">
      
      {/* Top Navigation - kept minimal */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link to="/products" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        
        {/* ── Top Section: Gallery & Info ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 mb-20">
          
          {/* LEFT: Vertical Gallery */}
          <div className="flex gap-4 sm:gap-6 h-[500px] sm:h-[650px]">
            {/* Thumbnails (Vertical) */}
            <div className="flex flex-col gap-3 w-16 sm:w-20 overflow-y-auto hide-scrollbar pb-2">
              {productImages.slice(0, 5).map((img, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`flex-shrink-0 aspect-[4/5] rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    index === currentImageIndex
                      ? "border-black"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover bg-gray-100"
                  />
                </button>
              ))}
            </div>

            {/* Main Image */}
            <div className="flex-1 relative rounded-3xl overflow-hidden bg-gray-50">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImageIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  src={productImages[currentImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
              <button className="absolute bottom-6 right-6 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                <Search className="w-5 h-5 text-black" />
              </button>
            </div>
          </div>

          {/* RIGHT: Product Info */}
          <div className="flex flex-col pt-2 sm:pt-6">
            
            <div className="inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-1 rounded-md mb-4 self-start">
              New Arrival
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black mb-3 leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 fill-black text-black" />
                ))}
              </div>
              <span className="text-sm font-medium text-gray-600">4.8 (128 reviews)</span>
            </div>

            {/* Price Block */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-bold text-black">
                GH₵{displayPrice.toFixed(2)}
              </span>
              {(isOnSale || true) && ( // Forcing the strikethrough for design showcase
                <>
                  <span className="text-lg text-gray-400 line-through font-medium">
                    GH₵{(product.price * 1.5).toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-white bg-black px-2 py-1 rounded">
                    33% OFF
                  </span>
                </>
              )}
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-8">
              {product.description || "Premium heavyweight cotton hoodie with an oversized fit for ultimate comfort and modern style."}
            </p>

            <Separator className="mb-8" />

            {/* Color Selector */}
            <div className="mb-8">
              <p className="text-sm font-bold text-black mb-3">
                Color: <span className="font-medium text-gray-600">{selectedColor}</span>
              </p>
              <div className="flex gap-3">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      selectedColor === c.name ? "border-gray-400" : "border-transparent"
                    }`}
                  >
                    <span 
                      className="w-8 h-8 rounded-full border border-gray-200"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selector */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-bold text-black">
                  Size: <span className="font-medium text-gray-600">{selectedSize}</span>
                </p>
                <button className="text-sm font-medium text-gray-500 hover:text-black underline flex items-center gap-1">
                  <span className="text-lg leading-none mb-1">📐</span> Size Guide
                </button>
              </div>
              <div className="flex gap-3">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`w-14 h-12 rounded-lg text-sm font-bold border transition-all ${
                      selectedSize === s 
                        ? "bg-black text-white border-black" 
                        : "bg-white text-black border-gray-200 hover:border-black"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Row */}
            <div className="flex gap-4 mb-8">
              <Button
                onClick={handleAddToCart}
                className="flex-1 h-14 bg-black hover:bg-black/90 text-white rounded-xl font-bold text-base gap-3"
              >
                <ShoppingBag className="w-5 h-5" />
                Add to Cart
              </Button>
              <button
                onClick={handleToggleFavorite}
                className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center hover:border-black transition-colors bg-white"
              >
                <Heart
                  className={`w-6 h-6 transition-colors ${
                    isFavorite(product.id)
                      ? "fill-black text-black"
                      : "text-black"
                  }`}
                />
              </button>
            </div>

            {/* Feature Icons Row */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
              <div className="flex items-center gap-3">
                <Truck className="w-6 h-6 text-black" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-black">Free Shipping</span>
                  <span className="text-[10px] text-gray-500">On orders over GH₵500</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RotateCcw className="w-6 h-6 text-black" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-black">Easy Returns</span>
                  <span className="text-[10px] text-gray-500">30-day return policy</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-black" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-black">Secure Payment</span>
                  <span className="text-[10px] text-gray-500">100% secure checkout</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Middle Section: Tabs & Detail Image ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 mb-24">
          
          {/* Tabs & Content */}
          <div>
            <div className="flex gap-6 sm:gap-8 border-b border-gray-200 mb-8 overflow-x-auto hide-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-sm font-bold whitespace-nowrap transition-colors relative ${
                    activeTab === tab ? "text-black" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="tabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="text-gray-600 text-sm leading-relaxed mb-8">
              Crafted from high-quality heavyweight cotton, this hoodie delivers unmatched comfort and durability. The oversized fit and minimal design make it a versatile staple for any wardrobe.
            </div>

            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-medium text-black">
                <ShoppingBag className="w-5 h-5 text-gray-400" /> Oversized fit
              </li>
              <li className="flex items-center gap-3 text-sm font-medium text-black">
                <Hexagon className="w-5 h-5 text-gray-400" /> Soft & heavyweight fabric
              </li>
              <li className="flex items-center gap-3 text-sm font-medium text-black">
                <Settings className="w-5 h-5 text-gray-400" /> Adjustable drawstring hood
              </li>
              <li className="flex items-center gap-3 text-sm font-medium text-black">
                <CheckCircle2 className="w-5 h-5 text-gray-400" /> Ribbed cuffs and hem
              </li>
              <li className="flex items-center gap-3 text-sm font-medium text-black">
                <Users className="w-5 h-5 text-gray-400" /> Unisex style
              </li>
            </ul>
          </div>

          {/* Large Detail Image */}
          <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-gray-100">
            {/* Using a mockup high-res fabric image since it's a structural mockup */}
            <img 
              src="https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?q=80&w=2000&auto=format&fit=crop" 
              alt="Fabric Detail" 
              className="w-full h-full object-cover grayscale opacity-90"
            />
          </div>
        </div>

        {/* ── Bottom Section: You May Also Like ── */}
        <div>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-black">You May Also Like</h2>
            <Link to="/products" className="text-sm font-bold text-black flex items-center gap-1 hover:underline">
              View All <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.length > 0 ? (
              relatedProducts.map((item) => (
                <div key={item.id} className="group cursor-pointer">
                  <div className="aspect-[3/4] bg-gray-100 rounded-2xl mb-4 overflow-hidden relative">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        toggleFavorite(item.id);
                      }}
                      className="absolute bottom-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(item.id) ? 'fill-black text-black' : 'text-black'}`} />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-black mb-1 line-clamp-1">{item.name}</h3>
                  <p className="text-sm font-bold text-gray-600">GH₵{item.price.toFixed(2)}</p>
                </div>
              ))
            ) : (
              // Mock items if no related products are found in DB just to match the visual
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="aspect-[3/4] bg-gray-100 rounded-2xl mb-4 overflow-hidden relative">
                    <img
                      src={`https://source.unsplash.com/random/400x500?fashion,hoodie&sig=${i}`}
                      alt="Mock Product"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <button className="absolute bottom-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
                      <Heart className="w-4 h-4 text-black" />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-black mb-1 line-clamp-1">Classic Sweatshirt {i}</h3>
                  <p className="text-sm font-bold text-gray-600">GH₵49.99</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </main>
  );
};

export default ProductDetail;
