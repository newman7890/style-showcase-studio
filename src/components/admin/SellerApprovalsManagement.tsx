import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Ban,
  Store,
  Loader2,
  FileSearch,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  // extended
  full_legal_name: string | null;
  date_of_birth: string | null;
  business_type: string | null;
  business_registration_number: string | null;
  business_address: string | null;
  tax_id: string | null;
  vat_number: string | null;
  id_document_type: string | null;
  id_document_number: string | null;
  id_document_front_url: string | null;
  id_document_back_url: string | null;
  selfie_url: string | null;
  proof_of_address_url: string | null;
  proof_of_address_type: string | null;
  proof_of_address_issued_on: string | null;
  tax_form_type: string | null;
  tax_form_url: string | null;
  bank_name: string | null;
  swift_bic: string | null;
  payout_method: string | null;
  momo_provider: string | null;
  momo_number: string | null;
  momo_account_name: string | null;
  store_name: string | null;
  store_logo_url: string | null;
  store_description: string | null;
  return_address: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  identity_verified_at: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null;
  commission_override: number | null;
  applied_at: string;
}

interface ComplianceDoc {
  id: string;
  doc_type: string;
  doc_url: string;
  notes: string | null;
  uploaded_at: string;
}

interface BillingAuth {
  id: string;
  card_brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

export const SellerApprovalsManagement = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "suspended">("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<SellerRow | null>(null);
  const [compliance, setCompliance] = useState<ComplianceDoc[]>([]);
  const [billing, setBilling] = useState<BillingAuth[]>([]);

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
    setReviewing(null);
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

  const markIdentityVerified = async (id: string) => {
    const { error } = await supabase
      .from("seller_profiles")
      .update({ identity_verified_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Identity marked verified" });
    load();
  };

  const openReview = async (r: SellerRow) => {
    setReviewing(r);
    setCompliance([]);
    setBilling([]);
    const [{ data: docs }, { data: bills }] = await Promise.all([
      supabase
        .from("seller_compliance_documents")
        .select("*")
        .eq("seller_profile_id", r.id)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("seller_billing_authorizations")
        .select("*")
        .eq("user_id", r.user_id),
    ]);
    setCompliance((docs as any) ?? []);
    setBilling((bills as any) ?? []);
  };

  const signedUrl = async (path: string | null, publicUrl = false) => {
    if (!path) return null;
    // If it's already an http URL, return as-is
    if (path.startsWith("http")) return path;
    if (publicUrl) {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      return data.publicUrl;
    }
    const { data, error } = await supabase.storage
      .from("seller-verification")
      .createSignedUrl(path, 300);
    if (error) return null;
    return data.signedUrl;
  };

  const openDoc = async (path: string | null) => {
    const url = await signedUrl(path);
    if (!url) return toast({ title: "No document", variant: "destructive" });
    window.open(url, "_blank", "noopener,noreferrer");
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
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg">{r.store_name || r.business_name}</div>
                    {r.full_legal_name && (
                      <div className="text-sm text-muted-foreground">Legal name: {r.full_legal_name}</div>
                    )}
                    {r.email && <div className="text-sm text-muted-foreground break-all">{r.email}</div>}
                    {r.phone && <div className="text-sm text-muted-foreground">📞 {r.phone}</div>}
                    <div className="text-xs text-muted-foreground mt-2">
                      Applied {new Date(r.applied_at).toLocaleString()}
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
                  <Button size="sm" variant="outline" onClick={() => openReview(r)}>
                    <FileSearch className="w-4 h-4 mr-1" /> Review full application
                  </Button>
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

      {/* Reject / suspend reason dialog */}
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

      {/* Full review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) setReviewing(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review application — {reviewing?.store_name || reviewing?.business_name}
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <Tabs defaultValue="personal">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="business">Business</TabsTrigger>
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="bank">Payout</TabsTrigger>
                <TabsTrigger value="store">Store</TabsTrigger>
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-2 pt-3">
                <Row label="Full legal name" value={reviewing.full_legal_name} />
                <Row label="Date of birth" value={reviewing.date_of_birth} />
                <Row
                  label="Email"
                  value={reviewing.email}
                  badge={reviewing.email_verified_at ? "verified" : undefined}
                />
                <Row
                  label="Phone"
                  value={reviewing.phone}
                  badge={reviewing.phone_verified_at ? "verified" : undefined}
                />
                <Row label="Residential address" value={reviewing.address} />
              </TabsContent>

              <TabsContent value="business" className="space-y-2 pt-3">
                <Row label="Business type" value={reviewing.business_type} />
                <Row label="Business name" value={reviewing.business_name} />
                <Row label="Registration #" value={reviewing.business_registration_number} />
                <Row label="Business address" value={reviewing.business_address} />
                <Row label="Tax ID (TIN)" value={reviewing.tax_id} />
                <Row label="VAT number" value={reviewing.vat_number} />
              </TabsContent>

              <TabsContent value="identity" className="space-y-3 pt-3">
                <Row label="ID type" value={reviewing.id_document_type} />
                <Row label="ID number" value={reviewing.id_document_number} />
                <Row label="Ghana Card #" value={reviewing.ghana_card_number} />
                <div className="grid sm:grid-cols-3 gap-2">
                  <DocButton label="ID front" path={reviewing.id_document_front_url} onOpen={openDoc} />
                  <DocButton label="ID back" path={reviewing.id_document_back_url} onOpen={openDoc} />
                  <DocButton label="Selfie" path={reviewing.selfie_url} onOpen={openDoc} />
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Proof of address</div>
                  <Row label="Type" value={reviewing.proof_of_address_type} />
                  <Row label="Issue date" value={reviewing.proof_of_address_issued_on} />
                  <DocButton label="View document" path={reviewing.proof_of_address_url} onOpen={openDoc} />
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Tax form</div>
                  <Row label="Type" value={reviewing.tax_form_type} />
                  <DocButton label="View form" path={reviewing.tax_form_url} onOpen={openDoc} />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {reviewing.identity_verified_at ? (
                    <Badge className="bg-green-600">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Identity verified {new Date(reviewing.identity_verified_at).toLocaleDateString()}
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={() => markIdentityVerified(reviewing.id)}>
                      <ShieldCheck className="w-4 h-4 mr-1" /> Mark identity verified
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="bank" className="space-y-2 pt-3">
                <Row label="Bank name" value={reviewing.bank_name} />
                <Row label="Account holder" value={reviewing.account_name} />
                <Row label="Account #" value={reviewing.account_number} mono />
                <Row label="Bank code" value={reviewing.bank_code} mono />
                <Row label="SWIFT / BIC" value={reviewing.swift_bic} mono />
              </TabsContent>

              <TabsContent value="store" className="space-y-2 pt-3">
                <Row label="Store name" value={reviewing.store_name} />
                {reviewing.store_logo_url && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase mb-1">Logo</div>
                    <img
                      src={reviewing.store_logo_url}
                      alt="Store logo"
                      className="w-24 h-24 rounded-md object-cover border"
                    />
                  </div>
                )}
                <Row label="Description" value={reviewing.store_description} />
                <Row label="Return address" value={reviewing.return_address} />
                <Row label="Public bio" value={reviewing.bio} />
              </TabsContent>

              <TabsContent value="compliance" className="pt-3 space-y-2">
                {compliance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No compliance documents uploaded.</p>
                ) : (
                  compliance.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-md border p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium capitalize">
                          {d.doc_type.replace(/_/g, " ")}
                        </div>
                        {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                        <div className="text-xs text-muted-foreground">
                          {new Date(d.uploaded_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openDoc(d.doc_url)}>
                        <ExternalLink className="w-4 h-4 mr-1" /> View
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="billing" className="pt-3 space-y-2">
                {billing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No card on file.</p>
                ) : (
                  billing.map((b) => (
                    <div key={b.id} className="rounded-md border p-3 text-sm flex items-center justify-between">
                      <span>
                        {b.card_brand || "Card"} •••• {b.last4 || "----"}{" "}
                        <span className="text-muted-foreground">
                          {b.exp_month}/{b.exp_year}
                        </span>
                      </span>
                      {b.is_default && <Badge variant="secondary">Default</Badge>}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}

          {reviewing && (
            <div className="flex gap-2 justify-end pt-3 border-t">
              {reviewing.status !== "approved" && (
                <Button onClick={() => setStatus(reviewing.id, "approved")}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
              )}
              {reviewing.status === "pending" && (
                <Button variant="destructive" onClick={() => setRejectingId(reviewing.id)}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
              )}
              {reviewing.status === "approved" && (
                <Button variant="destructive" onClick={() => setRejectingId(reviewing.id)}>
                  <Ban className="w-4 h-4 mr-1" /> Suspend
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

function Row({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm text-right ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-muted-foreground">—</span>}
        {badge && (
          <Badge variant="secondary" className="ml-2 text-[10px]">
            {badge}
          </Badge>
        )}
      </span>
    </div>
  );
}

function DocButton({
  label,
  path,
  onOpen,
}: {
  label: string;
  path: string | null;
  onOpen: (p: string | null) => void;
}) {
  if (!path) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground text-center">
        {label}: not provided
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={() => onOpen(path)} className="justify-start">
      <ExternalLink className="w-4 h-4 mr-1" /> {label}
    </Button>
  );
}
