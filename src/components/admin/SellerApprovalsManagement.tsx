import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Ban, Store, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface SellerRow {
  id: string;
  user_id: string;
  business_name: string;
  phone: string | null;
  bio: string | null;
  email: string | null;
  address: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
  ghana_card_number: string | null;
  ghana_card_image_url: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null;
  commission_override: number | null;
  applied_at: string;
}

export const SellerApprovalsManagement = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "suspended">("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("status", filter)
      .order("applied_at", { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (
    id: string,
    status: "approved" | "rejected" | "suspended",
    rejection?: string,
  ) => {
    const { error } = await supabase
      .from("seller_profiles")
      .update({ status, rejection_reason: rejection ?? null })
      .eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: `Seller ${status}` });
    load();
  };

  const saveOverride = async (id: string) => {
    const raw = overrides[id];
    const val = raw === "" || raw === undefined ? null : parseFloat(raw);
    if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
      return toast({ title: "Invalid commission", variant: "destructive" });
    }
    const { error } = await supabase
      .from("seller_profiles")
      .update({ commission_override: val })
      .eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Commission saved" });
    load();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-2xl font-semibold flex items-center gap-2 mr-auto">
          <Store className="w-5 h-5" /> Seller Applications
        </h2>
        {(["pending", "approved", "suspended", "rejected"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No {filter} sellers.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="font-semibold text-lg">{r.business_name}</div>
                    <div className="text-sm text-muted-foreground">{r.phone}</div>
                    {r.bio && <p className="text-sm mt-2">{r.bio}</p>}
                    <div className="text-xs text-muted-foreground mt-2">
                      Applied {new Date(r.applied_at).toLocaleDateString()}
                    </div>
                    {r.rejection_reason && (
                      <div className="text-xs text-destructive mt-1">Reason: {r.rejection_reason}</div>
                    )}
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "secondary" : "destructive"}>
                    {r.status}
                  </Badge>
                </div>

                {r.status === "approved" && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Commission override (%)</Label>
                      <Input
                        type="number"
                        placeholder={r.commission_override != null ? "" : "Uses platform default"}
                        defaultValue={r.commission_override ?? ""}
                        onChange={(e) => setOverrides({ ...overrides, [r.id]: e.target.value })}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => saveOverride(r.id)}>Save</Button>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {r.status !== "approved" && (
                    <Button size="sm" onClick={() => setStatus(r.id, "approved")}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <Button size="sm" variant="destructive" onClick={() => setRejectingId(r.id)}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  )}
                  {r.status === "approved" && (
                    <Button size="sm" variant="destructive" onClick={() => setRejectingId(r.id)}>
                      <Ban className="w-4 h-4 mr-1" /> Suspend
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectingId} onOpenChange={(o) => { if (!o) { setRejectingId(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reason</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell the seller why" rows={4} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setRejectingId(null); setReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectingId) return;
                const target = rows.find((x) => x.id === rejectingId);
                const nextStatus = target?.status === "approved" ? "suspended" : "rejected";
                setStatus(rejectingId, nextStatus, reason || undefined);
                setRejectingId(null);
                setReason("");
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
