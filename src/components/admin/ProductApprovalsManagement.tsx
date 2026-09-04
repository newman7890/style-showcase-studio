import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  PackageCheck, 
  ImagePlus, 
  Trash2, 
  Star, 
  Wand2, 
  Upload, 
  Sparkles, 
  AlertTriangle,
  Edit3,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { processAiBackgroundRemoval } from "@/utils/imageStudio";

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

interface StudioImageItem {
  id: string;
  url: string;
  file?: File | null;
  isProcessed?: boolean;
  isProcessingBg?: boolean;
}

interface EditFormState {
  name: string;
  price: string;
  category: string;
  description: string;
}

export const ProductApprovalsManagement = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingProduct[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "hidden">("pending");
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // AI Studio / Fix & Approve Dialog state
  const [editingProduct, setEditingProduct] = useState<PendingProduct | null>(null);
  const [studioImages, setStudioImages] = useState<StudioImageItem[]>([]);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "",
    price: "",
    category: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, image, images, category, description, status, rejection_reason, seller_id, seller_profiles!products_seller_id_fkey(business_name)")
      .eq("status", filter)
      .order("created_at", { ascending: false });

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

  useEffect(() => { 
    load(); 
  }, [filter]);

  const updateStatus = async (id: string, status: "approved" | "rejected" | "hidden", rej?: string) => {
    const { error } = await supabase
      .from("products")
      .update({ status, rejection_reason: rej ?? null })
      .eq("id", id);

    if (error) {
      return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    toast({ title: `Product status updated to ${status}` });
    load();
  };

  // Open the full Fix & Review Studio
  const openFixStudio = (product: PendingProduct) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name || "",
      price: product.price ? String(product.price) : "",
      category: product.category || "",
      description: product.description || "",
    });

    const rawList = product.images && product.images.length > 0 ? product.images : [product.image];
    const initialList: StudioImageItem[] = rawList.filter(Boolean).map((url, idx) => ({
      id: `existing-${idx}-${Date.now()}`,
      url,
      file: null,
      isProcessed: false,
      isProcessingBg: false,
    }));

    setStudioImages(initialList);
  };

  const closeFixStudio = () => {
    setEditingProduct(null);
    setStudioImages([]);
    setEditForm({ name: "", price: "", category: "", description: "" });
  };

  // AI Background Removal for a specific image in the studio
  const handleRemoveBg = async (index: number) => {
    const target = studioImages[index];
    if (!target || target.isProcessingBg) return;

    setStudioImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, isProcessingBg: true } : img))
    );

    toast({
      title: "AI Studio Processing... ✨",
      description: `Removing background for photo #${index + 1}. Please wait...`,
    });

    try {
      const source = target.file || target.url;
      const result = await processAiBackgroundRemoval(source, `studio-clean-${editingProduct?.id || "product"}`);

      setStudioImages((prev) =>
        prev.map((img, i) =>
          i === index
            ? {
                ...img,
                file: result.file,
                url: result.previewUrl,
                isProcessed: true,
                isProcessingBg: false,
              }
            : img
        )
      );

      toast({
        title: "Studio Background Removed! ✨",
        description: "Converted to clean transparent studio PNG.",
      });
    } catch (err: any) {
      console.error("Studio Background Removal Error:", err);
      const isFetchErr = err?.message?.includes("Failed to fetch") || err?.name === "TypeError";
      toast({
        title: isFetchErr ? "Network Connection Notice" : "Processing Notice",
        description: isFetchErr
          ? "Unable to download AI background removal models. Please check your connection and try again."
          : (err.message || "Failed to remove image background."),
        variant: "destructive",
      });
      setStudioImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, isProcessingBg: false } : img))
      );
    }
  };

  const handleMakeCover = (index: number) => {
    if (index === 0) return;
    setStudioImages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.unshift(moved);
      return updated;
    });
    toast({ title: "Cover Image Updated", description: "This image is now the primary product photo." });
  };

  const handleRemoveImage = (index: number) => {
    setStudioImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFiles = (files: File[]) => {
    if (!files.length) return;

    const newItems: StudioImageItem[] = files.map((file, idx) => {
      const objectUrl = URL.createObjectURL(file);
      return {
        id: `upload-${Date.now()}-${idx}-${Math.random()}`,
        url: objectUrl,
        file,
        isProcessed: false,
        isProcessingBg: false,
      };
    });

    setStudioImages((prev) => [...prev, ...newItems]);
    toast({
      title: "Images Added",
      description: `Added ${files.length} photo${files.length > 1 ? "s" : ""}. You can click 'Remove BG' to isolate products.`,
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleAddFiles(files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    handleAddFiles(files);
  };

  // Save changes (and optionally approve)
  const handleSaveProduct = async (approve: boolean) => {
    if (!editingProduct) return;

    const trimmedName = editForm.name.trim();
    const parsedPrice = parseFloat(editForm.price);
    const trimmedCategory = editForm.category.trim();

    if (!trimmedName) {
      return toast({ title: "Validation Error", description: "Product name is required.", variant: "destructive" });
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return toast({ title: "Validation Error", description: "Please enter a valid price greater than 0.", variant: "destructive" });
    }
    if (!trimmedCategory) {
      return toast({ title: "Validation Error", description: "Category is required.", variant: "destructive" });
    }
    if (studioImages.length === 0) {
      return toast({ title: "Validation Error", description: "At least one product image is required.", variant: "destructive" });
    }

    setSaving(true);
    try {
      const finalImageUrls: string[] = [];

      // Process and upload any modified or newly added files to Supabase Storage
      for (let i = 0; i < studioImages.length; i++) {
        const item = studioImages[i];
        if (item.file) {
          const fileExt = item.file.type.includes("png") ? "png" : item.file.name.split(".").pop() || "jpg";
          const fileName = `admin-fixed-${editingProduct.id}-${Date.now()}-${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(fileName, item.file, { contentType: item.file.type || "image/png" });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("product-images")
            .getPublicUrl(fileName);

          finalImageUrls.push(publicUrl);
        } else {
          finalImageUrls.push(item.url);
        }
      }

      const mainImage = finalImageUrls.length > 0 ? finalImageUrls[0] : editingProduct.image;

      const updatePayload: Record<string, any> = {
        name: trimmedName,
        price: parsedPrice,
        category: trimmedCategory,
        description: editForm.description.trim() || null,
        image: mainImage,
        images: finalImageUrls,
      };

      if (approve) {
        updatePayload.status = "approved";
        updatePayload.rejection_reason = null;
      }

      const { error: dbError } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", editingProduct.id);

      if (dbError) throw dbError;

      toast({
        title: approve ? "Product Fixed & Approved! ✅" : "Product Listing Updated! 💾",
        description: approve 
          ? `"${trimmedName}" is now active and published to the live store.` 
          : "Saved edits to product images and listing details.",
      });

      closeFixStudio();
      load();
    } catch (err: any) {
      console.error("Save error:", err);
      toast({
        title: "Save Failed",
        description: err.message || "Failed to update product.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-primary" /> Product Approvals
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review, enhance with AI background removal, fix seller errors, and approve store products.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["pending", "approved", "rejected", "hidden"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
              className="capitalize text-xs h-8 px-3"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <span className="text-sm">Loading submissions...</span>
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <PackageCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No {filter} products found.</p>
            <p className="text-xs mt-1">When sellers submit listings, they will show up here for moderation.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id} className="overflow-hidden hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex gap-4 items-start flex-col sm:flex-row">
                <div className="relative group shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted border">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="w-8 h-8 rounded-full"
                      onClick={() => openFixStudio(p)}
                      title="Open Image Studio & Fix"
                    >
                      <Wand2 className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base leading-tight text-foreground truncate">{p.name}</h3>
                    <Badge
                      variant={
                        p.status === "approved"
                          ? "default"
                          : p.status === "pending"
                          ? "secondary"
                          : "destructive"
                      }
                      className="text-[10px] uppercase font-bold tracking-wider"
                    >
                      {p.status}
                    </Badge>
                  </div>

                  <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    GH₵{Number(p.price).toFixed(2)}
                    <span className="text-xs text-muted-foreground font-normal ml-2">· Category: {p.category}</span>
                  </div>

                  {p.seller_profiles?.business_name && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="font-medium text-foreground">Seller:</span> {p.seller_profiles.business_name}
                    </div>
                  )}

                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  )}

                  {p.rejection_reason && (
                    <div className="text-xs bg-destructive/10 text-destructive rounded-md px-2.5 py-1.5 mt-2 flex items-start gap-1.5 border border-destructive/20">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span><strong>Rejection Reason:</strong> {p.rejection_reason}</span>
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col gap-2 items-center sm:items-end w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFixStudio(p)}
                    className="flex items-center gap-1.5 text-xs font-semibold h-8 w-full sm:w-auto hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-primary" /> Fix & Enhance
                  </Button>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    {p.status !== "approved" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus(p.id, "approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 flex-1 sm:flex-initial"
                        title="Quick Approve"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                    )}
                    {p.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectingId(p.id)}
                        className="text-xs h-8 flex-1 sm:flex-initial"
                        title="Reject Listing"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Rejection Modal */}
      <Dialog
        open={!!rejectingId}
        onOpenChange={(o) => {
          if (!o) {
            setRejectingId(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Reject Product Listing
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rejection-reason" className="text-xs font-semibold">
              Feedback for Seller (Required):
            </Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="e.g. Please upload clear photos with plain backgrounds, or specify complete sizing information."
              className="text-sm"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectingId(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => {
                if (rejectingId) {
                  updateStatus(rejectingId, "rejected", reason.trim());
                  setRejectingId(null);
                  setReason("");
                }
              }}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Studio & Fix Product Dialog */}
      <Dialog
        open={!!editingProduct}
        onOpenChange={(o) => {
          if (!o && !saving) closeFixStudio();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Dialog Header */}
          <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4 flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Wand2 className="w-5 h-5 text-primary animate-pulse" />
                <span>Fix & Enhance Product Studio</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Remove backgrounds, pick cover photo, add high-res photos, and correct listing errors.
              </p>
            </div>
            {editingProduct?.seller_profiles?.business_name && (
              <Badge variant="outline" className="text-xs font-normal">
                Seller: {editingProduct.seller_profiles.business_name}
              </Badge>
            )}
          </DialogHeader>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Section 1: Image Studio & AI BG Removal */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> Product Photos & AI Studio
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click <strong>Remove BG</strong> to turn noisy photos into clean studio PNGs with transparent backdrops.
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {studioImages.length} Photo{studioImages.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Photos Grid */}
              {studioImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {studioImages.map((imgItem, index) => (
                    <div
                      key={imgItem.id}
                      className={`group relative rounded-lg border-2 transition-all overflow-hidden flex flex-col ${
                        index === 0
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-muted-foreground/40"
                      }`}
                    >
                      {/* Image Preview Container with checkerboard background for transparent PNGs */}
                      <div className="relative w-full aspect-square bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:8px_8px] bg-muted/40 flex items-center justify-center p-2">
                        <img
                          src={imgItem.url}
                          alt={`Product photo ${index + 1}`}
                          className="w-full h-full object-contain rounded drop-shadow-xs"
                        />

                        {/* Loading Overlay when AI background removal is in progress */}
                        {imgItem.isProcessingBg && (
                          <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-2 text-center z-20">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span className="text-[11px] font-semibold text-primary">Removing BG...</span>
                          </div>
                        )}

                        {/* Top Action Badges */}
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
                          {index === 0 ? (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 font-bold shadow-xs">
                              ★ Cover Photo
                            </Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMakeCover(index)}
                              className="bg-background/90 hover:bg-background text-foreground text-[10px] px-1.5 py-0.5 rounded shadow-xs border opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-1"
                              title="Set as main cover image"
                            >
                              <Star className="w-3 h-3 text-amber-500" /> Make Cover
                            </button>
                          )}

                          {imgItem.isProcessed && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] px-1 py-0">
                              ✨ AI Studio Cut
                            </Badge>
                          )}
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 shadow-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110"
                          title="Remove this photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bottom Control Bar on Each Card */}
                      <div className="p-1.5 bg-card border-t flex items-center justify-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={imgItem.isProcessingBg}
                          onClick={() => handleRemoveBg(index)}
                          className="w-full text-xs h-7 px-2 font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center gap-1"
                          title="Remove background and convert to transparent studio PNG"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>{imgItem.isProcessed ? "Re-cut BG" : "Remove BG"}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                  <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground/40 mb-1" />
                  <p className="text-xs text-muted-foreground">All images removed. Please upload replacement images below.</p>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-muted/10"
                }`}
                onClick={() => document.getElementById("admin-studio-file-upload")?.click()}
              >
                <input
                  id="admin-studio-file-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Click or Drag & Drop replacement photos here</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Supports JPG, PNG, WEBP. You can strip backgrounds instantly after adding.
                </p>
              </div>
            </div>

            {/* Section 2: Listing Details Fixer */}
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold">Listing Details & Metadata Correction</Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fix-name" className="text-xs">Product Name</Label>
                  <Input
                    id="fix-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="e.g. Vintage Denim Jacket"
                    className="text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fix-price" className="text-xs">Price (GH₵)</Label>
                  <Input
                    id="fix-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    placeholder="150.00"
                    className="text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fix-cat" className="text-xs">Category</Label>
                  <Input
                    id="fix-cat"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    placeholder="e.g. Jackets & Coats"
                    className="text-sm h-9"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fix-desc" className="text-xs">Description</Label>
                  <Textarea
                    id="fix-desc"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    placeholder="Clear description of the product, quality, and sizing..."
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dialog Action Footer */}
          <div className="border-t px-6 py-3.5 flex items-center justify-between bg-muted/30 flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={closeFixStudio}
              disabled={saving}
              className="text-xs h-9"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSaveProduct(false)}
                disabled={saving}
                className="text-xs h-9"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save Changes Only
              </Button>

              <Button
                size="sm"
                onClick={() => handleSaveProduct(true)}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold shadow-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Processing & Publishing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Fix & Approve Listing
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
