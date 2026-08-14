import { Heart, ShoppingBag } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useFavorites } from "@/hooks/useFavorites";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "react-router-dom";

const DEPARTMENTS = [
  { slug: "fashion" },
  { slug: "gadgets" },
  { slug: "home" },
  { slug: "art" },
  { slug: "other" },
] as const;

export const Header = () => {
  const { favorites } = useFavorites();
  const { itemCount } = useCart();
  const { t } = useLanguage();
  const location = useLocation();
  const showCategories = location.pathname === "/products" || location.pathname.startsWith("/department");
  
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2 md:gap-4">
        <Link to="/" className="text-base md:text-xl font-semibold tracking-tight whitespace-nowrap shrink-0 truncate max-w-[92px] md:max-w-none">
          {t("logo")}
        </Link>

        {showCategories ? (
          <nav className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto md:overflow-visible md:flex-none scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
            {DEPARTMENTS.map((d) => (
              <NavLink
                key={d.slug}
                to={`/department/${d.slug}`}
                className={({ isActive }) =>
                  `shrink-0 px-2.5 md:px-3 py-1.5 text-[10px] md:text-xs uppercase tracking-wider rounded-full transition-colors ${
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                {t(d.slug)}
              </NavLink>
            ))}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-3 shrink-0">
          <Link to="/favorites" className="text-foreground">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative p-1">
              <Heart className="w-5 h-5" />
              {favorites.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                  {favorites.length}
                </span>
              )}
            </motion.button>
          </Link>

          <Link to="/cart" className="text-foreground">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative p-1">
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </motion.button>
          </Link>
        </div>
      </div>
    </motion.header>
  );
};
