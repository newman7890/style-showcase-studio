import { useState, useEffect } from "react";
import { Star, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  is_own: boolean;
}

interface ProductReviewsProps {
  productId: string;
}

const StarRating = ({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        disabled={!interactive}
        onClick={() => onRate?.(star)}
        className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
      >
        <Star
          className={`w-5 h-5 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      </button>
    ))}
  </div>
);

export const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [userReview, setUserReview] = useState<Review | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase.rpc("get_product_reviews", {
        _product_id: productId,
      });

      if (error) throw error;

      const rows = (data || []) as Review[];
      setReviews(rows);

      if (user) {
        const existing = rows.find((r) => r.is_own);
        if (existing) {
          setUserReview(existing);
          setRating(existing.rating);
          setComment(existing.comment || "");
        }
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || rating === 0) return;

    setSubmitting(true);
    try {
      if (userReview) {
        const { error } = await supabase
          .from("product_reviews")
          .update({ rating, comment: comment.trim() || null })
          .eq("id", userReview.id);
        if (error) throw error;
        toast({ title: "Review updated!" });
      } else {
        const { error } = await supabase
          .from("product_reviews")
          .insert({ product_id: productId, user_id: user.id, rating, comment: comment.trim() || null });
        if (error) throw error;
        toast({ title: "Review submitted!" });
      }
      await fetchReviews();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      const { error } = await supabase.from("product_reviews").delete().eq("id", reviewId);
      if (error) throw error;
      toast({ title: "Review deleted" });
      if (userReview?.id === reviewId) {
        setUserReview(null);
        setRating(0);
        setComment("");
      }
      await fetchReviews();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-lg font-semibold">Reviews</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={Math.round(avgRating)} />
            <span className="text-sm text-muted-foreground">
              {avgRating.toFixed(1)} ({reviews.length})
            </span>
          </div>
        )}
      </div>

      {/* Review Form */}
      {user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-secondary/50 rounded-2xl p-4 mb-6"
        >
          <p className="text-sm font-medium mb-2">
            {userReview ? "Update your review" : "Write a review"}
          </p>
          <StarRating rating={rating} onRate={setRating} interactive />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts..."
            className="mt-3 bg-background"
            maxLength={500}
          />
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="mt-3"
            size="sm"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {userReview ? "Update" : "Submit"}
          </Button>
        </motion.div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                    {review.avatar_url ? (
                      <img src={review.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {(review.full_name || "U")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{review.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} />
                  {(review.is_own || isAdmin) && (
                    <button onClick={() => handleDelete(review.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
