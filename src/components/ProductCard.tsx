import { motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useFavorites } from "@/hooks/useFavorites";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  stock?: number;
  sale_price?: number | null;
  sale_ends_at?: string | null;
}

export const ProductCard = ({ id, name, price, image, stock, sale_price, sale_ends_at }: ProductCardProps) => {

  const { isFavorite, toggleFavorite } = useFavorites();

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(id);
  };

  const isOnSale = sale_price != null && sale_ends_at && new Date(sale_ends_at) > new Date();

  return (
    <Link to={`/product/${id}`} className="block group">
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Image Container */}
        <div className="relative aspect-[3/4] bg-secondary/50 rounded-2xl mb-4 overflow-hidden">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Sale Badge */}
          {isOnSale && (
            <div className="absolute top-3 left-3 px-2.5 py-1 bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
              Sale
            </div>
          )}

          {/* Hover Overlay Actions */}
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
          
          {/* Favorite Button */}
          <button
            onClick={handleFavoriteClick}
            className="absolute top-3 right-3 w-9 h-9 bg-background/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-sm"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${isFavorite(id) ? "fill-destructive text-destructive" : "text-foreground"}`}
            />
          </button>

          {/* Quick Add Button */}
          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            <div className="flex items-center justify-center gap-2 bg-foreground text-background py-2.5 rounded-xl text-xs font-medium">
              <ShoppingBag className="w-3.5 h-3.5" />
              Quick View
            </div>
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-1.5 px-1">
          <h3 className="text-sm font-medium text-foreground leading-tight line-clamp-1 group-hover:text-foreground/80 transition-colors">
            {name}
          </h3>
          {isOnSale ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-destructive">
                GH₵{sale_price!.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                GH₵{price.toFixed(2)}
              </span>
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground">
              GH₵{price.toFixed(2)}
            </p>
          )}
          {typeof stock === "number" && (
            stock <= 0 ? (
              <p className="text-[11px] font-medium text-destructive">Out of stock</p>
            ) : stock <= 5 ? (
              <p className="text-[11px] font-medium text-destructive">Only {stock} left</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{stock} in stock</p>
            )
          )}
        </div>

      </motion.div>
    </Link>
  );
};
