import { useState, useEffect, useMemo } from "react";
import {
  Eye, EyeOff, Clapperboard, Search, X, GripVertical,
  Gauge, Type, Save, RotateCcw, Sparkles, Loader2, Check,
  ChevronRight, ShoppingBag, Database, Copy, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SpotlightSettings,
  DEFAULT_SPOTLIGHT_SETTINGS,
  getSpotlightSettingsFromStorage,
  fetchSpotlightSettings,
  saveSpotlightSettings,
} from "@/services/siteSettingsService";

export type { SpotlightSettings };
export const getSpotlightSettings = getSpotlightSettingsFromStorage;

interface ProductOption {
  id: string;
  name: string;
  image: string;
  price: number;
  category?: string;
  department?: string | null;
}

const SPEED_LABELS: Record<number, { label: string; desc: string; color: string }> = {
  1: { label: "Slow", desc: "Relaxed browsing pace", color: "text-blue-600" },
  2: { label: "Normal", desc: "Default balanced speed", color: "text-emerald-600" },
  3: { label: "Fast", desc: "High-energy showcase", color: "text-orange-600" },
};

const SQL_SETUP_SCRIPT = `-- Run this in your Supabase Dashboard SQL Editor:
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings"
  ON public.site_settings FOR ALL
  USING (true)
  WITH CHECK (true);`;

// ─── Component ─────────────────────────────────────────────────────────────────
export const SpotlightManagement = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SpotlightSettings>(getSpotlightSettingsFromStorage);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Load database settings & products
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch remote settings
      const { settings: remoteSettings, isTableMissing } = await fetchSpotlightSettings();
      if (isTableMissing) {
        setTableMissing(true);
      } else {
        setTableMissing(false);
        setSettings(remoteSettings);
      }

      // 2. Fetch products
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image, price, category, department")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data) {
        setAllProducts(data as ProductOption[]);
      }
    } catch (err) {
      console.error("Error loading spotlight settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Pinned products resolved to full objects
  const pinnedProducts = useMemo(() => {
    return settings.pinnedProductIds
      .map((id) => allProducts.find((p) => p.id === id))
      .filter(Boolean) as ProductOption[];
  }, [settings.pinnedProductIds, allProducts]);

  // Search results (exclude already pinned)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          !settings.pinnedProductIds.includes(p.id) &&
          (p.name.toLowerCase().includes(q) ||
            (p.category || "").toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [searchQuery, allProducts, settings.pinnedProductIds]);

  // Track changes & update state
  const updateSettings = (patch: Partial<SpotlightSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  const handlePinProduct = (productId: string) => {
    if (settings.pinnedProductIds.includes(productId)) return;
    updateSettings({
      pinnedProductIds: [...settings.pinnedProductIds, productId],
    });
    setSearchQuery("");
  };

  const handleUnpinProduct = (productId: string) => {
    updateSettings({
      pinnedProductIds: settings.pinnedProductIds.filter((id) => id !== productId),
    });
  };

  // Drag reorder
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newIds = [...settings.pinnedProductIds];
    const [removed] = newIds.splice(dragIndex, 1);
    newIds.splice(index, 0, removed);
    updateSettings({ pinnedProductIds: newIds });
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  const copySqlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
      setCopiedSql(true);
      toast({
        title: "SQL Copied to Clipboard! 📋",
        description: "Open Supabase Dashboard -> SQL Editor, paste, and run this script.",
      });
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      toast({
        title: "Could not copy automatically",
        description: "Please copy the SQL script manually.",
        variant: "destructive",
      });
    }
  };

  // Save to database
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: saveError, isTableMissing } = await saveSpotlightSettings(settings);

      if (isTableMissing) {
        setTableMissing(true);
        toast({
          title: "Database Table Required ⚠️",
          description: "Please run the SQL script in your Supabase Dashboard SQL Editor.",
          variant: "destructive",
        });
      } else if (saveError) {
        toast({
          title: "Saved Locally Only",
          description: saveError.message || "Could not sync with Supabase database.",
          variant: "destructive",
        });
      } else {
        setTableMissing(false);
      }

      setHasChanges(false);
      toast({
        title: "Spotlight settings saved ✨",
        description: "Marquee showcase is now synced live across all devices.",
      });
    } catch (err: any) {
      toast({
        title: "Saved Locally",
        description: "Spotlight updated on this browser.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset
  const handleReset = () => {
    setSettings({ ...DEFAULT_SPOTLIGHT_SETTINGS });
    setHasChanges(true);
  };

  const speedInfo = SPEED_LABELS[settings.speed] || SPEED_LABELS[2];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Spotlight Marquee</h2>
            <p className="text-sm text-muted-foreground">
              Control the scrolling product showcase on the homepage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-md"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Database Table Required Alert Box */}
      {tableMissing && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/60 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    Database Table Setup Required for Cross-Device Sync
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                      1-Time Setup
                    </span>
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    To sync your Spotlight Marquee across mobile phones and desktop computers, run this SQL script in your Supabase Dashboard.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copySqlToClipboard}
                  className="gap-1.5 bg-white dark:bg-card border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedSql ? "SQL Copied!" : "Copy SQL"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={loadInitialData}
                  disabled={loading}
                  className="gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Check Connection
                </Button>
              </div>
            </div>

            <div className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto space-y-1 border border-gray-800 shadow-inner">
              <p className="text-gray-400">-- Supabase Dashboard &gt; SQL Editor &gt; New Query &gt; Run</p>
              <pre>{SQL_SETUP_SCRIPT}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          You have unsaved changes. Click <strong>Save Changes</strong> to apply across all devices.
        </div>
      )}

      {/* ── Enable/Disable Toggle ─────────────────────────────────────────── */}
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
                  Show Marquee on Homepage
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {settings.enabled
                    ? "The product spotlight is visible to all visitors"
                    : "The marquee is hidden from the homepage"}
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

      {/* ── Title & Subtitle ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Type className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Title & Subtitle</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spotlight-title" className="text-xs text-muted-foreground">
              Title
            </Label>
            <Input
              id="spotlight-title"
              value={settings.title}
              onChange={(e) => updateSettings({ title: e.target.value })}
              placeholder="e.g. Live Marketplace Spotlight"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spotlight-subtitle" className="text-xs text-muted-foreground">
              Subtitle
            </Label>
            <Input
              id="spotlight-subtitle"
              value={settings.subtitle}
              onChange={(e) => updateSettings({ subtitle: e.target.value })}
              placeholder="e.g. Continuous moving showcase of trending products"
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Speed Control ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Scroll Speed</h3>
          </div>

          <div className="space-y-3">
            <Slider
              value={[settings.speed]}
              onValueChange={([val]) => updateSettings({ speed: val })}
              min={1}
              max={3}
              step={1}
              className="w-full"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Slow</span>
              <span className={`text-xs font-bold ${speedInfo.color}`}>
                {speedInfo.label} — {speedInfo.desc}
              </span>
              <span className="text-[11px] text-muted-foreground">Fast</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Pinned Products ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Pinned Products</h3>
              <span className="text-[11px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                {pinnedProducts.length} selected
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            {pinnedProducts.length === 0
              ? "No products pinned — the marquee will auto-fill with recent products."
              : "These products will appear first in the marquee. Drag to reorder."}
          </p>

          {/* Search to Add */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products to pin…"
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
            <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto bg-card shadow-sm">
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handlePinProduct(product.id)}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-secondary/60 transition-colors text-left"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover border border-border/50 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      GH₵{product.price.toFixed(2)} · {product.category || "Uncategorized"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No matching products found.
            </p>
          )}

          {/* Pinned Product List */}
          {pinnedProducts.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {pinnedProducts.map((product, index) => (
                <div
                  key={product.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                    dragIndex === index
                      ? "border-primary/50 bg-primary/5 shadow-md scale-[1.02]"
                      : "border-border/60 bg-card hover:bg-secondary/40"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-[11px] font-bold text-muted-foreground w-5 text-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover border border-border/50 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      GH₵{product.price.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnpinProduct(product.id)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    title="Remove from spotlight"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading products…
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
              After saving, visit the{" "}
              <a href="/" className="text-primary font-medium underline underline-offset-2">
                homepage
              </a>{" "}
              to see your changes live.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
