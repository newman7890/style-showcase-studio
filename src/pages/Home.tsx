import { motion } from "framer-motion";
import { ArrowRight, Facebook, Twitter, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import heroBg from "@/assets/hero-bg.jpg";

const Home = () => {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroBg})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/30" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-start justify-center min-h-[calc(100vh-8rem)]"
          >
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-6xl lg:text-7xl font-light mb-8 max-w-2xl"
            >
              shop the most
              <br />
              <span className="font-semibold">modern</span>
              <br />
              essensials
            </motion.h1>

            <Link to="/products">
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 text-lg group"
              >
                Explore Collection
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </Link>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center gap-4 mt-12"
            >
              <a
                href="#"
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </motion.div>

            <div className="flex gap-2 mt-8">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className={`h-1 rounded-full ${
                    i === 0 ? "w-8 bg-foreground" : "w-1 bg-muted"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default Home;
