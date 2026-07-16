import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Eye, Calendar, Package, Trash2, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  created_at: string | null;
  sale_price: number | null;
  sale_ends_at: string | null;
}

export const NewArrivalsManagement = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchNewArrivals();
  }, []);

  const fetchNewArrivals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      setProducts(data || []);
    } catch {
      toast({ title: "Error fetching new arrivals", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleHide = async (product: Product) => {
    // "Hide from site" is implemented by setting stock to 0 — keeps the product record
    // intact so previously-bought orders still reference a valid product.
    if (!confirm(`Hide "${product.name}" from the site? It will no longer appear in New Arrivals or shop listings until re-stocked.`)) return;
    setBusyId(product.id);
    const { error } = await supabase.from("products").update({ stock: 0 }).eq("id", product.id);
    setBusyId(null);
    if (error) toast({ title: "Couldn't hide product", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Hidden from site", description: `${product.name} is no longer visible.` });
      fetchNewArrivals();
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Permanently delete "${product.name}"? This cannot be undone.`)) return;
    setBusyId(product.id);
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product deleted" });
      fetchNewArrivals();
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isOnSale = (p: Product) =>
    p.sale_price != null && p.sale_ends_at && new Date(p.sale_ends_at) > new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              New Arrivals
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              <Eye className="w-3 h-3 mr-1" />
              Latest 8 products on shop page
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            These items appear in the "New Arrivals" section. Hide an item to remove it from the site without deleting its history, or delete it permanently.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <AnimatePresence>
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-bold shrink-0">
                    {index + 1}
                  </div>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">{product.name}</h4>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground capitalize">
                        <Package className="w-3 h-3 inline mr-1" />
                        {product.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {formatDate(product.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOnSale(product) && (
                      <Badge variant="destructive" className="text-[10px]">Sale</Badge>
                    )}
                    {product.stock <= 0 ? (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                        Out of Stock
                      </Badge>
                    ) : product.stock <= 5 ? (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        Low Stock ({product.stock})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Stock: {product.stock}
                      </Badge>
                    )}
                    <span className="text-sm font-semibold whitespace-nowrap">
                      GH₵{isOnSale(product) ? product.sale_price!.toFixed(2) : product.price.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-1 ml-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={busyId === product.id || product.stock === 0}
                        onClick={() => handleHide(product)}
                        title="Hide from site"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={busyId === product.id}
                        onClick={() => handleDelete(product)}
                        title="Delete permanently"
                      >
                        {busyId === product.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {products.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No products found. Add products to see them here.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
