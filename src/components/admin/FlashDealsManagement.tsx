import { useState, useEffect, useMemo } from "react";
import {
  Zap, Eye, EyeOff, Search, X, GripVertical,
  Clock, Type, Save, RotateCcw, Sparkles, Loader2,
  Check, ChevronRight, ShoppingBag, Store, Flame,
  Percent, ArrowUp, ArrowDown, Calendar, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  seller_profiles?: { business_name?: string } | null;
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Live countdown for admin preview
  const { formattedHours, formattedMinutes, formattedSeconds, isExpired } = useCountdown(settings.endsAt);

  // Fetch all approved products and their seller info from Supabase
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, image, price, category, department, sale_price, seller_id, seller_profiles(business_name)")
          .order("created_at", { ascending: false })
          .limit(300);

        if (!error && data) {
          setAllProducts(data as any[]);
        }
      } catch (err) {
        console.error("Error loading products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
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
  };

  const setMidnightTonight = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    updateSettings({ endsAt: d.toISOString() });
  };

  const setTomorrowMidnight = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 999);
    updateSettings({ endsAt: d.toISOString() });
  };

  // Search results excluding already linked products
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const linkedIds = new Set(settings.deals.map((d) => d.productId));

    return allProducts
      .filter((p) => {
        if (linkedIds.has(p.id)) return false;
        const sellerName = p.seller_profiles?.business_name || "";
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          sellerName.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [searchQuery, allProducts, settings.deals]);

  // Link a product to flash deals
  const handleLinkProduct = (prod: ProductWithSeller) => {
    const originalPrice = Number(prod.price) || 100;
    // Default 25% off flash sale price
    const flashPrice = Math.round(originalPrice * 0.75 * 100) / 100;
    const discountPercent = Math.round(((originalPrice - flashPrice) / originalPrice) * 100);
    const sellerName = prod.seller_profiles?.business_name || "Store Product";

    const newDeal: LinkedFlashDeal = {
      productId: prod.id,
      productName: prod.name,
      productImage: prod.image,
      originalPrice,
      flashPrice,
      discountPercent,
      claimedPercent: 75,
      sellerName,
      category: prod.category,
      department: prod.department,
    };

    updateSettings({
      deals: [...settings.deals, newDeal],
    });
    setSearchQuery("");
  };

  // Unlink deal
  const handleUnlinkDeal = (productId: string) => {
    updateSettings({
      deals: settings.deals.filter((d) => d.productId !== productId),
    });
  };

  // Update specific deal price or claimed %
  const handleUpdateDeal = (index: number, patch: Partial<LinkedFlashDeal>) => {
    const updated = [...settings.deals];
    const item = { ...updated[index], ...patch };

    if (patch.flashPrice !== undefined) {
      const original = item.originalPrice;
      const flash = Number(patch.flashPrice) || 0;
      item.discountPercent = original > 0 ? Math.max(1, Math.round(((original - flash) / original) * 100)) : 0;
    }

    updated[index] = item;
    updateSettings({ deals: updated });
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
    setSettings((prev) => ({ ...prev, deals: updated }));
    setDragIndex(index);
    setHasChanges(true);
  };
  const handleDragEnd = () => setDragIndex(null);

  // Save changes
  const handleSave = () => {
    setSaving(true);
    saveSettings(settings);
    setTimeout(() => {
      setSaving(false);
      setHasChanges(false);
      toast({
        title: "Flash Deals updated! ⚡",
        description: "Homepage Lightning Deals & timer are now live with your changes.",
      });
    }, 400);
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
                Live Deals
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Link seller products, set promotional discount prices, and manage the countdown clock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-md"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          You have unsaved changes. Click <strong>Save Changes</strong> to update the homepage.
        </div>
      )}

      {/* ── 1. Enable/Disable ─────────────────────────────────────────── */}
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
                    ? "Lightning Deals showcase and countdown timer are visible to all visitors"
                    : "The Flash Deals section is temporarily hidden"}
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
                className="text-xs font-medium"
              >
                +6 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimerPreset(12)}
                className="text-xs font-medium"
              >
                +12 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimerPreset(24)}
                className="text-xs font-medium"
              >
                +24 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setMidnightTonight}
                className="text-xs font-medium"
              >
                Tonight @ Midnight
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setTomorrowMidnight}
                className="text-xs font-medium"
              >
                Tomorrow @ Midnight
              </Button>
            </div>
          </div>

          {/* Custom Date Time Picker */}
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="custom-end-time" className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Or Pick Exact End Date & Time:
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

      {/* ── 4. Linked Seller Products ──────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Linked Flash Deal Products</h3>
              <span className="text-[11px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-bold">
                {settings.deals.length} Linked
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            Search any seller's products to link them to Flash Deals. You can set custom flash sale prices and claimed progress.
          </p>

          {/* Search to Link */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title, category, or seller store name…"
              className="pl-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="border border-border rounded-xl divide-y divide-border max-h-72 overflow-y-auto bg-card shadow-lg">
              {searchResults.map((product) => {
                const sellerName = product.seller_profiles?.business_name || "Official Store";
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 hover:bg-secondary/60 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover border border-border/50 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            GH₵{Number(product.price).toFixed(2)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                            <Store className="w-3 h-3 text-primary" />
                            {sellerName}
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
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1 shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      Add to Flash Deals
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No matching products or sellers found.
            </p>
          )}

          {/* List of Linked Deals */}
          {settings.deals.length > 0 ? (
            <div className="space-y-3 mt-4">
              {settings.deals.map((deal, index) => (
                <div
                  key={deal.productId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-3.5 rounded-xl border transition-all ${
                    dragIndex === index
                      ? "border-rose-500/50 bg-rose-50/20 shadow-md scale-[1.01]"
                      : "border-border/70 bg-card hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    
                    {/* Left info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground w-4 text-center">
                        {index + 1}
                      </span>
                      <img
                        src={deal.productImage}
                        alt={deal.productName}
                        className="w-12 h-12 rounded-lg object-cover border border-border/50 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{deal.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <Store className="w-3 h-3 text-primary" />
                            {deal.sellerName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Regular: <span className="line-through">GH₵{deal.originalPrice.toFixed(2)}</span>
                          </span>
                          <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                            -{deal.discountPercent}% OFF
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Controls: Custom Price & Claimed % */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      
                      {/* Flash Price Input */}
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
                          Flash Price (GH₵):
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={deal.flashPrice}
                          onChange={(e) => handleUpdateDeal(index, { flashPrice: parseFloat(e.target.value) || 0 })}
                          className="w-20 h-8 text-xs font-bold"
                        />
                      </div>

                      {/* Claimed % Input */}
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
                          Claimed %:
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          value={deal.claimedPercent}
                          onChange={(e) => handleUpdateDeal(index, { claimedPercent: parseInt(e.target.value) || 75 })}
                          className="w-16 h-8 text-xs font-medium"
                        />
                      </div>

                      {/* Reorder & Remove */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveDeal(index, "up")}
                          disabled={index === 0}
                          aria-label="Move Up"
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveDeal(index, "down")}
                          disabled={index === settings.deals.length - 1}
                          aria-label="Move Down"
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleUnlinkDeal(deal.productId)}
                          aria-label="Remove Deal"
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
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
            <div className="text-center py-6 border border-dashed border-border rounded-xl bg-secondary/10">
              <Zap className="w-6 h-6 mx-auto text-rose-500/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No specific products linked yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Search products above to link sellers' items, or let the homepage auto-populate with trending discounted items.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading vendor catalog…
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Live Preview Indicator ────────────────────────────────────────── */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>
              Changes are immediately applied to the storefront when saved. Check the{" "}
              <a href="/" className="text-primary font-medium underline underline-offset-2">
                Homepage
              </a>{" "}
              to view your live Lightning Deals.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
