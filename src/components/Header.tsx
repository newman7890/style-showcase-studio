import { ShoppingBag, Heart, User, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export const Header = () => {
  const { user, isAdmin } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold tracking-tight">
          OUR FASHION
        </Link>
        
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link to="/admin">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
                title="Admin Dashboard"
              >
                <Shield className="w-5 h-5" />
              </motion.button>
            </Link>
          )}
          <Link to="/favorites">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <Heart className="w-5 h-5" />
            </motion.button>
          </Link>
          <Link to="/cart">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full text-xs flex items-center justify-center">
                0
              </span>
            </motion.button>
          </Link>
          <Link to={user ? "/profile" : "/auth"}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <User className="w-5 h-5" />
            </motion.button>
          </Link>
        </div>
      </div>
    </motion.header>
  );
};
