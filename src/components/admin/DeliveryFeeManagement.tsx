import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Trash2, Save, History, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface DeliveryFee {
  id: string;
  region: string;
  city: string | null;
  fee: number;
  is_active: boolean;
  is_default: boolean;
}

interface AuditEntry {
  id: string;
  delivery_fee_id: string | null;
  action: string;
  changed_by_email: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
}

const AUDITED_FIELDS = ["region", "city", "fee", "is_active", "is_default"] as const;

export const DeliveryFeeManagement = () => {
  const [fees, setFees] = useState<DeliveryFee[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newRegion, setNewRegion] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newFee, setNewFee] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [feesRes, auditRes] = await Promise.all([
      supabase.from("delivery_fees").select("*").order("is_default", { ascending: false }).order("region", { ascending: true }),
      supabase.from("delivery_fee_audit").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (feesRes.error) toast.error("Failed to load delivery fees");
    else setFees((feesRes.data as DeliveryFee[]) ?? []);
    if (!auditRes.error) setAudit((auditRes.data as AuditEntry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (id: string, patch: Partial<DeliveryFee>) => {
    setFees((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const friendlyError = (err: any): string => {
    const msg = err?.message || "";
    if (err?.code === "23505" || /duplicate/i.test(msg) || /unique/i.test(msg)) {
      if (/only_one_default/i.test(msg)) return "Only one default delivery fee is allowed. Unset the existing default first.";
      return "A delivery fee for that region already exists. Edit the existing row instead.";
    }
    return msg || "Something went wrong.";
  };

  const saveRow = async (row: DeliveryFee) => {
    if (!row.region.trim()) {
      toast.error("Region cannot be empty");
      return;
    }
    setSavingId(row.id);
    const { error } = await supabase
      .from("delivery_fees")
      .update({
        region: row.region.trim(),
        city: row.city?.trim() || null,
        fee: Number(row.fee) || 0,
        is_active: row.is_active,
        is_default: row.is_default,
      })
      .eq("id", row.id);
    setSavingId(null);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Delivery fee updated");
      load();
    }
  };

  const deleteRow = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error("You cannot delete the default delivery fee. Mark another row as default first.");
      return;
    }
    if (!confirm("Delete this delivery fee?")) return;
    const { error } = await supabase.from("delivery_fees").delete().eq("id", id);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Deleted");
      load();
    }
  };

  const addRow = async () => {
    if (!newRegion.trim()) {
      toast.error("Region is required");
      return;
    }
    const fee = Number(newFee);
    if (isNaN(fee) || fee < 0) {
      toast.error("Enter a valid fee");
      return;
    }
    // Client-side duplicate guard
    const dup = fees.find((f) => f.region.trim().toLowerCase() === newRegion.trim().toLowerCase());
    if (dup) {
      toast.error(`"${dup.region}" already exists. Edit the existing row instead.`);
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from("delivery_fees")
      .insert({
        region: newRegion.trim(),
        city: newCity.trim() || null,
        fee,
        is_active: true,
      });
    setAdding(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Location added");
    setNewRegion("");
    setNewCity("");
    setNewFee("");
    load();
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const renderDiff = (entry: AuditEntry) => {
    if (entry.action === "created") {
      return (
        <div className="text-xs space-y-0.5">
          {AUDITED_FIELDS.map((k) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span>{" "}
              <span className="font-mono">{String(entry.new_values?.[k] ?? "—")}</span>
            </div>
          ))}
        </div>
      );
    }
    if (entry.action === "deleted") {
      return (
        <div className="text-xs space-y-0.5">
          {AUDITED_FIELDS.map((k) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span>{" "}
              <span className="font-mono line-through opacity-70">{String(entry.old_values?.[k] ?? "—")}</span>
            </div>
          ))}
        </div>
      );
    }
    // updated → show only changed fields
    const changes = AUDITED_FIELDS.filter(
      (k) => String(entry.old_values?.[k] ?? "") !== String(entry.new_values?.[k] ?? "")
    );
    if (changes.length === 0) return <span className="text-xs text-muted-foreground">No tracked changes</span>;
    return (
      <div className="text-xs space-y-0.5">
        {changes.map((k) => (
          <div key={k}>
            <span className="text-muted-foreground">{k}:</span>{" "}
            <span className="font-mono line-through opacity-70">{String(entry.old_values?.[k] ?? "—")}</span>
            {" → "}
            <span className="font-mono font-semibold">{String(entry.new_values?.[k] ?? "—")}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Delivery Fees</h2>
          <p className="text-sm text-muted-foreground">
            Customers see the matching fee at checkout. Lookup order: <strong>exact city → region → Default</strong>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="w-4 h-4 mr-1" /> View history
        </Button>
      </div>

      {/* Add new */}
      <div className="border border-border rounded-lg p-4 bg-muted/30">
        <h3 className="text-sm font-semibold mb-3">Add a new location</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-region" className="text-xs">Region *</Label>
            <Input id="new-region" placeholder="e.g. Greater Accra" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-city" className="text-xs">City (optional)</Label>
            <Input id="new-city" placeholder="e.g. Accra" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-fee" className="text-xs">Fee (GH₵) *</Label>
            <Input id="new-fee" type="number" min="0" step="0.01" placeholder="0.00" value={newFee} onChange={(e) => setNewFee(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={addRow} disabled={adding} className="w-full">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Region</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Fee (GH₵)</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No delivery fees yet. Add one above.
                </TableCell>
              </TableRow>
            )}
            {fees.map((fee) => (
              <TableRow key={fee.id} className={fee.is_default ? "bg-primary/5" : ""}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {fee.is_default && <Star className="w-3.5 h-3.5 text-primary fill-primary" />}
                    <Input value={fee.region} onChange={(e) => updateField(fee.id, { region: e.target.value })} className="h-9" />
                  </div>
                </TableCell>
                <TableCell>
                  <Input value={fee.city ?? ""} onChange={(e) => updateField(fee.id, { city: e.target.value })} placeholder="—" className="h-9" />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fee.fee}
                    onChange={(e) => updateField(fee.id, { fee: parseFloat(e.target.value) || 0 })}
                    className="h-9 w-28"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={fee.is_default}
                    onCheckedChange={(checked) => updateField(fee.id, { is_default: checked })}
                  />
                </TableCell>
                <TableCell>
                  <Switch checked={fee.is_active} onCheckedChange={(checked) => updateField(fee.id, { is_active: checked })} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => saveRow(fee)} disabled={savingId === fee.id}>
                      {savingId === fee.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteRow(fee.id, fee.is_default)}
                      disabled={fee.is_default}
                      className="text-destructive hover:text-destructive disabled:opacity-30"
                      title={fee.is_default ? "Default cannot be deleted" : "Delete"}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Audit Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Delivery fee history</DialogTitle>
          </DialogHeader>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No changes recorded yet.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {audit.map((a) => (
                <div key={a.id} className="border border-border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={a.action === "created" ? "default" : a.action === "deleted" ? "destructive" : "secondary"}
                        className="text-[10px] uppercase"
                      >
                        {a.action}
                      </Badge>
                      <span className="text-xs font-medium">
                        {a.new_values?.region || a.old_values?.region || "—"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>{a.changed_by_email || "system"}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(a.created_at)}</span>
                    </div>
                  </div>
                  {renderDiff(a)}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
