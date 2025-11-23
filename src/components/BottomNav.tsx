import { Home, Search, ShoppingBag, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { motion } from "framer-motion";

export const BottomNav = () => {
  const navItems = [
    { icon: Home, path: "/", label: "Home" },
    { icon: Search, path: "/products", label: "Shop" },
    { icon: ShoppingBag, path: "/cart", label: "Cart" },
    { icon: User, path: "/profile", label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map(({ icon: Icon, path, label }) => (
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
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-foreground rounded-full"
                    />
                  )}
                </motion.div>
                <span className="text-xs">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
