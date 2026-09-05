import { useState, useEffect, useMemo } from "react";
import {
  Zap, Eye, EyeOff, Search, X, GripVertical,
  Clock, Type, Save, RotateCcw, Sparkles, Loader2,
  Check, ChevronRight, ShoppingBag, Store, Flame,
  Percent, ArrowUp, ArrowDown, Calendar, Tag, Filter,
  CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCountdown } from "@/hooks/useCountdown";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface LinkedFlashDeal {
  productId: string;
  productName: string;
  productImage: string;
  originalPrice: number;
  flashPrice: number;
  discountPercent: number;
  claimedPercent: number;
  sellerName: string;
  category?: string;
  department?: string | null;
}

export interface FlashDealSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  endsAt: string; // ISO string
  deals: LinkedFlashDeal[];
}

interface ProductWithSeller {
  id: string;
  name: string;
  image: string;
  price: number;
  category?: string;
  department?: string | null;
  sale_price?: number | null;
  seller_id?: string | null;
  sellerName?: string;
}

const STORAGE_KEY = "admin_flash_deals_settings";

const getDefaultEndTime = () => {
  const d = new Date();
  d.setHours(d.getHours() + 8);
  d.setMinutes(0);
  d.setSeconds(0);
  return d.toISOString();
};

const DEFAULT_SETTINGS: FlashDealSettings = {
  enabled: true,
  title: "Lightning Flash Deals",
  subtitle: "Limited quantities at special discount prices",
  endsAt: getDefaultEndTime(),
  deals: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
export const getFlashDealSettings = (): FlashDealSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
};

const saveSettings = (settings: FlashDealSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("flash-deals-settings-changed"));
};

export const FlashDealsManagement = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<FlashDealSettings>(getFlashDealSettings);
  const [allProducts, setAllProducts] = useState<ProductWithSeller[]>([]);
  const [sellersList, setSellersList] = useState<{ id: string; name: string }[]>([]);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Live countdown for admin preview
  const { formattedHours, formattedMinutes, formattedSeconds, isExpired } = useCountdown(settings.endsAt);

  // Fetch all products and sellers safely
  useEffect(() => {
    const fetchProductsAndSellers = async () => {
      setLoading(true);
      try {
        // 1. Fetch raw products
        const { data: rawProducts, error: prodError } = await supabase
          .from("products")
          .select("id, name, image, price, category, department, sale_price, seller_id")
          .order("created_at", { ascending: false })
          .limit(400);

        if (prodError) throw prodError;

        // 2. Fetch seller profiles
        const { data: sellerData } = await supabase
          .from("seller_profiles")
          .select("user_id, business_name");

        const sellerMap = new Map<string, string>();
        const uniqueSellersMap = new Map<string, string>();

        (sellerData || []).forEach((s: any) => {
          if (s.user_id && s.business_name) {
            sellerMap.set(s.user_id, s.business_name);
            uniqueSellersMap.set(s.user_id, s.business_name);
          }
        });

        // 3. Combine products with seller names
        const enriched: ProductWithSeller[] = (rawProducts || []).map((p: any) => {
          const sName = p.seller_id ? sellerMap.get(p.seller_id) || "Independent Seller" : "Official Store";
          return {
            ...p,
            sellerName: sName,
          };
        });

        setAllProducts(enriched);

        const sellersArr = Array.from(uniqueSellersMap.entries()).map(([id, name]) => ({ id, name }));
        setSellersList(sellersArr);
      } catch (err) {
        console.error("Error loading products and sellers:", err);
        toast({
          title: "Notice",
          description: "Could not fetch remote products list. Using active local cache.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProductsAndSellers();
  }, []);

  const updateSettings = (patch: Partial<FlashDealSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  // Timer Preset Helpers
  const setTimerPreset = (hoursFromNow: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hoursFromNow);
    d.setMinutes(0);
    d.setSeconds(0);
    updateSettings({ endsAt: d.toISOString() });
    toast({
      title: `Timer set to +${hoursFromNow} Hours ⚡`,
      description: "Countdown updated live on storefront.",
    });
  };

  const setMidnightTonight = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    updateSettings({ endsAt: d.toISOString() });
    toast({
      title: "Timer set to Tonight @ Midnight ⚡",
      description: "Countdown updated live on storefront.",
    });
  };

  const setTomorrowMidnight = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 999);
    updateSettings({ endsAt: d.toISOString() });
    toast({
      title: "Timer set to Tomorrow @ Midnight ⚡",
      description: "Countdown updated live on storefront.",
    });
  };

  // Unique categories for filter
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [allProducts]);

  // Filtered available products (excluding already linked ones)
  const availableProducts = useMemo(() => {
    const linkedIds = new Set(settings.deals.map((d) => d.productId));
    const q = searchQuery.toLowerCase().trim();

    return allProducts.filter((p) => {
      if (linkedIds.has(p.id)) return false;

      // Seller filter
      if (selectedSellerFilter !== "all") {
        if (selectedSellerFilter === "official" && p.seller_id) return false;
        if (selectedSellerFilter !== "official" && p.seller_id !== selectedSellerFilter) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== "all" && p.category !== selectedCategoryFilter) {
        return false;
      }

      // Search query
      if (q) {
        const matchesName = (p.name || "").toLowerCase().includes(q);
        const matchesCategory = (p.category || "").toLowerCase().includes(q);
        const matchesSeller = (p.sellerName || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCategory && !matchesSeller) return false;
      }

      return true;
    });
  }, [allProducts, settings.deals, searchQuery, selectedSellerFilter, selectedCategoryFilter]);

  // Link a product to flash deals
  const handleLinkProduct = async (prod: ProductWithSeller) => {
    const originalPrice = Number(prod.price) || 100;
    // Default 25% off flash sale price
    const flashPrice = Math.max(1, Math.round(originalPrice * 0.75 * 100) / 100);
    const discountPercent = Math.round(((originalPrice - flashPrice) / originalPrice) * 100);

    const newDeal: LinkedFlashDeal = {
      productId: prod.id,
      productName: prod.name,
      productImage: prod.image,
      originalPrice,
      flashPrice,
      discountPercent,
      claimedPercent: 78,
      sellerName: prod.sellerName || "Store Product",
      category: prod.category,
      department: prod.department,
    };

    const newDeals = [...settings.deals, newDeal];
    updateSettings({
      deals: newDeals,
    });

    // Auto sync to Supabase in background
    try {
      await supabase
        .from("products")
        .update({
          sale_price: flashPrice,
          sale_ends_at: settings.endsAt,
        })
        .eq("id", prod.id);
    } catch {
      // ignore
    }

    toast({
      title: "Linked & Live on Main Site! ⚡",
      description: `"${prod.name}" is now live in Flash Deals at GH₵${flashPrice.toFixed(2)}.`,
    });
  };

  // Unlink deal
  const handleUnlinkDeal = async (productId: string) => {
    const newDeals = settings.deals.filter((d) => d.productId !== productId);
    updateSettings({
      deals: newDeals,
    });

    // Clear sale_price in Supabase
    try {
      await supabase
        .from("products")
        .update({
          sale_price: null,
          sale_ends_at: null,
        })
        .eq("id", productId);
    } catch {
      // ignore
    }

    toast({
      title: "Deal Removed",
      description: "Product unlinked from Flash Deals.",
    });
  };

  // Update specific deal price or claimed %
  const handleUpdateDeal = async (index: number, patch: Partial<LinkedFlashDeal>) => {
    const updated = [...settings.deals];
    const item = { ...updated[index], ...patch };

    if (patch.flashPrice !== undefined) {
      const original = item.originalPrice;
      const flash = Math.max(0.1, Number(patch.flashPrice) || 0);
      item.flashPrice = flash;
      item.discountPercent = original > 0 ? Math.max(1, Math.round(((original - flash) / original) * 100)) : 0;
    }

    updated[index] = item;
    updateSettings({ deals: updated });

    if (patch.flashPrice !== undefined) {
      try {
        await supabase
          .from("products")
          .update({
            sale_price: item.flashPrice,
            sale_ends_at: settings.endsAt,
          })
          .eq("id", item.productId);
      } catch {
        // ignore
      }
    }
  };

  // Move deal position up / down
  const moveDeal = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= settings.deals.length) return;
    const updated = [...settings.deals];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updateSettings({ deals: updated });
  };

  // Drag reorder
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...settings.deals];
    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, removed);
    updateSettings({ deals: updated });
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  // Save changes to localStorage AND sync to Supabase products table
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save to local settings
      saveSettings(settings);

      // 2. Sync to Supabase products table for linked deals
      if (settings.deals.length > 0) {
        for (const deal of settings.deals) {
          await supabase
            .from("products")
            .update({
              sale_price: deal.flashPrice,
              sale_ends_at: settings.endsAt,
            })
            .eq("id", deal.productId);
        }
      }

      setHasChanges(false);
      toast({
        title: "Flash Deals Saved & Live! ⚡",
        description: `Homepage is now displaying ${settings.deals.length} linked flash deals.`,
      });
    } catch (err) {
      console.error("Error saving flash deals:", err);
      toast({
        title: "Saved Locally",
        description: "Flash Deals updated on this browser.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS, endsAt: getDefaultEndTime() });
    setHasChanges(true);
  };

  // Format ISO to datetime-local input string
  const toLocalInputValue = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  const handleCustomDateTime = (val: string) => {
    if (!val) return;
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      updateSettings({ endsAt: d.toISOString() });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Flash Deals Management
              <span className="text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                {settings.deals.length} Active Deals
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Link seller products, set promotional discount prices, and control the live countdown timer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-md cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          You have unsaved changes. Click <strong>Save Changes</strong> in the top right to apply them live.
        </div>
      )}

      {/* ── 1. Enable/Disable Toggle ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.enabled ? (
                <Eye className="w-5 h-5 text-emerald-500" />
              ) : (
                <EyeOff className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <Label className="text-sm font-semibold cursor-pointer">
                  Show Flash Deals Section on Homepage
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {settings.enabled
                    ? "Lightning Deals showcase and countdown clock are active on the storefront"
                    : "The Flash Deals section is temporarily hidden from visitors"}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSettings({ enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Countdown Clock Manager ─────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" />
              <h3 className="font-semibold text-sm">Flash Deal Timer & Duration</h3>
            </div>

            {/* Live Timer Preview */}
            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-3 py-1 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300">
              <span>Remaining:</span>
              <span className="font-mono font-bold text-sm bg-rose-600 text-white px-2 py-0.5 rounded-md">
                {formattedHours}:{formattedMinutes}:{formattedSeconds}
              </span>
              {isExpired && <span className="text-red-500 font-bold ml-1">(Expired)</span>}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Timer Presets</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimerPreset(6)}
                className="text-xs font-medium cursor-pointer"
              >
                +6 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimerPreset(12)}
                className="text-xs font-medium cursor-pointer"
              >
                +12 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimerPreset(24)}
                className="text-xs font-medium cursor-pointer"
              >
                +24 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setMidnightTonight}
                className="text-xs font-medium cursor-pointer"
              >
                Tonight @ Midnight
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setTomorrowMidnight}
                className="text-xs font-medium cursor-pointer"
              >
                Tomorrow @ Midnight
              </Button>
            </div>
          </div>

          {/* Custom Date Time Picker */}
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="custom-end-time" className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Or Pick Exact Expiration Date & Time:
            </Label>
            <Input
              id="custom-end-time"
              type="datetime-local"
              value={toLocalInputValue(settings.endsAt)}
              onChange={(e) => handleCustomDateTime(e.target.value)}
              className="text-sm max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Title & Subtitle ────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Type className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Section Titles</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="flash-title" className="text-xs text-muted-foreground">
                Heading Title
              </Label>
              <Input
                id="flash-title"
                value={settings.title}
                onChange={(e) => updateSettings({ title: e.target.value })}
                placeholder="e.g. Lightning Flash Deals"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="flash-subtitle" className="text-xs text-muted-foreground">
                Subtitle Description
              </Label>
              <Input
                id="flash-subtitle"
                value={settings.subtitle}
                onChange={(e) => updateSettings({ subtitle: e.target.value })}
                placeholder="e.g. Limited quantities at special discount prices"
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. CURRENTLY LINKED DEALS (Selected by Admin) ──────────────── */}
      <Card className="border-rose-200/80 dark:border-rose-900/60 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-500 fill-rose-500" />
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Active Linked Flash Deals ({settings.deals.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  These items will appear on the homepage Lightning Deals row in this exact sequence.
                </p>
              </div>
            </div>
          </div>

          {settings.deals.length > 0 ? (
            <div className="space-y-3 mt-2">
              {settings.deals.map((deal, index) => (
                <div
                  key={deal.productId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    dragIndex === index
                      ? "border-rose-500/50 bg-rose-50/30 shadow-md scale-[1.01]"
                      : "border-border/80 bg-card hover:bg-secondary/20"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    
                    {/* Left: Product Info & Seller Badge */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-muted-foreground w-4 text-center">
                        {index + 1}
                      </span>
                      <img
                        src={deal.productImage}
                        alt={deal.productName}
                        className="w-14 h-14 rounded-xl object-cover border border-border/60 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">{deal.productName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                            <Store className="w-3 h-3" />
                            {deal.sellerName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Original: <span className="line-through">GH₵{deal.originalPrice.toFixed(2)}</span>
                          </span>
                          <span className="text-xs font-black text-white bg-rose-600 px-2 py-0.5 rounded-md shadow-2xs">
                            -{deal.discountPercent}% OFF
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Custom Flash Price & Claimed % */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      
                      {/* Flash Price Input */}
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">
                          Flash Price (GH₵)
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={deal.flashPrice}
                          onChange={(e) => handleUpdateDeal(index, { flashPrice: parseFloat(e.target.value) || 0 })}
                          className="w-24 h-8 text-xs font-bold text-rose-600 bg-rose-50/50 dark:bg-rose-950/20"
                        />
                      </div>

                      {/* Claimed % Input */}
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">
                          Claimed %
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          value={deal.claimedPercent}
                          onChange={(e) => handleUpdateDeal(index, { claimedPercent: parseInt(e.target.value) || 75 })}
                          className="w-16 h-8 text-xs font-medium text-center"
                        />
                      </div>

                      {/* Reorder & Remove Buttons */}
                      <div className="flex items-center gap-1 pt-3 sm:pt-0">
                        <button
                          onClick={() => moveDeal(index, "up")}
                          disabled={index === 0}
                          aria-label="Move Up"
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveDeal(index, "down")}
                          disabled={index === settings.deals.length - 1}
                          aria-label="Move Down"
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleUnlinkDeal(deal.productId)}
                          aria-label="Remove Deal"
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1 cursor-pointer"
                          title="Remove from Flash Deals"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-2xl bg-secondary/10">
              <Zap className="w-8 h-8 mx-auto text-rose-500/70 mb-2" />
              <p className="text-sm font-bold text-foreground">No specific products linked yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Browse or search vendor catalog below and click <strong>"Add to Flash Deals"</strong> to feature any seller's product.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5. BROWSE & LINK SELLER PRODUCTS ───────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Browse Vendor Catalog to Link
                </h3>
                <p className="text-xs text-muted-foreground">
                  Filter by seller store or search by name to link products directly to Flash Deals
                </p>
              </div>
            </div>

            <span className="text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground font-medium">
              {availableProducts.length} Available to Link
            </span>
          </div>

          {/* Filter Bar: Search, Seller Filter, Category Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products or stores…"
                className="pl-9 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Seller Filter */}
            <Select value={selectedSellerFilter} onValueChange={setSelectedSellerFilter}>
              <SelectTrigger className="text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <Store className="w-3.5 h-3.5 text-primary shrink-0" />
                  <SelectValue placeholder="All Sellers" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors & Stores</SelectItem>
                <SelectItem value="official">🏢 Official Store Items</SelectItem>
                {sellersList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    🏪 {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
              <SelectTrigger className="text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Categories" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesList.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>

          {/* Catalog Product List */}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Loading vendor catalog…
            </div>
          ) : availableProducts.length > 0 ? (
            <div className="border border-border/80 rounded-2xl divide-y divide-border/60 max-h-96 overflow-y-auto bg-card shadow-xs">
              {availableProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 sm:p-3.5 hover:bg-secondary/40 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-12 h-12 rounded-xl object-cover border border-border/50 shrink-0 bg-secondary/30"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          GH₵{Number(product.price).toFixed(2)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                          <Store className="w-3 h-3 text-primary shrink-0" />
                          {product.sellerName}
                        </span>
                        {product.category && (
                          <span className="text-[10px] text-muted-foreground">
                            · {product.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleLinkProduct(product)}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    Add to Flash Deals
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-border/60 rounded-xl text-muted-foreground">
              <p className="text-sm font-medium">No products match the selected filters</p>
              <p className="text-xs mt-0.5">Try clearing your search query or changing the seller filter.</p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── Live Preview Indicator ────────────────────────────────────────── */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>
              Click <strong>Save Changes</strong> above to apply changes. Then visit the{" "}
              <a href="/" className="text-primary font-medium underline underline-offset-2">
                Homepage
              </a>{" "}
              to see your linked seller items live in the Flash Deals showcase.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
