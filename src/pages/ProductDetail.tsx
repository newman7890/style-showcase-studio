import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Heart, ShoppingBag, 
  Search, Truck, RotateCcw, Lock
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
      addToCart(product.id, quantity);
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

  const productImages = product.images && product.images.length > 0
    ? product.images
    : [product.image];


  const isOnSale = product.sale_price != null && product.sale_ends_at && new Date(product.sale_ends_at) > new Date();
  const displayPrice = isOnSale ? product.sale_price! : product.price;


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

            <div className="inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-1 rounded-md mb-4 self-start capitalize">
              {product.category}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black mb-3 leading-tight">
              {product.name}
            </h1>

            {/* Price Block */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-bold text-black">
                GH₵{displayPrice.toFixed(2)}
              </span>
              {isOnSale && (
                <>
                  <span className="text-lg text-gray-400 line-through font-medium">
                    GH₵{product.price.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-white bg-black px-2 py-1 rounded">
                    {Math.round(((product.price - displayPrice) / product.price) * 100)}% OFF
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <p className="text-gray-600 text-sm leading-relaxed mb-8">
                {product.description}
              </p>
            )}

            {typeof product.stock === "number" && (
              <p className="text-sm font-medium mb-6">
                {product.stock > 0 ? (
                  <span className="text-gray-600">
                    {product.stock <= 5 ? `Only ${product.stock} left in stock` : `${product.stock} in stock`}
                  </span>
                ) : (
                  <span className="text-red-600">Out of stock</span>
                )}
              </p>
            )}

            <Separator className="mb-8" />

            {/* Quantity */}
            <div className="mb-8">
              <p className="text-sm font-bold text-black mb-3">Quantity</p>
              <div className="flex items-center gap-4 w-fit border border-gray-200 rounded-xl px-3 h-12">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 text-lg font-bold text-black disabled:opacity-30"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 text-lg font-bold text-black"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Row */}
            <div className="flex gap-4 mb-8">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
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

        {/* ── Middle Section: Product description ── */}
        {product.description && (
          <div className="max-w-3xl mb-24">
            <h2 className="text-2xl font-bold text-black mb-4">Product Details</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}


        {/* ── Customer Reviews ── */}
        <div className="mb-24">
          <ProductReviews productId={product.id} />
        </div>

        {/* ── Bottom Section: You May Also Like ── */}
        {relatedProducts.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-black">You May Also Like</h2>
              <Link to="/products" className="text-sm font-bold text-black flex items-center gap-1 hover:underline">
                View All <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((item) => (
                <Link key={item.id} to={`/product/${item.id}`} className="group cursor-pointer block">
                  <div className="aspect-[3/4] bg-gray-100 rounded-2xl mb-4 overflow-hidden relative">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className="absolute bottom-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(item.id) ? 'fill-black text-black' : 'text-black'}`} />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-black mb-1 line-clamp-1">{item.name}</h3>
                  <p className="text-sm font-bold text-gray-600">GH₵{item.price.toFixed(2)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}


      </div>
    </main>
  );
};

export default ProductDetail;
