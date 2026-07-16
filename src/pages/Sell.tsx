import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, XCircle, AlertCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import SellerWizard from "@/components/sell/SellerWizard";

const Sell = () => {
  const { user, sellerStatus, isSeller, loading } = useAuth();
  const navigate = useNavigate();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth?redirect=/sell");
      return;
    }
    if (isSeller) {
      navigate("/seller");
      return;
    }
    if (sellerStatus === "rejected" || sellerStatus === "suspended") {
      supabase
        .from("seller_profiles")
        .select("rejection_reason")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setRejectionReason((data as any)?.rejection_reason ?? null));
    }
  }, [user, isSeller, sellerStatus, loading, navigate]);

  const renderStatus = () => {
    if (sellerStatus === "pending") {
      return (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <Clock className="w-12 h-12 text-yellow-500" />
            <h2 className="text-xl font-semibold">Application under review</h2>
            <p className="text-muted-foreground">
              We'll notify you once an admin has reviewed your application.
            </p>
          </CardContent>
        </Card>
      );
    }
    if (sellerStatus === "rejected") {
      return (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <XCircle className="w-12 h-12 text-destructive" />
            <h2 className="text-xl font-semibold">Application rejected</h2>
            {rejectionReason && <p className="text-muted-foreground">Reason: {rejectionReason}</p>}
          </CardContent>
        </Card>
      );
    }
    if (sellerStatus === "suspended") {
      return (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <h2 className="text-xl font-semibold">Account suspended</h2>
            {rejectionReason && <p className="text-muted-foreground">Reason: {rejectionReason}</p>}
          </CardContent>
        </Card>
      );
    }
    return <SellerWizard />;
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto px-4 max-w-2xl"
        >
          {renderStatus()}
        </motion.div>
      </main>
      <BottomNav />
    </>
  );
};

export default Sell;
