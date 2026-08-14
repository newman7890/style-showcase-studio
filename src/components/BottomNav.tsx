import { Home, Search, ShoppingBag, User, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/contexts/LanguageContext";

export const BottomNav = () => {
  const { isAdmin } = useAuth();
  const { itemCount } = useCart();
  const { t } = useLanguage();

  const navItems = [
    { icon: Home, path: "/", labelKey: "home" as const },
    { icon: Search, path: "/products", labelKey: "shop" as const },
    { icon: ShoppingBag, path: "/cart", labelKey: "cart" as const },
    { icon: User, path: "/profile", labelKey: "profile" as const },
    ...(isAdmin ? [{ icon: Shield, path: "/admin", labelKey: "admin" as const }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {navItems.map(({ icon: Icon, path, labelKey }) => (
          <NavLink
            key={path}
            to={path}
            className="flex flex-col items-center gap-1 text-muted-foreground transition-colors"
            activeClassName="text-foreground"
          >
            {({ isActive }) => (
              <>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="relative"
                >
                  <Icon className="w-5 h-5" />
                  {path === "/cart" && itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-purple-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                      {itemCount}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-foreground rounded-full"
                    />
                  )}
                </motion.div>
                <span className="text-xs">{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
