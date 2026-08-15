import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Plus, Pencil, Trash2, Package, DollarSign, ShoppingBag, Clock, CheckCircle2, XCircle, Loader2, Wand2, Sparkles, Palette, Star, Upload, Image as ImageIcon } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const productSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  price: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Valid price required"),
  category: z.string().trim().min(1, "Category required").max(50),
  stock: z.string().refine((v) => !isNaN(parseInt(v)) && parseInt(v) >= 0, "Valid stock required"),
});

const DEPARTMENTS = [
  { value: "fashion", label: "Fashion" },
  { value: "gadgets", label: "Gadgets" },
  { value: "home", label: "Home & Living" },
  { value: "art", label: "Art & Collectibles" },
  { value: "other", label: "Other" },
];

const CATEGORIES_BY_DEPARTMENT: Record<string, { value: string; label: string }[]> = {
  fashion: [
    { value: "mens-clothing", label: "Men's Clothing" },
    { value: "womens-clothing", label: "Women's Clothing" },
    { value: "shoes-sneakers", label: "Shoes & Sneakers" },
    { value: "bags-accessories", label: "Bags & Accessories" },
    { value: "watches-jewelry", label: "Watches & Jewelry" },
  ],
  gadgets: [
    { value: "phones-tablets", label: "Phones & Tablets" },
    { value: "audio-headphones", label: "Audio & Headphones" },
    { value: "wearables", label: "Wearables" },
    { value: "gadget-accessories", label: "Accessories" },
    { value: "smart-home", label: "Smart Home" },
  ],
  home: [
    { value: "kitchen-dining", label: "Kitchen & Dining" },
    { value: "bedroom-bedding", label: "Bedroom & Bedding" },
    { value: "living-room", label: "Living Room" },
    { value: "bathroom", label: "Bathroom" },
    { value: "home-decor", label: "Home Decor" },
    { value: "storage-organization", label: "Storage & Organization" },
  ],
  art: [
    { value: "paintings", label: "Paintings" },
    { value: "digital-art", label: "Digital Art" },
    { value: "sculptures", label: "Sculptures" },
    { value: "photography", label: "Photography" },
    { value: "handcrafts", label: "Handcrafts" },
  ],
  other: [
    { value: "books-stationery", label: "Books & Stationery" },
    { value: "sports-outdoors", label: "Sports & Outdoors" },
    { value: "toys-games", label: "Toys & Games" },
    { value: "health-beauty", label: "Health & Beauty" },
    { value: "groceries", label: "Groceries" },
  ],
};

interface ProductImageItem {
  id: string;
  file?: File | null;
  url: string;
  processingBg?: boolean;
}

interface ColorVariant {
  name: string;
  hex: string;
  image: string | null;
  stock: number;
}

interface ColorRow extends ColorVariant {
  file?: File | null;
  processingBg?: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  images?: string[] | null;
  category: string;
  department: string | null;
  stock: number;
  low_stock_threshold: number;
  description: string | null;
  features?: string[] | null;
  materials_info?: string | null;
  size_fit_info?: string | null;
  shipping_returns_info?: string | null;
  status: "pending" | "approved" | "rejected" | "hidden";
  rejection_reason: string | null;
  created_at: string;
  colors?: ColorVariant[] | null;
  sizes?: string[] | null;
}

const emptyForm = {
  name: "",
  price: "",
  category: "",
  department: "fashion",
  stock: "0",
  low_stock_threshold: "5",
  description: "",
  sizes: "",
  features: "",
  materials_info: "",
  size_fit_info: "",
  shipping_returns_info: "",
};

const StatusBadge = ({ status }: { status: Product["status"] }) => {
  if (status === "approved") return <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" />Live</Badge>;
  if (status === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pending review</Badge>;
  if (status === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
  return <Badge variant="outline">Hidden</Badge>;
};

const SellerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dropoffs, setDropoffs] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [galleryImages, setGalleryImages] = useState<ProductImageItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [colors, setColors] = useState<ColorRow[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Drop-off scheduling state
  const [dropoffModalOpen, setDropoffModalOpen] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState("");
  const [submittingDropoff, setSubmittingDropoff] = useState(false);

  const handleMultipleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryImages((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            url: reader.result as string,
            processingBg: false,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  const setPrimaryImage = (index: number) => {
    setGalleryImages((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const copy = [...prev];
      const [selected] = copy.splice(index, 1);
      return [selected, ...copy];
    });
  };

  const handleRemoveGalleryBackground = async (index: number) => {
    const item = galleryImages[index];
    const source = item.file || item.url;
    if (!source) return;

    setGalleryImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, processingBg: true } : img))
    );

    toast({
      title: "AI Enhancing Image...",
      description: `Removing background for photo #${index + 1}. Please wait...`,
    });

    try {
      const imgly = await import("@imgly/background-removal");
      const removeBgFn = imgly.removeBackground || (imgly as any).default;
      if (typeof removeBgFn !== "function") {
        throw new Error("Background removal function could not be loaded.");
      }
      const blob = await removeBgFn(source);
      const newFile = new File([blob], `studio-photo-${index}.png`, { type: "image/png" });
      const url = URL.createObjectURL(blob);

      setGalleryImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, file: newFile, url, processingBg: false } : img))
      );

      toast({
        title: "Studio Image Ready!",
        description: "Background successfully removed for this photo.",
      });
    } catch (err: any) {
      console.error("Background removal error:", err);
      const isFetchError = err?.message?.includes("Failed to fetch") || err?.name === "TypeError";
      toast({
        title: isFetchError ? "Internet Connection Required" : "Processing Error",
        description: isFetchError
          ? "Unable to download AI background removal models. Please check your internet connection and try again."
          : (err.message || "Failed to remove background."),
        variant: "destructive",
      });
      setGalleryImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, processingBg: false } : img))
      );
    }
  };

  const handleAiAutoFill = async () => {
    if (!form.name || !form.category) {
      toast({
        title: "Missing Information",
        description: "Please enter a product name and category first.",
        variant: "destructive",
      });
      return;
    }
    setIsAiLoading(true);
    try {
      const prompt = `Please act as a professional e-commerce product detail generator. Ignore your usual customer service role.
Given the product name "${form.name}" and category "${form.category}", generate the product details.
You MUST output ONLY a valid JSON object with EXACTLY these keys:
- "description": A short, engaging product description (50-100 words).
- "sizes": A comma-separated string of typical sizes (e.g., "S, M, L, XL"). If not applicable, return an empty string.
- "features": A string with 3-4 bullet points highlighting key features, separated by newlines.
- "materials_info": A short description of typical materials and care (e.g., "Composition: 100% Cotton\\nMachine wash cold").
- "size_fit_info": A short sentence on size and fit (e.g., "Fit: true to size.").

Do not include markdown blocks like \`\`\`json. Just the raw JSON object.`;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      
      if (data && data.message) {
        let content = data.message;
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
          const parsed = JSON.parse(content);
          setForm({
            ...form,
            description: parsed.description || form.description,
            sizes: parsed.sizes || form.sizes,
            features: parsed.features || form.features,
            materials_info: parsed.materials_info || form.materials_info,
            size_fit_info: parsed.size_fit_info || form.size_fit_info,
          });
          toast({ title: "Success", description: "Product details generated successfully!" });
        } catch (e) {
          console.error("Failed to parse JSON:", content);
          throw new Error("Failed to parse the AI response.");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate details",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const addColor = () =>
    setColors((prev) => [...prev, { name: "", hex: "#000000", image: null, stock: 0, file: null }]);

  const updateColor = (index: number, field: keyof ColorRow, value: any) =>
    setColors((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  const removeColor = (index: number) => setColors((prev) => prev.filter((_, i) => i !== index));

  const handleColorImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateColor(index, "file", file);
    const reader = new FileReader();
    reader.onloadend = () => updateColor(index, "image", reader.result as string);
    reader.readAsDataURL(file);
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [p, oi, s, hubsRes, dropoffsRes] = await Promise.all([
      supabase.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("order_items")
        .select("id, quantity, unit_price, seller_earnings, commission_amount, created_at, order_id, product_id, products(name)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("get_seller_earnings_summary", { _seller_id: user.id }),
      supabase.from("hubs").select("*").eq("is_active", true),
      supabase.from("seller_dropoffs").select("*, hubs(name)").eq("seller_id", user.id).order("created_at", { ascending: false })
    ]);
    setProducts((p.data as any) ?? []);
    setOrderItems((oi.data as any) ?? []);
    setSummary(Array.isArray(s.data) ? s.data[0] : s.data);
    setHubs((hubsRes.data as any) ?? []);
    setDropoffs((dropoffsRes.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleScheduleDropoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHubId) {
      toast({ title: "Select a Hub", description: "Please choose a fulfillment hub for your drop-off.", variant: "destructive" });
      return;
    }
    if (!user) return;

    setSubmittingDropoff(true);
    try {
      const { error } = await supabase.from("seller_dropoffs").insert({
        seller_id: user.id,
        hub_id: selectedHubId,
        status: "pending",
      });
      if (error) throw error;
      toast({
        title: "Drop-off Scheduled!",
        description: "Your drop-off request has been submitted. Bring your items to the hub for verification.",
      });
      setDropoffModalOpen(false);
      setSelectedHubId("");
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to schedule drop-off.", variant: "destructive" });
    } finally {
      setSubmittingDropoff(false);
    }
  };

  // Auto-save form draft to localStorage when creating a new product
  useEffect(() => {
    if (!editing && (form.name || form.price || form.description || form.category || galleryImages.length > 0)) {
      localStorage.setItem("seller_product_draft", JSON.stringify({ form }));
    }
  }, [form, galleryImages, editing]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setGalleryImages([]);
    setColors([]);
    localStorage.removeItem("seller_product_draft");
  };

  const handleOpenAddDialog = () => {
    setEditing(null);
    setForm(emptyForm);
    setGalleryImages([]);
    setColors([]);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      price: String(p.price),
      category: p.category,
      department: p.department ?? "fashion",
      stock: String(p.stock),
      low_stock_threshold: String(p.low_stock_threshold),
      description: p.description ?? "",
      sizes: (p.sizes ?? []).join(", "),
      features: (p.features ?? []).join("\n"),
      materials_info: p.materials_info ?? "",
      size_fit_info: p.size_fit_info ?? "",
      shipping_returns_info: p.shipping_returns_info ?? "",
    });

    const existingImages = p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [];
    setGalleryImages(
      existingImages.map((imgUrl, i) => ({
        id: `existing-${i}-${Date.now()}`,
        url: imgUrl,
        file: null,
      }))
    );

    setColors(
      (p.colors ?? []).map((c) => ({
        name: c.name,
        hex: c.hex,
        image: c.image,
        stock: Number(c.stock ?? 0),
        file: null,
      }))
    );
    setDialogOpen(true);
  };



  const handleRemoveColorBackground = async (index: number) => {
    const color = colors[index];
    const source = color.file || color.image;
    if (!source) return;
    updateColor(index, "processingBg", true);
    toast({
      title: "AI Enhancing Image...",
      description: `Removing background for color "${color.name || 'variant'}". Please wait...`,
    });
    try {
      const imgly = await import("@imgly/background-removal");
      const removeBgFn = imgly.removeBackground || (imgly as any).default;
      if (typeof removeBgFn !== "function") {
        throw new Error("Background removal function could not be loaded.");
      }
      const blob = await removeBgFn(source);
      const newFile = new File([blob], `color-${index}.png`, { type: "image/png" });
      const url = URL.createObjectURL(blob);
      setColors((prev) =>
        prev.map((c, i) => (i === index ? { ...c, file: newFile, image: url } : c))
      );
      toast({
        title: "Studio Image Ready!",
        description: "Background successfully removed for this color.",
      });
    } catch (err: any) {
      console.error("Background removal error for color:", err);
      const isFetchError = err?.message?.includes("Failed to fetch") || err?.name === "TypeError";
      toast({
        title: isFetchError ? "Internet Connection Required" : "Processing Error",
        description: isFetchError
          ? "Unable to download AI background removal models. Please check your internet connection and try again."
          : (err.message || "Failed to remove background."),
        variant: "destructive",
      });
    } finally {
      updateColor(index, "processingBg", false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((er) => {
        if (er.path[0]) errs[er.path[0] as string] = er.message;
      });
      setErrors(errs);
      return;
    }
    if (!user) return;

    const hasColorImage = colors.some((c) => c.file || c.image);
    if (!editing && galleryImages.length === 0 && !hasColorImage) {
      setErrors({ image: "At least one product photo or colour variant photo is required." });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload all gallery photos
      const uploadedGalleryUrls: string[] = [];
      for (let i = 0; i < galleryImages.length; i++) {
        const item = galleryImages[i];
        if (item.file) {
          const ext = item.file.name.split(".").pop();
          const path = `${user.id}/${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`;
          const up = await supabase.storage.from("product-images").upload(path, item.file);
          if (up.error) throw up.error;
          const pubUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
          uploadedGalleryUrls.push(pubUrl);
        } else if (item.url && !item.url.startsWith("data:")) {
          uploadedGalleryUrls.push(item.url);
        }
      }

      // 2. Upload per-color variant images
      const finalColors: ColorVariant[] = [];
      for (const c of colors) {
        if (!c.name.trim()) continue;
        let colorImage = c.image;
        if (c.file) {
          const cExt = c.file.name.split(".").pop();
          const cPath = `${user.id}/color-${Date.now()}-${Math.random().toString(36).slice(2)}.${cExt}`;
          const cUp = await supabase.storage.from("product-images").upload(cPath, c.file);
          if (cUp.error) throw cUp.error;
          colorImage = supabase.storage.from("product-images").getPublicUrl(cPath).data.publicUrl;
        }
        finalColors.push({
          name: c.name.trim(),
          hex: c.hex,
          image: colorImage,
          stock: Math.max(0, Number(c.stock) || 0),
        });
      }

      let primaryUrl = uploadedGalleryUrls[0] || editing?.image || "";
      if (!primaryUrl && finalColors.length > 0) {
        const firstColorWithImg = finalColors.find((c) => c.image);
        if (firstColorWithImg) primaryUrl = firstColorWithImg.image as string;
      }

      if (!primaryUrl) {
        throw new Error("A product image is required. Please upload at least one photo.");
      }

      const allImages = Array.from(
        new Set([primaryUrl, ...uploadedGalleryUrls, ...finalColors.map((c) => c.image).filter(Boolean) as string[]])
      );

      const totalStock = finalColors.length
        ? finalColors.reduce((sum, c) => sum + c.stock, 0)
        : parseInt(form.stock);

      const payload = {
        name: form.name,
        price: parseFloat(form.price),
        image: primaryUrl,
        images: allImages,
        category: form.category,
        department: form.department,
        stock: totalStock,
        low_stock_threshold: parseInt(form.low_stock_threshold),
        description: form.description || null,
        colors: finalColors as any,
        sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
        features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
        materials_info: form.materials_info || null,
        size_fit_info: form.size_fit_info || null,
        shipping_returns_info: form.shipping_returns_info || null,
      };

      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({
          title: "Product updated",
          description: "Price/name/image changes submitted for review.",
        });
      } else {
        const { error } = await supabase
          .from("products")
          .insert({ ...payload, seller_id: user.id });
        if (error) throw error;
        toast({ title: "Product submitted", description: "Awaiting admin approval." });
      }
      localStorage.removeItem("seller_product_draft");
      setDialogOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    load();
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl md:text-3xl font-semibold mb-6"
          >
            Seller Dashboard
          </motion.h1>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Total sales</div>
                <div className="text-2xl font-semibold">
                  GH₵{Number(summary?.total_gross ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Your earnings</div>
                <div className="text-2xl font-semibold">
                  GH₵{Number(summary?.total_earnings ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Pending payout</div>
                <div className="text-2xl font-semibold">
                  GH₵{Number(summary?.pending_earnings ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Orders</div>
                <div className="text-2xl font-semibold">{Number(summary?.total_orders ?? 0)}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="space-y-6">
            <TabsList>
              <TabsTrigger value="products"><Package className="w-4 h-4 mr-2" />Products</TabsTrigger>
              <TabsTrigger value="orders"><ShoppingBag className="w-4 h-4 mr-2" />Orders</TabsTrigger>
              <TabsTrigger value="earnings"><DollarSign className="w-4 h-4 mr-2" />Earnings</TabsTrigger>
              <TabsTrigger value="dropoffs"><Package className="w-4 h-4 mr-2" />Drop-offs</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-muted-foreground">
                  {products.length} product{products.length === 1 ? "" : "s"}
                </div>
                <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o && editing) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button onClick={handleOpenAddDialog}><Plus className="w-4 h-4 mr-2" />Add product</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submit} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                      </div>
                      {/* Multiple Product Images Gallery */}
                      <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-gray-50/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="multiple-images" className="font-semibold text-sm flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-purple-600" /> Product Photos ({galleryImages.length})
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Select multiple photos. The first image will be your main cover photo.
                            </p>
                          </div>
                          <Label
                            htmlFor="multiple-images"
                            className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Upload className="w-3.5 h-3.5" /> Select Photos
                          </Label>
                          <Input
                            id="multiple-images"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleMultipleImages}
                            className="hidden"
                          />
                        </div>

                        {galleryImages.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                            {galleryImages.map((img, idx) => (
                              <div
                                key={img.id || idx}
                                className={`relative group rounded-xl overflow-hidden border bg-white shadow-sm flex flex-col items-center ${
                                  idx === 0 ? "border-purple-500 ring-2 ring-purple-500/20" : "border-gray-200"
                                }`}
                              >
                                <div className="relative w-full h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
                                  <img src={img.url} alt={`preview-${idx}`} className="w-full h-full object-contain p-1" />
                                  {img.processingBg && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-xs gap-1 text-center font-medium p-1">
                                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                                      <span className="text-[10px]">AI Removing BG...</span>
                                    </div>
                                  )}
                                  {idx === 0 && (
                                    <span className="absolute top-1.5 left-1.5 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                                      Main Cover
                                    </span>
                                  )}
                                </div>

                                <div className="w-full p-1 bg-gray-50 border-t flex items-center justify-between gap-1">
                                  {idx !== 0 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setPrimaryImage(idx)}
                                      className="h-7 text-[10px] px-1.5 font-medium text-purple-700 hover:bg-purple-50"
                                      title="Set as Main Cover Photo"
                                    >
                                      <Star className="w-3 h-3 mr-0.5 fill-purple-600" /> Main
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={img.processingBg}
                                    onClick={() => handleRemoveGalleryBackground(idx)}
                                    className="h-7 text-[10px] px-1.5 font-medium text-purple-700 hover:bg-purple-50"
                                    title="Remove Background with AI"
                                  >
                                    <Wand2 className="w-3 h-3 mr-0.5 text-purple-600" /> AI BG
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeGalleryImage(idx)}
                                    className="h-7 text-[10px] px-1.5 font-medium text-destructive hover:bg-red-50"
                                    title="Delete Photo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {errors.image && <p className="text-sm text-destructive">{errors.image}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="price">Price (GH₵)</Label>
                          <Input id="price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                          {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
                        </div>
                        <div>
                          <Label htmlFor="stock">Stock</Label>
                          <Input
                            id="stock"
                            type="number"
                            disabled={colors.length > 0}
                            value={colors.length > 0 ? String(colors.reduce((s, c) => s + (Number(c.stock) || 0), 0)) : form.stock}
                            onChange={(e) => setForm({ ...form, stock: e.target.value })}
                          />
                          {colors.length > 0 ? (
                            <p className="text-xs text-muted-foreground mt-1">Auto-calculated from your colour stock</p>
                          ) : (
                            errors.stock && <p className="text-sm text-destructive">{errors.stock}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="department">Department</Label>
                          <Select 
                            value={form.department || "fashion"} 
                            onValueChange={(v) => {
                              const availCats = CATEGORIES_BY_DEPARTMENT[v] || [];
                              setForm({ 
                                ...form, 
                                department: v,
                                category: availCats[0]?.value || ""
                              });
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((d) => (
                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Select 
                            value={form.category} 
                            onValueChange={(v) => setForm({ ...form, category: v })}
                          >
                            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              {(CATEGORIES_BY_DEPARTMENT[form.department || "fashion"] || []).map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                              {form.category && !(CATEGORIES_BY_DEPARTMENT[form.department || "fashion"] || []).some(c => c.value === form.category) && (
                                <SelectItem value={form.category}>{form.category}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="description">Description</Label>
                          <Button 
                            type="button" 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleAiAutoFill}
                            disabled={isAiLoading || !form.name || !form.category}
                            className="h-8 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200"
                          >
                            {isAiLoading ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Auto-fill details with AI
                          </Button>
                        </div>
                        <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                      </div>
                      
                      <div className="border-t pt-4">
                        <Label htmlFor="sizes" className="flex items-center gap-2">Sizes (optional)</Label>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">
                          Enter available sizes separated by commas (e.g., S, M, L, XL or 38, 40, 42).
                        </p>
                        <Input 
                          id="sizes" 
                          placeholder="S, M, L, XL" 
                          value={form.sizes} 
                          onChange={(e) => setForm({ ...form, sizes: e.target.value })} 
                        />
                      </div>

                      <div className="border-t pt-4 space-y-4">
                        <div>
                          <Label htmlFor="features">Key highlights (optional)</Label>
                          <p className="text-xs text-muted-foreground mt-1 mb-2">One per line — shown as bullet points under Details.</p>
                          <Textarea id="features" rows={4} placeholder={"Oversized fit\nSoft & heavyweight fabric\nUnisex style"} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
                        </div>
                        <div>
                          <Label htmlFor="materials_info">Materials & care (optional)</Label>
                          <Textarea id="materials_info" rows={4} placeholder={"Composition: 100% cotton\nWeight: 450gsm\nMachine wash cold"} value={form.materials_info} onChange={(e) => setForm({ ...form, materials_info: e.target.value })} />
                        </div>
                        <div>
                          <Label htmlFor="size_fit_info">Size & fit (optional)</Label>
                          <Textarea id="size_fit_info" rows={3} placeholder="Fit: true to size. Model is 185cm wearing Large." value={form.size_fit_info} onChange={(e) => setForm({ ...form, size_fit_info: e.target.value })} />
                        </div>

                      </div>



                      {/* Colour variants */}
                      <div className="border-t pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="flex items-center gap-2"><Palette className="w-4 h-4" /> Colours (optional)</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Add a photo and stock for each colour. Customers can switch between them.
                            </p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={addColor}>
                            <Plus className="w-3 h-3 mr-1" /> Add colour
                          </Button>
                        </div>

                        {colors.map((c, i) => (
                          <div key={i} className="relative border rounded-lg p-3 space-y-3">
                            <button
                              type="button"
                              onClick={() => removeColor(i)}
                              className="absolute top-2 right-2 text-destructive"
                              aria-label="Remove colour"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="grid grid-cols-2 gap-3 mr-6">
                              <div>
                                <Label>Colour name</Label>
                                <Input
                                  placeholder="e.g. Navy Blue"
                                  value={c.name}
                                  onChange={(e) => updateColor(i, "name", e.target.value)}
                                />
                              </div>
                              <div>
                                <Label>Stock</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={c.stock}
                                  onChange={(e) => updateColor(i, "stock", e.target.value === "" ? 0 : parseInt(e.target.value))}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Swatch colour</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="color"
                                    value={c.hex}
                                    onChange={(e) => updateColor(i, "hex", e.target.value)}
                                    className="w-12 h-10 p-1 cursor-pointer"
                                  />
                                  <Input value={c.hex} onChange={(e) => updateColor(i, "hex", e.target.value)} className="flex-1" />
                                </div>
                              </div>
                              <div>
                                <Label>Photo for this colour</Label>
                                <div className="space-y-2 mt-1">
                                  <div className="flex items-center gap-2">
                                    {c.image && (
                                      <div className="relative w-10 h-10 flex-shrink-0">
                                        <img src={c.image} alt={c.name} className="w-full h-full rounded border object-cover" />
                                        {c.processingBg && (
                                          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center">
                                            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    <Input type="file" accept="image/*" onChange={(e) => handleColorImage(i, e)} className="flex-1" />
                                  </div>
                                  {(c.file || c.image) && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={c.processingBg}
                                      onClick={() => handleRemoveColorBackground(i)}
                                      className="w-full gap-2 text-xs font-semibold border-purple-200 hover:bg-purple-50 text-purple-700 h-8"
                                    >
                                      {c.processingBg ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          Processing...
                                        </>
                                      ) : (
                                        <>
                                          <Wand2 className="w-3 h-3 text-purple-600" />
                                          Remove Background (AI)
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Saving..." : editing ? "Update" : "Submit for review"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : products.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No products yet. Add your first one.</CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {products.map((p) => (
                    <Card key={p.id}>
                      <CardContent className="pt-4 flex gap-3 items-center">
                        <img src={p.image} alt={p.name} className="w-16 h-16 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-sm text-muted-foreground">
                            GH₵{Number(p.price).toFixed(2)} · Stock {p.stock}
                          </div>
                          <div className="flex gap-2 mt-1"><StatusBadge status={p.status} /></div>
                          {p.status === "rejected" && p.rejection_reason && (
                            <div className="text-xs text-destructive mt-1">{p.rejection_reason}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => remove(p.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : orderItems.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No sales yet.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((oi) => (
                    <Card key={oi.id}>
                      <CardContent className="pt-4 flex justify-between items-center">
                        <div>
                          <div className="font-medium">{oi.products?.name ?? "Product"}</div>
                          <div className="text-xs text-muted-foreground">
                            Qty {oi.quantity} · {new Date(oi.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">GH₵{Number(oi.seller_earnings ?? 0).toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">
                            fee GH₵{Number(oi.commission_amount ?? 0).toFixed(2)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="earnings">
              <Card>
                <CardHeader><CardTitle>Payout summary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Gross sales</span><span>GH₵{Number(summary?.total_gross ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Platform commission</span><span>-GH₵{Number(summary?.total_commission ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-2"><span>Your earnings</span><span>GH₵{Number(summary?.total_earnings ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Paid out</span><span>GH₵{Number(summary?.paid_earnings ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Pending payout</span><span>GH₵{Number(summary?.pending_earnings ?? 0).toFixed(2)}</span></div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground mt-4">
                Payouts are processed by the platform. Automated Paystack split payouts are coming soon.
              </p>
            </TabsContent>

            <TabsContent value="dropoffs">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-muted-foreground">
                  {dropoffs.length} drop-off request{dropoffs.length === 1 ? "" : "s"}
                </div>
                <Dialog open={dropoffModalOpen} onOpenChange={setDropoffModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setDropoffModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />Schedule Drop-off
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Schedule Item Drop-off</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleScheduleDropoff} className="space-y-4 pt-2">
                      <div>
                        <Label htmlFor="dropoff-hub">Select Fulfillment Hub *</Label>
                        <Select
                          value={selectedHubId}
                          onValueChange={setSelectedHubId}
                        >
                          <SelectTrigger id="dropoff-hub" className="mt-1">
                            <SelectValue placeholder="Choose a hub..." />
                          </SelectTrigger>
                          <SelectContent>
                            {hubs.length === 0 ? (
                              <SelectItem value="none" disabled>No active hubs found</SelectItem>
                            ) : (
                              hubs.map((hub) => (
                                <SelectItem key={hub.id} value={hub.id}>
                                  {hub.name} ({hub.region})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedHubId && (() => {
                        const hubObj = hubs.find((h) => h.id === selectedHubId);
                        if (!hubObj) return null;
                        return (
                          <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1 text-gray-600 border">
                            <div className="font-semibold text-gray-900">{hubObj.name}</div>
                            <div>Address: {hubObj.address}</div>
                            {hubObj.contact_phone && <div>Phone: {hubObj.contact_phone}</div>}
                          </div>
                        );
                      })()}

                      <Button type="submit" disabled={submittingDropoff || !selectedHubId} className="w-full">
                        {submittingDropoff ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
                        ) : (
                          "Confirm Schedule Drop-off"
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : dropoffs.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No drop-off requests yet. Click "Schedule Drop-off" above to request an inventory drop-off.</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {dropoffs.map((d) => (
                    <Card key={d.id}>
                      <CardContent className="pt-4 flex justify-between items-center">
                        <div>
                          <div className="font-medium">Drop-off to {d.hubs?.name || "Hub"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(d.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <StatusBadge status={d.status} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default SellerDashboard;
