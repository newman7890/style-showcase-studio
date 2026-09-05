import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Plus, Pencil, Trash2, Package, DollarSign, ShoppingBag, Clock, CheckCircle2, XCircle, Loader2, Wand2, Sparkles, Palette, Star, Upload, Image as ImageIcon, MapPin, ExternalLink, Mail, Phone, Building2, Info, Truck, Navigation, KeyRound, ShieldCheck, Camera } from "lucide-react";
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
import { PRESET_CATEGORIES_BY_DEPARTMENT } from "@/constants/categories";
import { processAiBackgroundRemoval } from "@/utils/imageStudio";
import { CategoryCombobox } from "@/components/common/CategoryCombobox";

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
  fashion: PRESET_CATEGORIES_BY_DEPARTMENT.fashion.map((c) => ({ value: c.name, label: c.name })),
  gadgets: PRESET_CATEGORIES_BY_DEPARTMENT.gadgets.map((c) => ({ value: c.name, label: c.name })),
  art: PRESET_CATEGORIES_BY_DEPARTMENT.art.map((c) => ({ value: c.name, label: c.name })),
  other: PRESET_CATEGORIES_BY_DEPARTMENT.other.map((c) => ({ value: c.name, label: c.name })),
  home: PRESET_CATEGORIES_BY_DEPARTMENT.home.map((c) => ({ value: c.name, label: c.name })),
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

  // Seller fulfillment profile state
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [savingFulfillment, setSavingFulfillment] = useState(false);
  const [fulfillmentForm, setFulfillmentForm] = useState({
    fulfillment_model: "direct_pickup",
    pickup_address: "",
    pickup_landmark: "",
    pickup_phone: "",
    pickup_latitude: null as number | null,
    pickup_longitude: null as number | null,
  });
  const [detectingGps, setDetectingGps] = useState(false);

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
      title: "AI Studio Processing... ✨",
      description: `Optimizing photo #${index + 1} and preparing background removal...`,
    });

    try {
      const result = await processAiBackgroundRemoval(
        source,
        `seller-photo-${index}`,
        {
          maxDimension: 1024,
        }
      );

      setGalleryImages((prev) =>
        prev.map((img, i) =>
          i === index
            ? { ...img, file: result.file, url: result.previewUrl, processingBg: false }
            : img
        )
      );

      if (result.isFallback) {
        toast({
          title: "Photo Optimized ✨",
          description: "Photo formatted for studio display. (AI background removal was skipped because model servers were unreachable).",
        });
      } else {
        toast({
          title: "Studio Image Ready! ✨",
          description: "Background successfully removed for this photo.",
        });
      }
    } catch (err: any) {
      console.error("Background removal error:", err);
      toast({
        title: "Photo Notice",
        description: err?.message || "Could not process image automatically. You can still upload the photo directly.",
      });
      setGalleryImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, processingBg: false } : img))
      );
    }
  };

  const generateClientAiDetails = (nameInput: string, categoryInput: string) => {
    const seed = Math.floor(Math.random() * 10000);
    const safeName = (nameInput || "").trim();
    const safeCat = (categoryInput || "").trim();
    const lowerName = safeName.toLowerCase();
    const lowerCat = safeCat.toLowerCase();

    let name = safeName;
    let category = safeCat || "Fashion";
    let department = "fashion";
    let price = String(180 + (seed % 30) * 10);
    let sizes = "S, M, L, XL";
    let materials = "Composition: 100% Premium Fabric\nCare: Machine wash cold with like colors";
    let fit = "Fit: Modern tailored fit. True to size.";
    
    if (!name) {
      const titles = [
        "Urban Essential Piece",
        "Modern Classic Apparel",
        "Contemporary Premium Item",
        "Signature Heritage Collection",
        "Minimalist Style Essential",
        "Tailored Everyday Comfort"
      ];
      name = titles[seed % titles.length];
    }

    if (lowerCat.includes("shoe") || lowerCat.includes("footwear") || lowerName.includes("sneaker") || lowerName.includes("boot") || lowerName.includes("shoe")) {
      category = "Shoes & Sneakers";
      department = "fashion";
      price = String(290 + (seed % 20) * 10);
      sizes = "39, 40, 41, 42, 43, 44, 45";
      materials = "Upper: Genuine Leather & Breathable Mesh\nSole: Anti-slip vulcanized rubber";
      fit = "Fit: Comfortable ergonomic fit. Order your standard shoe size.";
    } else if (lowerCat.includes("gadget") || lowerCat.includes("tech") || lowerCat.includes("audio") || lowerName.includes("phone") || lowerName.includes("watch") || lowerName.includes("headphone")) {
      category = lowerName.includes("headphone") ? "Audio & Headphones" : lowerName.includes("watch") ? "Wearables" : "Gadgets & Tech";
      department = "gadgets";
      price = String(350 + (seed % 35) * 20);
      sizes = "One Size";
      materials = "Material: Anodized Matte Aluminum / High-grade Polymer\nIncludes: USB-C Cable & User Manual";
      fit = "Universal compatibility with iOS, Android, and Bluetooth 5.3 devices.";
    } else if (lowerCat.includes("art") || lowerCat.includes("home") || lowerName.includes("painting") || lowerName.includes("decor") || lowerName.includes("sculpture")) {
      category = lowerName.includes("painting") ? "Paintings" : lowerName.includes("sculpture") ? "Sculptures" : "Art & Collectibles";
      department = lowerCat.includes("home") ? "home" : "art";
      price = String(420 + (seed % 25) * 15);
      sizes = "One Size";
      materials = "Craftsmanship: Hand-selected premium archival canvas\nOrigin: Artisanal studio creation";
      fit = "Designed to enhance living rooms, galleries, and modern spaces.";
    } else if (lowerName.includes("bag") || lowerName.includes("backpack") || lowerName.includes("wallet")) {
      category = "Bags & Accessories";
      department = "fashion";
      price = String(240 + (seed % 15) * 10);
      sizes = "One Size";
      materials = "Material: Water-resistant synthetic leather\nCare: Wipe clean with damp cloth";
      fit = "Spacious interior with multiple organized compartments.";
    }

    const featuresPool = [
      [
        `• Premium grade crafting designed for ${name}`,
        "• Lightweight, breathable fabric construction",
        "• Reinforced seams for long-lasting durability",
        "• Versatile styling for day-to-night wear"
      ],
      [
        `• Signature finish tailored for ${name}`,
        "• Soft-touch, high-comfort material",
        "• Modern ergonomic fit",
        "• Color-fast and shrink-resistant fabric"
      ],
      [
        `• High-performance modern design`,
        "• Thoughtfully placed detailing and pockets",
        "• Heavyweight premium structure",
        "• Easy maintenance and wash care"
      ]
    ];

    const features = featuresPool[seed % featuresPool.length].join("\n");

    const descriptions = [
      `Elevate your everyday style with the ${name}. Thoughtfully designed for our ${category} collection, it combines premium materials with modern craftsmanship to deliver supreme comfort and a refined aesthetic.`,
      `The ${name} brings together a contemporary silhouette crafted for maximum versatility. Perfect for our ${category} selection, it offers exceptional quality, tactile comfort, and lasting durability.`,
      `Add distinction to your wardrobe with ${name}. Meticulously created with attention to detail and high-grade materials, this item in ${category} delivers timeless style and ease.`,
      `Discover ${name}—a blend of contemporary aesthetics and everyday functionality. Designed for our ${category} lineup, it offers superior comfort and effortless elegance.`
    ];

    const description = descriptions[seed % descriptions.length];

    return { name, category, department, price, description, sizes, features, materials_info: materials, size_fit_info: fit };
  };

  const handleAiAutoFill = async () => {
    const primaryImage = galleryImages[0]?.url;
    if (!form.name && !form.category && !primaryImage) {
      toast({
        title: "Missing Information",
        description: "Please upload a photo, or enter a product name/category first.",
        variant: "destructive",
      });
      return;
    }
    setIsAiLoading(true);
    try {
      let aiResult: any = null;
      try {
        const { data, error } = await supabase.functions.invoke("ai-generate-product-details", {
          body: { 
            productName: form.name, 
            category: form.category,
            imageUrl: primaryImage || null,
          },
        });
        if (!error && data && data.description && !data.description.includes("crafted with care") && !data.description.includes("A stylish and high-quality product")) {
          aiResult = data;
        }
      } catch (e) {
        console.warn("Supabase edge function fallback trigger:", e);
      }

      if (!aiResult) {
        aiResult = generateClientAiDetails(form.name, form.category);
      }

      setForm((prev) => ({
        ...prev,
        name: prev.name && prev.name.trim().length > 0 ? prev.name : (aiResult.name || prev.name),
        category: prev.category && prev.category.trim().length > 0 ? prev.category : (aiResult.category || prev.category),
        department: prev.department || aiResult.department || "fashion",
        price: prev.price && prev.price.trim().length > 0 ? prev.price : (aiResult.price ? String(aiResult.price) : "150"),
        description: aiResult.description || prev.description || "",
        sizes: prev.sizes && prev.sizes.trim().length > 0 ? prev.sizes : (aiResult.sizes || ""),
        features: aiResult.features || prev.features || "",
        materials_info: aiResult.materials_info || prev.materials_info || "",
        size_fit_info: aiResult.size_fit_info || prev.size_fit_info || "",
      }));

      toast({ 
        title: "AI Auto-Fill Complete! ✨", 
        description: "Product details, category, price, specs & description refreshed." 
      });
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
    const [p, oi, s, hubsRes, dropoffsRes, profRes] = await Promise.all([
      supabase.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("order_items")
        .select("id, quantity, unit_price, seller_earnings, commission_amount, created_at, order_id, product_id, products(name, image), orders(id, status, tracking_code, pickup_otp, pickup_confirmed_at, shipping_name, shipping_city)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("get_seller_earnings_summary", { _seller_id: user.id }),
      supabase.from("hubs").select("*").eq("is_active", true),
      supabase.from("seller_dropoffs").select("*, hubs(name)").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase.from("seller_profiles").select("*").eq("user_id", user.id).maybeSingle()
    ]);
    setProducts((p.data as any) ?? []);
    setOrderItems((oi.data as any) ?? []);
    setSummary(Array.isArray(s.data) ? s.data[0] : s.data);
    setHubs((hubsRes.data as any) ?? []);
    setDropoffs((dropoffsRes.data as any) ?? []);
    if (profRes.data) {
      setSellerProfile(profRes.data);
      setFulfillmentForm({
        fulfillment_model: profRes.data.fulfillment_model || "direct_pickup",
        pickup_address: profRes.data.pickup_address || profRes.data.business_address || profRes.data.address || "",
        pickup_landmark: profRes.data.pickup_landmark || "",
        pickup_phone: profRes.data.pickup_phone || profRes.data.phone || "",
        pickup_latitude: profRes.data.pickup_latitude ?? null,
        pickup_longitude: profRes.data.pickup_longitude ?? null,
      });
    }
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

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS Error", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFulfillmentForm((prev) => ({
          ...prev,
          pickup_latitude: pos.coords.latitude,
          pickup_longitude: pos.coords.longitude,
        }));
        setDetectingGps(false);
        toast({ title: "GPS Coordinates Detected 📍", description: `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° W` });
      },
      (err) => {
        setDetectingGps(false);
        toast({ title: "GPS Error", description: err.message || "Could not detect location.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveFulfillmentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingFulfillment(true);
    try {
      const { error } = await supabase
        .from("seller_profiles")
        .update({
          fulfillment_model: fulfillmentForm.fulfillment_model,
          pickup_address: fulfillmentForm.pickup_address || null,
          pickup_landmark: fulfillmentForm.pickup_landmark || null,
          pickup_phone: fulfillmentForm.pickup_phone || null,
          pickup_latitude: fulfillmentForm.pickup_latitude,
          pickup_longitude: fulfillmentForm.pickup_longitude,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Fulfillment Settings Saved 🚚",
        description: `Your shop fulfillment model is now set to ${fulfillmentForm.fulfillment_model === "direct_pickup" ? "Direct Doorstep Pickup" : "Hub Drop-off"}.`,
      });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save settings.", variant: "destructive" });
    } finally {
      setSavingFulfillment(false);
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
      title: "AI Enhancing Image... ✨",
      description: `Optimizing and removing background for color "${color.name || 'variant'}". Please wait...`,
    });
    try {
      const result = await processAiBackgroundRemoval(
        source,
        `color-${index}`,
        {
          maxDimension: 1024,
        }
      );
      setColors((prev) =>
        prev.map((c, i) => (i === index ? { ...c, file: result.file, image: result.previewUrl } : c))
      );
      if (result.isFallback) {
        toast({
          title: "Color Photo Optimized ✨",
          description: "Photo formatted for studio display. (AI background removal was skipped because model servers were unreachable).",
        });
      } else {
        toast({
          title: "Studio Image Ready! ✨",
          description: "Background successfully removed for this color.",
        });
      }
    } catch (err: any) {
      console.error("Background removal error for color:", err);
      toast({
        title: "Color Photo Notice",
        description: err?.message || "Could not process image automatically. You can still upload the photo directly.",
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
      <main className="min-h-screen pt-20 pb-24 w-full overflow-x-hidden">
        <div className="container mx-auto px-4 max-w-5xl w-full">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl md:text-3xl font-semibold mb-6"
          >
            Seller Dashboard
          </motion.h1>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
            <Card className="overflow-hidden min-w-0">
              <CardContent className="p-3 sm:p-5 min-w-0">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Total sales</div>
                <div className="text-sm sm:text-xl font-bold truncate mt-0.5" title={`GH₵${Number(summary?.total_sales ?? summary?.total_gross ?? 0).toFixed(2)}`}>
                  GH₵{Number(summary?.total_sales ?? summary?.total_gross ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden min-w-0">
              <CardContent className="p-3 sm:p-5 min-w-0">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Your earnings</div>
                <div className="text-sm sm:text-xl font-bold truncate mt-0.5 text-emerald-600 dark:text-emerald-400" title={`GH₵${Number(summary?.total_earnings ?? 0).toFixed(2)}`}>
                  GH₵{Number(summary?.total_earnings ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden min-w-0">
              <CardContent className="p-3 sm:p-5 min-w-0">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Pending payout</div>
                <div className="text-sm sm:text-xl font-bold truncate mt-0.5 text-amber-600 dark:text-amber-400" title={`GH₵${Number(summary?.pending_payout ?? summary?.pending_earnings ?? 0).toFixed(2)}`}>
                  GH₵{Number(summary?.pending_payout ?? summary?.pending_earnings ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden min-w-0">
              <CardContent className="p-3 sm:p-5 min-w-0">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Orders</div>
                <div className="text-sm sm:text-xl font-bold truncate mt-0.5">
                  {Number(summary?.total_orders ?? 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="space-y-6 w-full">
            <div className="w-full overflow-x-auto no-scrollbar pb-1">
              <TabsList className="inline-flex w-max min-w-full sm:w-auto h-auto p-1 bg-muted rounded-xl gap-1">
                <TabsTrigger value="products" className="text-xs sm:text-sm px-3 sm:px-3.5 py-2 data-[state=active]:bg-background">
                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />Products
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs sm:text-sm px-3 sm:px-3.5 py-2 data-[state=active]:bg-background">
                  <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />Orders
                </TabsTrigger>
                <TabsTrigger value="earnings" className="text-xs sm:text-sm px-3 sm:px-3.5 py-2 data-[state=active]:bg-background">
                  <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />Earnings
                </TabsTrigger>
                <TabsTrigger value="dropoffs" className="text-xs sm:text-sm px-3 sm:px-3.5 py-2 data-[state=active]:bg-background">
                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />Drop-offs
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs sm:text-sm px-3 sm:px-3.5 py-2 data-[state=active]:bg-background">
                  <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />Fulfillment Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="products">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {products.length} product{products.length === 1 ? "" : "s"}
                </div>
                <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o && editing) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button onClick={handleOpenAddDialog} size="sm" className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm shrink-0">
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />Add product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submit} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={form.name} onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, name: v })); }} />
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

                        {/* Recommendation Callout & Status */}
                        <div className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
                          galleryImages.length >= 3
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200"
                            : galleryImages.length > 0
                            ? "bg-amber-50/80 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
                            : "bg-purple-50/80 border-purple-200 text-purple-950 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-200"
                        }`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 font-semibold">
                              {galleryImages.length >= 3 ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>Great visual coverage! ({galleryImages.length} photos added)</span>
                                </>
                              ) : (
                                <>
                                  <Camera className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <span>Recommendation: Upload at least 3 to 4 photos</span>
                                </>
                              )}
                            </div>
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                              galleryImages.length >= 3
                                ? "bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
                                : galleryImages.length > 0
                                ? "bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                                : "bg-purple-100 dark:bg-purple-900/60 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200"
                            }`}>
                              {galleryImages.length} of 4 recommended photos
                            </span>
                          </div>
                          
                          <p className="text-[11px] opacity-90 leading-relaxed">
                            {galleryImages.length === 0 && (
                              "Products with 3–4 photos sell 2x faster and reduce returns. We recommend capturing your product from multiple angles."
                            )}
                            {galleryImages.length > 0 && galleryImages.length < 3 && (
                              `You've added ${galleryImages.length} photo${galleryImages.length > 1 ? "s" : ""}. Adding ${3 - galleryImages.length} more (such as back view, detail zoom, or packaging) builds maximum buyer confidence!`
                            )}
                            {galleryImages.length >= 3 && (
                              "Looks complete! Your product displays multiple perspectives. The first photo with the 'Main Cover' badge is what customers see in the catalog."
                            )}
                          </p>

                          {/* Recommended Photo Types */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-black/30 border border-current/20 font-medium">
                              1. Front Angle 📸
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-black/30 border border-current/20 font-medium">
                              2. Back / Side 🔄
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-black/30 border border-current/20 font-medium">
                              3. Close-up Details 🔍
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-black/30 border border-current/20 font-medium">
                              4. Packaging / Lifestyle 📦
                            </span>
                          </div>
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
                          <Input id="price" type="number" step="0.01" value={form.price} onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, price: v })); }} />
                          {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
                        </div>
                        <div>
                          <Label htmlFor="stock">Stock</Label>
                          <Input
                            id="stock"
                            type="number"
                            disabled={colors.length > 0}
                            value={colors.length > 0 ? String(colors.reduce((s, c) => s + (Number(c.stock) || 0), 0)) : form.stock}
                            onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, stock: v })); }}
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
                              setForm((prev) => ({ 
                                ...prev, 
                                department: v,
                              }));
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
                          <CategoryCombobox
                            department={form.department || "fashion"}
                            value={form.category}
                            onChange={(catName, detectedDept) => {
                              setForm((prev) => ({
                                ...prev,
                                category: catName,
                                department: detectedDept || prev.department || "fashion",
                              }));
                              if (errors.category) {
                                setErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.category;
                                  return next;
                                });
                              }
                            }}
                            error={errors.category}
                          />
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
                            disabled={isAiLoading}
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
                        <Textarea id="description" rows={3} value={form.description} onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, description: v })); }} />
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
                          onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, sizes: v })); }} 
                        />
                      </div>

                      <div className="border-t pt-4 space-y-4">
                        <div>
                          <Label htmlFor="features">Key highlights (optional)</Label>
                          <p className="text-xs text-muted-foreground mt-1 mb-2">One per line — shown as bullet points under Details.</p>
                          <Textarea id="features" rows={4} placeholder={"Oversized fit\nSoft & heavyweight fabric\nUnisex style"} value={form.features} onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, features: v })); }} />
                        </div>
                        <div>
                          <Label htmlFor="materials_info">Materials & care (optional)</Label>
                          <Textarea id="materials_info" rows={4} placeholder={"Composition: 100% cotton\nWeight: 450gsm\nMachine wash cold"} value={form.materials_info} onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, materials_info: v })); }} />
                        </div>
                        <div>
                          <Label htmlFor="size_fit_info">Size & fit (optional)</Label>
                          <Textarea id="size_fit_info" rows={3} placeholder="Fit: true to size. Model is 185cm wearing Large." value={form.size_fit_info} onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, size_fit_info: v })); }} />
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
                    <Card key={p.id} className="overflow-hidden min-w-0">
                      <CardContent className="p-3 sm:p-4 flex items-center gap-3 min-w-0">
                        <img src={p.image} alt={p.name} className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg shrink-0 border bg-muted" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm sm:text-base truncate">{p.name}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium truncate">
                            GH₵{Number(p.price).toFixed(2)} · Stock {p.stock}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <StatusBadge status={p.status} />
                          </div>
                          {p.status === "rejected" && p.rejection_reason && (
                            <div className="text-xs text-destructive mt-1 bg-destructive/10 p-1.5 rounded">{p.rejection_reason}</div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => openEdit(p)} title="Edit product">
                            <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(p.id)} title="Delete product">
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                <div className="space-y-3">
                  {orderItems.map((oi) => {
                    const orderObj = (Array.isArray(oi.orders) ? oi.orders[0] : oi.orders) as any;
                    const productObj = (Array.isArray(oi.products) ? oi.products[0] : oi.products) as any;
                    const orderStatus = orderObj?.status || "pending";
                    const isAwaitingPickup = ["pending", "confirmed", "processing"].includes(orderStatus);
                    const isHandedOver = ["shipped", "delivered"].includes(orderStatus);
                    const pickupOtp = orderObj?.pickup_otp;

                    return (
                      <Card key={oi.id} className="overflow-hidden border transition-all hover:border-primary/40">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {productObj?.image ? (
                                <img
                                  src={productObj.image}
                                  alt={productObj?.name}
                                  className="w-12 h-12 object-cover rounded-lg border bg-muted shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Package className="w-6 h-6 text-muted-foreground/40" />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-sm leading-tight text-foreground">
                                  {productObj?.name ?? "Product"}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>Qty: <strong>{oi.quantity}</strong></span>
                                  <span>·</span>
                                  <span>Ordered: {new Date(oi.created_at).toLocaleDateString()}</span>
                                  {orderObj?.tracking_code && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono text-[11px] text-primary">#{orderObj.tracking_code}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                GH₵{Number(oi.seller_earnings ?? 0).toFixed(2)}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                fee GH₵{Number(oi.commission_amount ?? 0).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Pickup Handover OTP Box */}
                          {isAwaitingPickup && pickupOtp && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                                  <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>RIDER PICKUP HANDOVER PIN</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  Give this 4-digit code to the dispatch rider <strong>ONLY</strong> when handing over the physical parcel.
                                </p>
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-center">
                                <div className="bg-background px-3 py-1 rounded-lg border-2 border-amber-500/50 font-mono text-lg font-extrabold tracking-widest text-amber-600 dark:text-amber-400 shadow-xs">
                                  {pickupOtp}
                                </div>
                              </div>
                            </div>
                          )}

                          {isHandedOver && (
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>Handed over to Dispatch Rider · Verified via Handover PIN</span>
                              </div>
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-bold">
                                {orderStatus}
                              </Badge>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="earnings">
              <Card>
                <CardHeader><CardTitle>Payout summary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Gross sales</span><span>GH₵{Number(summary?.total_sales ?? summary?.total_gross ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Platform commission (10%)</span><span>-GH₵{Number(summary?.total_commission ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-2"><span>Your net earnings</span><span>GH₵{Number(summary?.total_earnings ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Paid out to subaccount</span><span>GH₵{Number(summary?.paid_payout ?? summary?.paid_earnings ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Pending payout</span><span>GH₵{Number(summary?.pending_payout ?? summary?.pending_earnings ?? 0).toFixed(2)}</span></div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground mt-4">
                Automated Paystack split payouts are active. 90% of your sale is routed directly to your registered Mobile Money or Bank account via your Paystack Subaccount upon customer checkout.
              </p>
            </TabsContent>

            <TabsContent value="dropoffs" className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="font-semibold text-lg">Fulfillment Drop-offs</h2>
                  <p className="text-xs text-muted-foreground">
                    Deliver your inventory items to any of our official live hub locations below.
                  </p>
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
                          <div className="p-3 bg-gray-50 border rounded-lg text-xs space-y-2 text-gray-700">
                            <div className="font-semibold text-sm text-gray-900 flex justify-between items-center">
                              <span>{hubObj.name}</span>
                              <Badge variant="outline">{hubObj.region}</Badge>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{hubObj.address}</span>
                            </div>
                            {hubObj.contact_phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Phone: </span>
                                <a href={`tel:${hubObj.contact_phone}`} className="font-medium text-emerald-700 hover:underline">
                                  {hubObj.contact_phone}
                                </a>
                              </div>
                            )}
                            {hubObj.contact_email && (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Email: </span>
                                <a href={`mailto:${hubObj.contact_email}`} className="font-medium text-blue-700 hover:underline">
                                  {hubObj.contact_email}
                                </a>
                              </div>
                            )}
                            {hubObj.operating_hours && (
                              <div className="flex items-center gap-1.5 text-amber-700">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>Hours: {hubObj.operating_hours}</span>
                              </div>
                            )}
                            {hubObj.dropoff_instructions && (
                              <div className="p-2 bg-blue-50/60 rounded border border-blue-100 text-blue-900 flex items-start gap-1.5 mt-1">
                                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <span>{hubObj.dropoff_instructions}</span>
                              </div>
                            )}
                            {hubObj.google_maps_url && (
                              <a
                                href={hubObj.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary font-medium hover:underline pt-1"
                              >
                                <ExternalLink className="w-3 h-3" /> Get Live Directions on Google Maps
                              </a>
                            )}
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

              {/* Official Hub Directory Cards */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" /> Active Hub Locations & Support Directory
                </h3>
                {hubs.length === 0 ? (
                  <Card><CardContent className="pt-6 text-center text-xs text-muted-foreground">No hub locations configured yet.</CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hubs.map((hub) => (
                      <Card key={hub.id} className="border hover:border-primary/40 transition-colors">
                        <CardContent className="pt-4 space-y-2.5 text-xs">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-sm text-gray-900">{hub.name}</h4>
                            <Badge variant="outline">{hub.region}</Badge>
                          </div>
                          
                          <div className="flex items-start gap-2 text-gray-700">
                            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{hub.address}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                            {hub.contact_phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <a href={`tel:${hub.contact_phone}`} className="font-medium text-emerald-700 hover:underline">
                                  {hub.contact_phone}
                                </a>
                              </div>
                            )}

                            {hub.contact_email && (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <a href={`mailto:${hub.contact_email}`} className="font-medium text-blue-700 hover:underline truncate">
                                  {hub.contact_email}
                                </a>
                              </div>
                            )}
                          </div>

                          {hub.operating_hours && (
                            <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{hub.operating_hours}</span>
                            </div>
                          )}

                          {hub.dropoff_instructions && (
                            <div className="p-2 bg-gray-50 rounded border text-gray-600 flex items-start gap-1.5">
                              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <span>{hub.dropoff_instructions}</span>
                            </div>
                          )}

                          {hub.google_maps_url ? (
                            <a
                              href={hub.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md font-medium text-xs hover:bg-primary/20 transition-colors w-fit"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Open Live Map Location
                            </a>
                          ) : (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hub.name + " " + hub.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md font-medium text-xs hover:bg-gray-200 transition-colors w-fit"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Search Live Location on Google Maps
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Your Scheduled Drop-offs Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Your Drop-off Requests ({dropoffs.length})
                </h3>
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : dropoffs.length === 0 ? (
                  <Card><CardContent className="pt-6 text-center text-xs text-muted-foreground">No drop-off requests yet. Click "Schedule Drop-off" above to submit an inventory drop-off request.</CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {dropoffs.map((d) => (
                      <Card key={d.id}>
                        <CardContent className="pt-4 flex justify-between items-center">
                          <div>
                            <div className="font-medium text-sm">Drop-off to {d.hubs?.name || "Hub"}</div>
                            <div className="text-xs text-muted-foreground">
                              Requested on {new Date(d.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <StatusBadge status={d.status} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    Order Delivery & Fulfillment Model
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveFulfillmentSettings} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div
                        onClick={() => setFulfillmentForm({ ...fulfillmentForm, fulfillment_model: "direct_pickup" })}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          fulfillmentForm.fulfillment_model === "direct_pickup"
                            ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                            : "border-border hover:border-muted-foreground/40 bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          <span className="text-lg">🛵</span> Direct Doorstep Pickup
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Riders pick up sold orders directly from your shop or home live GPS address.
                        </p>
                      </div>

                      <div
                        onClick={() => setFulfillmentForm({ ...fulfillmentForm, fulfillment_model: "hub_dropoff" })}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          fulfillmentForm.fulfillment_model === "hub_dropoff"
                            ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                            : "border-border hover:border-muted-foreground/40 bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          <span className="text-lg">🏢</span> Trades Point Hub Drop-Off
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          You drop off sold items at any central Trades Point Hub within 24 hours of order placement.
                        </p>
                      </div>
                    </div>

                    {fulfillmentForm.fulfillment_model === "direct_pickup" && (
                      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" /> Doorstep Pickup Location & Live GPS Pin
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDetectGps}
                            disabled={detectingGps}
                            className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                          >
                            {detectingGps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5 text-primary" />}
                            {detectingGps ? "Detecting..." : "Detect Live GPS Pin"}
                          </Button>
                        </div>

                        {fulfillmentForm.pickup_latitude && fulfillmentForm.pickup_longitude && (
                          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                            <span>
                              Live GPS Pin: <strong>{fulfillmentForm.pickup_latitude.toFixed(4)}° N, {fulfillmentForm.pickup_longitude.toFixed(4)}° W</strong>
                            </span>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="setting_pickup_address" className="text-xs font-medium">Pickup Street Address / Shop Name</Label>
                            <Input
                              id="setting_pickup_address"
                              value={fulfillmentForm.pickup_address}
                              onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, pickup_address: e.target.value })}
                              placeholder="e.g. Shop #12, Accra Central Market, or House 45, East Legon"
                              className="mt-1 bg-background"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="setting_pickup_landmark" className="text-xs font-medium">Nearest Landmark</Label>
                              <Input
                                id="setting_pickup_landmark"
                                value={fulfillmentForm.pickup_landmark}
                                onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, pickup_landmark: e.target.value })}
                                placeholder="e.g. Opposite Shell Filling Station"
                                className="mt-1 bg-background"
                              />
                            </div>
                            <div>
                              <Label htmlFor="setting_pickup_phone" className="text-xs font-medium">Pickup Dispatch Contact Phone</Label>
                              <Input
                                id="setting_pickup_phone"
                                value={fulfillmentForm.pickup_phone}
                                onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, pickup_phone: e.target.value })}
                                placeholder="e.g. 0244123456"
                                className="mt-1 bg-background"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button type="submit" disabled={savingFulfillment} className="w-full sm:w-auto">
                      {savingFulfillment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {savingFulfillment ? "Saving..." : "Save Fulfillment Settings"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default SellerDashboard;
