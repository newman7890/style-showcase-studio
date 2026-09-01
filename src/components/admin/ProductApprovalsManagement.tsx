import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, PackageCheck, ImagePlus, Trash2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface PendingProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  images?: string[];
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

  // Image editor state
  const [editingProduct, setEditingProduct] = useState<PendingProduct | null>(null);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, image, images, category, description, status, rejection_reason, seller_id, seller_profiles!products_seller_id_fkey(business_name)")
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

  // Image editor functions
  const openImageEditor = (product: PendingProduct) => {
    setEditingProduct(product);
    const imgs = product.images && product.images.length > 0 ? product.images : [product.image];
    setEditPreviews([...imgs]);
    setEditNewFiles([]);
  };

  const closeImageEditor = () => {
    setEditingProduct(null);
    setEditPreviews([]);
    setEditNewFiles([]);
  };

  const removeEditImage = (index: number) => {
    const preview = editPreviews[index];
    const isNew = preview?.startsWith("data:");
    setEditPreviews((prev) => prev.filter((_, i) => i !== index));
    if (isNew) {
      const existingBefore = editPreviews.slice(0, index).filter((p) => !p.startsWith("data:")).length;
      const fileIndex = index - existingBefore;
      setEditNewFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    setEditPreviews((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.unshift(moved);
      return updated;
    });
    toast({ title: "Cover image updated" });
  };

  const addEditImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setEditNewFiles((prev) => [...prev, ...files]);
      const readers = files.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      Promise.all(readers).then((newPreviews) => {
        setEditPreviews((prev) => [...prev, ...newPreviews]);
      });
    }
  };

  const saveImageEdits = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      // Upload new files
      const uploadedUrls: string[] = [];
      for (const file of editNewFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from("product-images")
          .getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      // Build final image list: existing URLs + uploaded URLs, in preview order
      const finalImages: string[] = [];
      let uploadIndex = 0;
      for (const preview of editPreviews) {
        if (preview.startsWith("data:")) {
          if (uploadIndex < uploadedUrls.length) {
            finalImages.push(uploadedUrls[uploadIndex]);
            uploadIndex++;
          }
        } else {
          finalImages.push(preview);
        }
      }

      const mainImage = finalImages.length > 0 ? finalImages[0] : editingProduct.image;

      const { error } = await supabase
        .from("products")
        .update({ image: mainImage, images: finalImages })
        .eq("id", editingProduct.id);

      if (error) throw error;
      toast({ title: "Product images updated successfully! 🎉" });
      closeImageEditor();
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveAndApprove = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      // Upload new files
      const uploadedUrls: string[] = [];
      for (const file of editNewFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from("product-images")
          .getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const finalImages: string[] = [];
      let uploadIndex = 0;
      for (const preview of editPreviews) {
        if (preview.startsWith("data:")) {
          if (uploadIndex < uploadedUrls.length) {
            finalImages.push(uploadedUrls[uploadIndex]);
            uploadIndex++;
          }
        } else {
          finalImages.push(preview);
        }
      }

      const mainImage = finalImages.length > 0 ? finalImages[0] : editingProduct.image;

      const { error } = await supabase
        .from("products")
        .update({ image: mainImage, images: finalImages, status: "approved", rejection_reason: null })
        .eq("id", editingProduct.id);

      if (error) throw error;
      toast({ title: "Product images fixed & approved! ✅" });
      closeImageEditor();
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
                    <Button size="sm" variant="outline" onClick={() => openImageEditor(p)} title="Edit & Fix Images">
                      <ImagePlus className="w-4 h-4" />
                    </Button>
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

      {/* Rejection Reason Dialog */}
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

      {/* Image Editor Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(o) => { if (!o) closeImageEditor(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5" /> Edit & Fix Images: {editingProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Image Gallery */}
            {editPreviews.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {editPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Image ${index + 1}`}
                      className="w-full h-28 object-cover rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeEditImage(index)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove this image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {index === 0 ? (
                      <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded font-semibold">
                        ★ Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makeCover(index)}
                        className="absolute bottom-1 left-1 bg-background/80 text-foreground text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium"
                        title="Set as main cover image"
                      >
                        <Star className="w-3 h-3" /> Make Cover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No images. Upload new images below.</p>
            )}

            {/* Add More Images */}
            <div>
              <Label>Add Replacement Images</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={addEditImages}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Select high-quality images to replace poor seller photos.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t px-6 py-4 flex gap-2 justify-end bg-background">
            <Button variant="outline" onClick={closeImageEditor}>Cancel</Button>
            <Button variant="secondary" onClick={saveImageEdits} disabled={saving}>
              {saving ? "Saving..." : "Save Images Only"}
            </Button>
            {editingProduct?.status !== "approved" && (
              <Button onClick={saveAndApprove} disabled={saving}>
                {saving ? "Saving..." : <><CheckCircle2 className="w-4 h-4 mr-1" /> Fix & Approve</>}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
