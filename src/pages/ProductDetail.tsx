import { SEO } from "@/components/SEO";
import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Heart, ShoppingBag, 
  Search, CheckCircle2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
  colors?: any;
  sizes?: any;
}

const safeArray = (val: any): any[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
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
      setLoading(true);
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (productError) throw productError;
      
      const prod = productData as any;
      setProduct(prod);
      
      const rawColors = safeArray(prod?.colors);
      if (rawColors.length > 0) {
        const first = rawColors[0];
        const colorName = typeof first === "string" ? first : first?.name;
        if (colorName) setSelectedColor(colorName);
      }

      if (prod) {
        const { data: relatedData } = await supabase
          .from("products")
          .select("*")
          .eq("category", prod.category || "")
          .neq("id", id)
          .limit(4);

        setRelatedProducts((relatedData as any) || []);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const colors = useMemo(() => {
    if (!product) return [];
    return safeArray(product.colors).map((c: any) => {
      if (typeof c === "string") return { name: c, hex: "#cccccc", image: null, stock: undefined };
      return {
        name: c.name || "Default",
        hex: c.hex || "#cccccc",
        image: c.image || null,
        stock: c.stock
      };
    });
  }, [product]);

  const sizes = useMemo(() => {
    if (!product) return [];
    return safeArray(product.sizes).map(s => String(s));
  }, [product]);

  const rawImages = useMemo(() => {
    if (!product) return [];
    return safeArray(product.images);
  }, [product]);

  const productImages = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.image) list.push(product.image);
    rawImages.forEach((img) => {
      if (img && typeof img === "string" && !list.includes(img)) list.push(img);
    });
    colors.forEach((c) => {
      if (c.image && typeof c.image === "string" && !list.includes(c.image)) list.push(c.image);
    });
    return list.length > 0 ? list : [product.image || ""];
  }, [product, rawImages, colors]);

  const features: string[] = useMemo(() => {
    if (!product) return [];
    return safeArray((product as any).features).filter(Boolean);
  }, [product]);

  const materialsInfo: string = (product as any)?.materials_info || "";
  const sizeFitInfo: string = (product as any)?.size_fit_info || "";
  const shippingInfo: string = (product as any)?.shipping_returns_info || "";

  const tabs = [
    "Details",
    ...(materialsInfo ? ["Materials"] : []),
    ...(sizeFitInfo ? ["Size & Fit"] : []),
    ...(shippingInfo ? ["Shipping & Returns"] : []),
  ];
  const currentTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  const handleAddToCart = () => {
    if (product) {
      if (sizes.length > 0 && !selectedSize) {
        toast.error("Please select a size first");
        return;
      }
      const colorObj = colors.find(c => c.name === selectedColor) || null;
      addToCart(product.id, quantity, colorObj, selectedSize);
    }
  };

  const handleToggleFavorite = () => {
    if (product) {
      toggleFavorite(product.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t("noProductsFound")}</p>
          <Button onClick={() => navigate("/department/home")}>Return to Shop</Button>
        </div>
      </div>
    );
  }

  const price = Number(product.price) || 0;
  const salePrice = product.sale_price != null ? Number(product.sale_price) : null;
  const isOnSale = salePrice != null && product.sale_ends_at && new Date(product.sale_ends_at) > new Date();
  const displayPrice = isOnSale ? salePrice! : price;

  const displayColor = hoveredColor || selectedColor;
  const activeColorIndex = colors.findIndex(c => c.name === displayColor);
  const activeColor = activeColorIndex >= 0 ? colors[activeColorIndex] : null;

  const activeMainImage = productImages[currentImageIndex] || activeColor?.image || product.image || "";

  const selectedColorObj = colors.find((c) => c.name === selectedColor) || null;
  const hasColorStock = colors.length > 0 && colors.some((c) => typeof c.stock === "number");
  const availableStock = hasColorStock
    ? Number(selectedColorObj?.stock ?? 0)
    : Number(product.stock ?? 0);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": activeMainImage || product.image,
    "description": product.description || `${product.name} available at Trades Point.`,
    "sku": product.id,
    "offers": {
      "@type": "Offer",
      "url": `https://tradespoint.store/product/${product.id}`,
      "priceCurrency": "GHS",
      "price": displayPrice,
      "availability": isSoldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Trades Point"
      }
    }
  };

  return (
    <main className="min-h-screen bg-white font-sans text-black pb-20">
      <SEO
        title={product.name}
        description={product.description || `Buy ${product.name} at the best price on Trades Point. Fast shipping & secure payments.`}
        keywords={[product.name, product.category, "Trades Point", "Buy Online Ghana"]}
        ogType="product"
        ogImage={activeMainImage || product.image}
        schema={productSchema}
      />
      
      {/* Top Navigation - kept minimal */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <button 
            onClick={() => (window.history.length > 2 ? navigate(-1) : navigate("/department/home"))} 
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 mb-20">
          
          {/* LEFT: Vertical Gallery */}
          <div className="flex gap-4 sm:gap-6 h-[500px] sm:h-[650px]">
            {/* Thumbnails (Vertical) */}
            <div className="flex flex-col gap-3 w-16 sm:w-20 overflow-y-auto hide-scrollbar pb-2">
              {productImages.map((img, index) => (
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
                  src={activeMainImage}
                  alt={product.name || "Product"}
                  className="w-full h-full object-cover transition-all duration-300"
                />
              </AnimatePresence>
              <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
                <DialogTrigger asChild>
                  <button 
                    onMouseEnter={() => setIsZoomOpen(true)}
                    className="absolute bottom-6 right-6 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <Search className="w-5 h-5 text-black" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl p-0 overflow-hidden bg-transparent border-none shadow-none [&>button]:bg-white [&>button]:text-black [&>button]:p-2 [&>button]:rounded-full [&>button]:opacity-100 [&>button]:right-2 [&>button]:top-2 [&>button]:focus:ring-0 [&>button_svg]:w-5 [&>button_svg]:h-5">
                  <img 
                    src={activeMainImage} 
                    alt={product.name || "Product"} 
                    className="w-full h-auto max-h-[90vh] object-contain rounded-xl transition-all duration-300" 
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* RIGHT: Product Info */}
          <div className="flex flex-col pt-2 sm:pt-6">

            {product.category && (
              <div className="inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-1 rounded-md mb-4 self-start capitalize">
                {product.category}
              </div>
            )}

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
                    GH₵{price.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-white bg-black px-2 py-1 rounded">
                    {Math.round(((price - displayPrice) / price) * 100)}% OFF
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <p className="text-gray-600 text-sm leading-relaxed mb-8">
                {product.description}
              </p>
            )}

            {(typeof product.stock === "number" || hasColorStock) && (
              <p className="text-sm font-medium mb-6">
                {availableStock > 0 ? (
                  <span className="text-gray-600">
                    {availableStock <= 5 ? `Only ${availableStock} left` : `${availableStock} in stock`}
                    {hasColorStock && selectedColor ? ` in ${selectedColor}` : ""}
                  </span>
                ) : (
                  <span className="text-red-600">
                    {hasColorStock && selectedColor ? `${selectedColor} is out of stock` : "Out of stock"}
                  </span>
                )}
              </p>
            )}

            <Separator className="mb-8" />

            {/* Colors */}
            {colors.length > 0 && (
              <div className="mb-8">
                <p className="text-sm font-bold text-black mb-3">
                  Color: <span className="font-medium text-gray-600">{displayColor}</span>
                </p>
                <div className="flex gap-3 flex-wrap">
                  {colors.map((c) => {
                    const isSelected = selectedColor === c.name;
                    const outOfStock = hasColorStock && Number(c.stock ?? 0) <= 0;
                    return (
                      <button
                        key={c.name}
                        onMouseEnter={() => setHoveredColor(c.name)}
                        onMouseLeave={() => setHoveredColor(null)}
                        onClick={() => {
                          setSelectedColor(c.name);
                          if (c.image) {
                            const idx = productImages.indexOf(c.image);
                            if (idx >= 0) setCurrentImageIndex(idx);
                          }
                        }}
                        className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all p-0.5 ${
                          isSelected ? "border-orange-500 shadow-sm" : "border-gray-200 hover:border-gray-400"
                        } ${outOfStock ? "opacity-40" : ""}`}
                        title={outOfStock ? `${c.name} — out of stock` : c.name}
                      >
                        {c.image ? (
                          <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                            <img 
                              src={c.image} 
                              alt={c.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div 
                            className="w-full h-full rounded-full border border-gray-100" 
                            style={{ backgroundColor: c.hex || "#cccccc" }}
                          />
                        )}
                        {outOfStock && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-full h-[2px] bg-gray-500 rotate-45" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {sizes.length > 0 && (
              <div className="mb-8">
                <div className="mb-3">
                  <p className="text-sm font-bold text-black">
                    Size: <span className="font-medium text-gray-600">{selectedSize || "Select a size"}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`h-10 px-4 rounded-lg font-medium text-sm transition-colors border ${
                        selectedSize === size
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-gray-200 hover:border-black"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Row */}
            <div className="flex gap-4 mb-8">
              <Button
                onClick={handleAddToCart}
                disabled={isSoldOut}
                className="flex-1 h-14 bg-black hover:bg-black/90 text-white rounded-xl font-bold text-base gap-3"
              >
                <ShoppingBag className="w-5 h-5" />
                {isSoldOut ? "Out of stock" : "Add to Cart"}
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
                    currentTab === tab ? "text-black" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab}
                  {currentTab === tab && (
                    <motion.div 
                      layoutId="tabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                    />
                  )}
                </button>
              ))}
            </div>

            {currentTab === "Details" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-gray-600 text-sm leading-relaxed mb-8">
                  {product.description || "No description provided for this product yet."}
                </div>

                {features.length > 0 && (
                  <ul className="space-y-4">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm font-medium text-black">
                        <CheckCircle2 className="w-5 h-5 text-gray-400" /> {f}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            {currentTab === "Materials" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-gray-600 text-sm leading-relaxed">
                  {materialsInfo}
                </div>
              </motion.div>
            )}

            {currentTab === "Size & Fit" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-gray-600 text-sm leading-relaxed">
                  {sizeFitInfo}
                </div>
              </motion.div>
            )}

            {currentTab === "Shipping & Returns" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-gray-600 text-sm leading-relaxed">
                  {shippingInfo}
                </div>
              </motion.div>
            )}
          </div>

        </div>

        <ProductReviews productId={product.id} />
      </div>
    </main>
  );
};

export default ProductDetail;
