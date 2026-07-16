import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { Heart } from "lucide-react";

interface FlashProduct {
  id: string;
  name: string;
  price: number;
  sale_price: number;
  sale_ends_at: string;
  image: string;
}

const CountdownTimer = ({ endDate }: { endDate: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="flex gap-1.5">
      {[
        { value: timeLeft.days, label: "D" },
        { value: timeLeft.hours, label: "H" },
        { value: timeLeft.minutes, label: "M" },
        { value: timeLeft.seconds, label: "S" },
      ].map((unit) => (
        <div key={unit.label} className="bg-foreground text-background rounded-md px-2 py-1 text-center min-w-[36px]">
          <span className="text-sm font-bold block leading-tight">{String(unit.value).padStart(2, "0")}</span>
          <span className="text-[9px] opacity-70">{unit.label}</span>
        </div>
      ))}
    </div>
  );
};

export const FlashSales = () => {
  const [products, setProducts] = useState<FlashProduct[]>([]);
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const fetchFlashSales = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, sale_price, sale_ends_at, image")
        .not("sale_price", "is", null)
        .gt("sale_ends_at", new Date().toISOString())
        .order("sale_ends_at", { ascending: true })
        .limit(6);

      if (data) setProducts(data as FlashProduct[]);
    };
    fetchFlashSales();
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-destructive/5">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Flash Sales</h2>
              <p className="text-sm text-muted-foreground">Limited time deals — grab them before they're gone!</p>
            </div>
          </div>
          <Link to="/products">
            <Button variant="outline" className="rounded-full gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {products.map((product, index) => {
            const discount = Math.round(((product.price - product.sale_price) / product.price) * 100);
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link to={`/product/${product.id}`} className="group block">
                  <div className="relative aspect-square bg-secondary rounded-2xl mb-3 overflow-hidden">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground">
                      -{discount}%
                    </Badge>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(product.id); }}
                      className="absolute top-3 right-3 w-8 h-8 bg-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(product.id) ? 'fill-primary text-primary' : ''}`} />
                    </button>
                  </div>
                  <h3 className="text-sm font-medium mb-1 truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-destructive">GH₵{product.sale_price.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground line-through">GH₵{product.price.toFixed(2)}</span>
                  </div>
                  <CountdownTimer endDate={product.sale_ends_at} />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
