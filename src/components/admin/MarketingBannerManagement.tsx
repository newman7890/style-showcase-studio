import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Upload, Eye, EyeOff, Image as ImageIcon, Loader2, ExternalLink, MousePointerClick, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MarketingBanner {
  id: string;
  title: string;
  badge: string;
  label: string;
  image_url: string;
  link_url: string;
  placement: "hero_carousel" | "deal_cards" | "promo_banner" | "shop_banner";
  click_count?: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const emptyForm = {
  title: "",
  badge: "",
  label: "",
  link_url: "/department/home",
  placement: "deal_cards" as MarketingBanner["placement"],
};

export const PLACEMENT_LABELS: Record<MarketingBanner["placement"], { name: string; desc: string; color: string }> = {
  hero_carousel: { name: "Hero Slider", desc: "Top hero carousel on homepage", color: "bg-blue-100 text-blue-800 border-blue-200" },
  deal_cards: { name: "Deal Cards", desc: "Deal of the Day section", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  promo_banner: { name: "Mid Promo Banner", desc: "Full-width banner in middle of homepage", color: "bg-purple-100 text-purple-800 border-purple-200" },
  shop_banner: { name: "Shop Top Banner", desc: "Featured banner at top of Shop page", color: "bg-amber-100 text-amber-800 border-amber-200" },
};

interface SimpleProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
}

export const MarketingBannerManagement = () => {
  const { toast } = useToast();
  const [banners, setBanners] = useState<MarketingBanner[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingBanner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState<string>("all");

  const fetchBannersAndProducts = async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const [bannerRes, prodRes] = await Promise.all([
        (supabase as any)
          .from("marketing_banners")
          .select("*")
          .order("display_order", { ascending: true }),
        supabase
          .from("products")
          .select("id, name, price, image, category")
          .order("name", { ascending: true })
      ]);

      if (bannerRes.error) {
        console.error("Error fetching banners:", bannerRes.error);
        if (bannerRes.error.message?.includes("marketing_banners") || bannerRes.error.code === "PGRST204" || bannerRes.error.code === "42P01") {
          setTableMissing(true);
        }
      } else {
        setBanners(bannerRes.data || []);
      }

      if (prodRes.data) {
        setProducts(prodRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBanners = fetchBannersAndProducts;

  useEffect(() => {
    fetchBanners();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setSelectedProductId("");
    setProductSearch("");
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
      placement: banner.placement || "deal_cards",
    });

    if (banner.link_url?.startsWith("/product/")) {
      const prodId = banner.link_url.replace("/product/", "");
      setSelectedProductId(prodId);
    } else {
      setSelectedProductId("");
    }

    setImagePreview(banner.image_url);
    setDialogOpen(true);
  };

  const handleSelectProduct = (prod: SimpleProduct) => {
    setSelectedProductId(prod.id);
    setForm((prev) => ({
      ...prev,
      link_url: `/product/${prod.id}`,
      title: prev.title.trim() === "" ? prod.name : prev.title,
    }));
    if (!imagePreview && prod.image) {
      setImagePreview(prod.image);
    }
    toast({
      title: "Product Linked",
      description: `Banner linked to "${prod.name}"`,
    });
  };

  const handleQuickLinkProduct = async (bannerId: string, productId: string) => {
    try {
      const linkUrl = productId ? `/product/${productId}` : "/department/home";
      const { error } = await (supabase as any)
        .from("marketing_banners")
        .update({ link_url: linkUrl })
        .eq("id", bannerId);

      if (error) throw error;
      const matched = products.find((p) => p.id === productId);
      toast({
        title: "Link Updated",
        description: matched ? `Linked to ${matched.name}` : "Link updated.",
      });
      fetchBannersAndProducts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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
      toast({ title: "Error", description: "Please select an ad banner image.", variant: "destructive" });
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
        link_url: form.link_url.trim() || "/department/home",
        placement: form.placement,
      };

      if (editing) {
        const { error } = await (supabase as any)
          .from("marketing_banners")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Ad Banner updated", description: "Marketing ad banner updated successfully." });
      } else {
        const nextOrder = banners.length > 0 ? Math.max(...banners.map((b) => b.display_order)) + 1 : 0;
        const { error } = await (supabase as any)
          .from("marketing_banners")
          .insert({ ...payload, display_order: nextOrder });
        if (error) throw error;
        toast({ title: "Ad Banner created", description: "New promotional ad banner added." });
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
        title: banner.is_active ? "Ad hidden" : "Ad visible",
        description: `"${banner.title}" is now ${banner.is_active ? "hidden" : "visible"}.`,
      });
      fetchBanners();
    }
  };

  const deleteBanner = async (banner: MarketingBanner) => {
    if (!confirm(`Delete ad "${banner.title}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any)
      .from("marketing_banners")
      .delete()
      .eq("id", banner.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Ad removed." });
      fetchBanners();
    }
  };

  const filteredBanners = banners.filter(
    (b) => activeTabFilter === "all" || b.placement === activeTabFilter
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-purple-600" />
            Homepage & Shop Ads Manager
          </h2>
          <p className="text-sm text-muted-foreground">
            Create, control, and monitor promotional ad banners across key areas of your website.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add New Ad Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Ad Banner" : "Create New Ad Banner"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="banner-title">Ad Title *</Label>
                <Input
                  id="banner-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Spring Sale 2026 / 40% Off Sneakers"
                />
              </div>

              <div>
                <Label htmlFor="banner-placement">Ad Placement / Position *</Label>
                <Select
                  value={form.placement}
                  onValueChange={(val: MarketingBanner["placement"]) => setForm({ ...form, placement: val })}
                >
                  <SelectTrigger id="banner-placement">
                    <SelectValue placeholder="Select placement position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero_carousel">Hero Slider (Top of Homepage)</SelectItem>
                    <SelectItem value="deal_cards">Deal of the Day Cards (Homepage)</SelectItem>
                    <SelectItem value="promo_banner">Mid-Page Full Banner (Homepage)</SelectItem>
                    <SelectItem value="shop_banner">Shop Page Featured Banner</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {PLACEMENT_LABELS[form.placement]?.desc}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="banner-badge">Badge Text <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    id="banner-badge"
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    placeholder="e.g. 50% OFF or SPONSORED"
                  />
                </div>
                <div>
                  <Label htmlFor="banner-label">Sub-Label <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    id="banner-label"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="e.g. Flash Deal"
                  />
                </div>
              </div>

              {/* Link to Exact Product Selector */}
              <div className="border border-purple-200 bg-purple-50/50 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-purple-600" />
                    Link to Exact Product (Recommended)
                  </Label>
                  {selectedProductId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId("");
                        setForm((prev) => ({ ...prev, link_url: "/department/home" }));
                      }}
                      className="text-[10px] text-purple-700 hover:text-purple-900 underline font-medium"
                    >
                      Clear Product Link
                    </button>
                  )}
                </div>

                {selectedProductId ? (
                  (() => {
                    const linkedProd = products.find((p) => p.id === selectedProductId);
                    return (
                      <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-purple-200 shadow-sm">
                        {linkedProd?.image ? (
                          <img
                            src={linkedProd.image}
                            alt={linkedProd.name}
                            className="w-12 h-12 object-cover rounded-md border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center text-xs text-muted-foreground">
                            No img
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {linkedProd?.name || "Selected Product"}
                          </p>
                          <p className="text-[11px] text-purple-700 font-semibold">
                            GH₵{linkedProd?.price?.toFixed(2) || "0.00"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            /product/{selectedProductId}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          Linked ✓
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Search store products to link..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-white rounded-lg border p-1">
                      {products
                        .filter(
                          (p) =>
                            !productSearch.trim() ||
                            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            p.category?.toLowerCase().includes(productSearch.toLowerCase())
                        )
                        .slice(0, 8)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProduct(p)}
                            className="w-full text-left flex items-center gap-2 p-1.5 rounded hover:bg-purple-50 transition-colors text-xs group"
                          >
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-7 h-7 object-cover rounded border shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 bg-gray-100 rounded border shrink-0" />
                            )}
                            <div className="flex-1 truncate">
                              <span className="font-medium text-gray-800 group-hover:text-purple-900 truncate block">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                GH₵{p.price?.toFixed(2)}
                              </span>
                            </div>
                            <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 font-bold">
                              Select
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="banner-link">Target Destination Link URL</Label>
                <Input
                  id="banner-link"
                  value={form.link_url}
                  onChange={(e) => {
                    setForm({ ...form, link_url: e.target.value });
                    if (!e.target.value.startsWith("/product/")) {
                      setSelectedProductId("");
                    }
                  }}
                  placeholder="/product/<id> or /department/home or /art"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground self-center mr-1">Quick links:</span>
                  {[
                    { label: "Main Shop", url: "/department/home" },
                    { label: "Fashion", url: "/department/fashion" },
                    { label: "Gadgets", url: "/department/gadgets" },
                    { label: "Art Gallery", url: "/art" },
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => {
                        setSelectedProductId("");
                        setForm({ ...form, link_url: preset.url });
                      }}
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
                    <ImageIcon className="w-4 h-4 text-purple-600" /> Ad Image {!editing && "*"}
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
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving Ad...</>
                ) : editing ? (
                  "Update Ad Banner"
                ) : (
                  "Create Ad Banner"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Placement Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTabFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            activeTabFilter === "all"
              ? "bg-black text-white border-black"
              : "bg-white text-gray-600 border-gray-200 hover:border-black"
          }`}
        >
          All Ads ({banners.length})
        </button>
        {Object.entries(PLACEMENT_LABELS).map(([key, info]) => {
          const count = banners.filter((b) => b.placement === key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveTabFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeTabFilter === key
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {info.name} ({count})
            </button>
          );
        })}
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
                  The <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs text-amber-900">marketing_banners</code> table has not been created yet in your Supabase project.
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
  link_url TEXT DEFAULT '/department/home',
  placement TEXT DEFAULT 'deal_cards',
  click_count INTEGER DEFAULT 0,
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
      ) : filteredBanners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No ad banners found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTabFilter === "all"
                ? "Click 'Add New Ad Banner' above to create your first promotional ad."
                : `No active ads created for placement "${PLACEMENT_LABELS[activeTabFilter as keyof typeof PLACEMENT_LABELS]?.name}".`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBanners.map((banner) => {
            const placementInfo = PLACEMENT_LABELS[banner.placement] || PLACEMENT_LABELS.deal_cards;
            return (
              <Card
                key={banner.id}
                className={`overflow-hidden transition-all border ${
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
                  <span className={`absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-md border backdrop-blur-sm ${placementInfo.color}`}>
                    {placementInfo.name}
                  </span>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate flex-1">{banner.title}</p>
                    {banner.click_count != null && (
                      <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-0.5 bg-gray-100 px-1.5 py-0.5 rounded">
                        <MousePointerClick className="w-3 h-3 text-purple-600" /> {banner.click_count} clicks
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {banner.link_url?.startsWith("/product/") ? (
                      (() => {
                        const pId = banner.link_url.replace("/product/", "");
                        const prod = products.find((p) => p.id === pId);
                        return (
                          <span className="font-semibold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded text-[11px] truncate">
                            🛍️ {prod?.name || `Product: ${pId}`}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="truncate">{banner.link_url}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
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
            );
          })}
        </div>
      )}
    </div>
  );
};
