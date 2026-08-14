import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Upload, GripVertical, Eye, EyeOff, Image as ImageIcon, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MarketingBanner {
  id: string;
  title: string;
  badge: string;
  label: string;
  image_url: string;
  link_url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const emptyForm = {
  title: "",
  badge: "",
  label: "",
  link_url: "/products",
};

export const MarketingBannerManagement = () => {
  const { toast } = useToast();
  const [banners, setBanners] = useState<MarketingBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingBanner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchBanners = async () => {
    setLoading(true);
    setTableMissing(false);
    const { data, error } = await (supabase as any)
      .from("marketing_banners")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) {
      console.error("Error fetching banners:", error);
      if (error.message?.includes("marketing_banners") || error.code === "PGRST204" || error.code === "42P01") {
        setTableMissing(true);
      }
    } else {
      setBanners(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
  };

  const openEdit = (banner: MarketingBanner) => {
    setEditing(banner);
    setForm({
      title: banner.title,
      badge: banner.badge,
      label: banner.label,
      link_url: banner.link_url,
    });
    setImagePreview(banner.image_url);
    setDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    if (!editing && !imageFile) {
      toast({ title: "Error", description: "Please select a banner image.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = editing?.image_url || "";

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `marketing/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile);
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        title: form.title.trim(),
        badge: form.badge.trim(),
        label: form.label.trim(),
        image_url: imageUrl,
        link_url: form.link_url.trim() || "/products",
      };

      if (editing) {
        const { error } = await (supabase as any)
          .from("marketing_banners")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Banner updated", description: "Marketing banner updated successfully." });
      } else {
        const nextOrder = banners.length > 0 ? Math.max(...banners.map((b) => b.display_order)) + 1 : 0;
        const { error } = await (supabase as any)
          .from("marketing_banners")
          .insert({ ...payload, display_order: nextOrder });
        if (error) throw error;
        toast({ title: "Banner created", description: "New marketing banner added." });
      }

      setDialogOpen(false);
      resetForm();
      fetchBanners();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (banner: MarketingBanner) => {
    const { error } = await (supabase as any)
      .from("marketing_banners")
      .update({ is_active: !banner.is_active })
      .eq("id", banner.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: banner.is_active ? "Banner hidden" : "Banner visible",
        description: `"${banner.title}" is now ${banner.is_active ? "hidden" : "visible"} on the homepage.`,
      });
      fetchBanners();
    }
  };

  const deleteBanner = async (banner: MarketingBanner) => {
    if (!confirm(`Delete banner "${banner.title}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any)
      .from("marketing_banners")
      .delete()
      .eq("id", banner.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Banner removed." });
      fetchBanners();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Marketing Banners</h2>
          <p className="text-sm text-muted-foreground">
            Upload promotional images that appear in the "Deal of the Day" section on the homepage.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Banner" : "New Marketing Banner"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="banner-title">Title *</Label>
                <Input
                  id="banner-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Pro Audio Noise-Canceling Headphones"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="banner-badge">Badge Text <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    id="banner-badge"
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    placeholder="e.g. Up to 40% off"
                  />
                </div>
                <div>
                  <Label htmlFor="banner-label">Label <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    id="banner-label"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="e.g. Prime Deal"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="banner-link">Link URL</Label>
                <Input
                  id="banner-link"
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="/art or /products or /department/fashion"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground self-center mr-1">Quick presets:</span>
                  {[
                    { label: "Art Gallery", url: "/art" },
                    { label: "All Products", url: "/products" },
                    { label: "Gadgets", url: "/department/gadgets" },
                    { label: "Fashion", url: "/department/fashion" },
                    { label: "Home", url: "/department/home" },
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setForm({ ...form, link_url: preset.url })}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        form.link_url === preset.url
                          ? "bg-purple-100 border-purple-300 text-purple-800 font-semibold"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Upload */}
              <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <Label htmlFor="banner-image" className="font-semibold text-sm flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" /> Banner Image {!editing && "*"}
                  </Label>
                  <Label
                    htmlFor="banner-image"
                    className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" /> Select Image
                  </Label>
                  <Input
                    id="banner-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
                {imagePreview && (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                    <img
                      src={imagePreview}
                      alt="Banner preview"
                      className="w-full h-40 object-cover"
                    />
                  </div>
                )}
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : editing ? (
                  "Update Banner"
                ) : (
                  "Create Banner"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tableMissing ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-amber-900">Database Table Setup Required</h3>
                <p className="text-sm text-amber-800">
                  The <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs text-amber-900">marketing_banners</code> table has not been created yet in your Supabase project. The website is currently displaying the fallback default deals.
                </p>
              </div>
            </div>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto space-y-1">
              <p className="text-gray-400">-- Run this in your Supabase Dashboard SQL Editor:</p>
              <pre>{`CREATE TABLE IF NOT EXISTS public.marketing_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '/products',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marketing_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active marketing banners"
  ON public.marketing_banners FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage marketing banners"
  ON public.marketing_banners FOR ALL USING (public.has_role(auth.uid(), 'admin'));`}</pre>
            </div>
          </CardContent>
        </Card>
      ) : banners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No marketing banners yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload promotional images to feature on your homepage "Deal of the Day" section.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((banner) => (
            <Card
              key={banner.id}
              className={`overflow-hidden transition-all ${
                !banner.is_active ? "opacity-50 grayscale" : ""
              }`}
            >
              <div className="relative h-40 bg-secondary/50 overflow-hidden">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
                {!banner.is_active && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white font-bold text-sm bg-black/60 px-3 py-1 rounded-full">
                      Hidden
                    </span>
                  </div>
                )}
                {banner.badge && (
                  <span className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                    {banner.badge}
                  </span>
                )}
                {banner.label && (
                  <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {banner.label}
                  </span>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-semibold text-sm truncate">{banner.title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> {banner.link_url}
                </p>
                <div className="flex items-center gap-1.5 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(banner)}
                    className="h-7 text-xs flex-1"
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(banner)}
                    className="h-7 text-xs"
                  >
                    {banner.is_active ? (
                      <><EyeOff className="w-3 h-3 mr-1" /> Hide</>
                    ) : (
                      <><Eye className="w-3 h-3 mr-1" /> Show</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteBanner(banner)}
                    className="h-7 text-xs text-destructive hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
