import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";

interface SharedProduct {
  id: string;
  name: string;
  price: number;
  image: string;
}

const SharedWishlist = () => {
  const { token } = useParams();
  const [products, setProducts] = useState<SharedProduct[]>([]);
  const [ownerName, setOwnerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchSharedWishlist = async () => {
      try {
        const { data, error } = await supabase
          .rpc("get_shared_wishlist", { _token: token as string });

        if (error || !data || (Array.isArray(data) && data.length === 0)) {
          setNotFound(true);
          return;
        }

        const rows = data as Array<{
          product_id: string;
          id: string;
          name: string;
          price: number;
          image: string;
          owner_name: string | null;
        }>;

        setOwnerName(rows[0]?.owner_name || "Someone");
        setProducts(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            price: r.price,
            image: r.image,
          }))
        );
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchSharedWishlist();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading wishlist...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Heart className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Wishlist not found</h2>
        <p className="text-muted-foreground">This shared wishlist link is invalid or has been removed.</p>
        <Link to="/" className="text-primary underline">Go to homepage</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">{ownerName}'s Wishlist</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground mb-8"
        >
          {ownerName} shared {products.length} favorite item{products.length !== 1 ? "s" : ""} with you.
        </motion.p>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Heart className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">This wishlist is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <ProductCard {...product} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default SharedWishlist;
