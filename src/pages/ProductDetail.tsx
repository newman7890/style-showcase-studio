import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, ShoppingCart, Plus, Minus, Star } from "lucide-react";
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
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
    <main className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <Link to="/products" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Shop</span>
          </Link>
          {/* Breadcrumb */}
          <nav className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <Link to="/products" className="hover:text-foreground transition-colors">Shop</Link>
            <span>/</span>
            <span className="text-foreground">{product.category}</span>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Main Product Section - Side by Side on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          
          {/* LEFT: Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <motion.div
              key={currentImageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="aspect-square bg-secondary/30 rounded-2xl overflow-hidden"
            >
              <img
                src={productImages[currentImageIndex]}
                alt={`${product.name} - Image ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Thumbnail Row */}
            {productImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {productImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      index === currentImageIndex
                        ? "border-foreground ring-1 ring-foreground/10"
                        : "border-transparent opacity-50 hover:opacity-80"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                {productImages.length > 5 && (
                  <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-secondary/50 flex items-center justify-center text-xs text-muted-foreground font-medium">
                    +{productImages.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Product Info */}
          <div className="flex flex-col">
            {/* Category & Name */}
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                {product.category}
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">42 reviews</span>
            </div>

            {/* Price */}
            <div className="mb-6">
              {isOnSale ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-foreground">
                    GH₵{displayPrice.toFixed(2)}
                  </span>
                  <span className="text-lg text-muted-foreground line-through">
                    GH₵{product.price.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                    SALE
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-foreground">
                  GH₵{product.price.toFixed(2)}
                </span>
              )}
            </div>

            <Separator className="mb-6" />

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-foreground mb-3">Quantity</h3>
              <div className="inline-flex items-center border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-11 h-11 flex items-center justify-center hover:bg-secondary/50 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 h-11 flex items-center justify-center text-sm font-medium border-x border-border">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-11 h-11 flex items-center justify-center hover:bg-secondary/50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Add to Cart + Favorite */}
            <div className="flex items-center gap-3 mb-6">
              <Button
                onClick={handleAddToCart}
                className="flex-1 h-12 rounded-full text-sm font-medium gap-2"
                size="lg"
              >
                <ShoppingCart className="w-4 h-4" />
                {t("addToCart")}
              </Button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleToggleFavorite}
                className="w-12 h-12 rounded-full border border-border flex items-center justify-center hover:bg-secondary/50 transition-colors"
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    isFavorite(product.id)
                      ? "fill-destructive text-destructive"
                      : "text-foreground"
                  }`}
                />
              </motion.button>
            </div>

          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <ProductReviews productId={product.id} />
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">You may also like</h3>
              <Link
                to="/products"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((item) => (
                <Link key={item.id} to={`/product/${item.id}`} className="group">
                  <div className="aspect-square bg-secondary/30 rounded-2xl mb-3 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                  <p className="text-sm font-semibold mt-0.5">GH₵{item.price.toFixed(2)}</p>
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
