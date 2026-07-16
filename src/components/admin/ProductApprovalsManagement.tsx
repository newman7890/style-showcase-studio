import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface PendingProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "hidden";
  rejection_reason: string | null;
  seller_id: string | null;
  seller_profiles: { business_name: string } | null;
}

export const ProductApprovalsManagement = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingProduct[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "hidden">("pending");
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, image, category, description, status, rejection_reason, seller_id, seller_profiles!products_seller_id_fkey(business_name)")
      .eq("status", filter)
      .order("created_at", { ascending: false });
    // fallback: seller_profiles join by user_id — try simple query if that fails
    if (!data) {
      const { data: fb } = await supabase
        .from("products")
        .select("*")
        .eq("status", filter)
        .order("created_at", { ascending: false });
      setRows((fb as any) ?? []);
    } else {
      setRows(data as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const update = async (id: string, status: "approved" | "rejected" | "hidden", rej?: string) => {
    const { error } = await supabase
      .from("products")
      .update({ status, rejection_reason: rej ?? null })
      .eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: `Product ${status}` });
    load();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-2xl font-semibold flex items-center gap-2 mr-auto">
          <PackageCheck className="w-5 h-5" /> Product Approvals
        </h2>
        {(["pending", "approved", "rejected", "hidden"] as const).map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)} className="capitalize">
            {s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No {filter} products.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-4 flex gap-3 items-start">
                <img src={p.image} alt={p.name} className="w-20 h-20 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    GH₵{Number(p.price).toFixed(2)} · {p.category}
                  </div>
                  {p.seller_profiles?.business_name && (
                    <div className="text-xs text-muted-foreground">Seller: {p.seller_profiles.business_name}</div>
                  )}
                  {p.description && <p className="text-sm mt-1 line-clamp-2">{p.description}</p>}
                  {p.rejection_reason && (
                    <div className="text-xs text-destructive mt-1">Reason: {p.rejection_reason}</div>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={p.status === "approved" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>
                    {p.status}
                  </Badge>
                  <div className="flex gap-2">
                    {p.status !== "approved" && (
                      <Button size="sm" onClick={() => update(p.id, "approved")}><CheckCircle2 className="w-4 h-4" /></Button>
                    )}
                    {p.status !== "rejected" && (
                      <Button size="sm" variant="destructive" onClick={() => setRejectingId(p.id)}><XCircle className="w-4 h-4" /></Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectingId} onOpenChange={(o) => { if (!o) { setRejectingId(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reason for rejection</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Tell the seller what needs to change" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setRejectingId(null); setReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (rejectingId) { update(rejectingId, "rejected", reason || undefined); setRejectingId(null); setReason(""); } }}>
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
