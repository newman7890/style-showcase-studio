import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Trash2, Save, History, Star, MapPin, Building2, Globe, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface DeliveryFee {
  id: string;
  region: string;
  city: string | null;
  town: string | null;
  fee: number;
  is_active: boolean;
  is_default: boolean;
}

interface AuditEntry {
  id: string;
  delivery_fee_id: string | null;
  action: string;
  changed_by_email: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
}

const AUDITED_FIELDS = ["region", "city", "town", "fee", "is_active", "is_default"] as const;

const GHANA_TOWN_PRESETS: Record<string, string[]> = {
  "Accra": ["East Legon", "Osu", "Madina", "Spintex", "Dansoman", "Adenta", "Legon", "Cantonments", "Lapaz", "Achimota", "Airport Residential", "Labone", "Kaneshie", "Weija", "Dome", "Dzorwulu", "Haatso", "Sakumono"],
  "Tema": ["Community 1", "Community 2", "Community 6", "Community 10", "Community 25"],
  "Kumasi": ["Adum", "Ayigya", "Bantama", "KNUST", "Suame", "Asokwa", "Nhyiaeso", "Kenyasi", "Tafo", "Adugyama"],
  "Takoradi": ["Market Circle", "Fijai", "Kojokrom", "Effiakuma"],
  "Tamale": ["Central", "Lamashegu", "Nyohini", "Vitting"],
  "Cape Coast": ["University", "Pedu", "Abura", "Kotokuraba"],
  "Koforidua": ["Central", "Mile 50", "Effiduase", "Asokore"],
  "Ho": ["Central", "Kpodzi", "Bankoe", "Ahamansu"],
  "Sunyani": ["Central", "Fiapre", "Penkwase"],
};

export const DeliveryFeeManagement = () => {
  const [fees, setFees] = useState<DeliveryFee[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newRegion, setNewRegion] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newTown, setNewTown] = useState("");
  const [newFee, setNewFee] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<string[]>([]);

  // Modal State for adding town/location
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRegion, setModalRegion] = useState("");
  const [modalCity, setModalCity] = useState("");
  const [modalTown, setModalTown] = useState("");
  const [modalFee, setModalFee] = useState("");

  const openAddModal = (reg: string = "", city: string = "") => {
    setModalRegion(reg || newRegion || "Greater Accra");
    setModalCity(city || newCity || "Accra");
    setModalTown("");
    setModalFee("");
    setModalOpen(true);
  };

  const handleModalSave = async () => {
    if (!modalTown.trim()) {
      toast.error("Please type or click a Town / Area name (e.g., East Legon, Osu, Madina)");
      return;
    }
    const success = await addRow(modalRegion, modalCity, modalTown, modalFee);
    if (success === true) {
      setModalOpen(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const [feesRes, auditRes] = await Promise.all([
      supabase.from("delivery_fees").select("*").order("is_default", { ascending: false }).order("region", { ascending: true }),
      supabase.from("delivery_fee_audit").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (feesRes.error) toast.error("Failed to load delivery fees");
    else {
      const fetched = (feesRes.data as DeliveryFee[]) ?? [];
      setFees(fetched);
      // Auto expand regions on first load
      const regionNames = Array.from(new Set(fetched.map((f) => f.region)));
      setExpandedRegions(regionNames);
    }
    if (!auditRes.error) setAudit((auditRes.data as AuditEntry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (id: string, patch: Partial<DeliveryFee>) => {
    setFees((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const friendlyError = (err: any): string => {
    const msg = err?.message || "";
    if (err?.code === "23505" || /duplicate/i.test(msg) || /unique/i.test(msg)) {
      if (/only_one_default/i.test(msg)) return "Only one default delivery fee is allowed. Unset the existing default first.";
      return "A delivery fee for that specific region, city, and town already exists. Edit the existing row instead.";
    }
    return msg || "Something went wrong.";
  };

  const saveRow = async (row: DeliveryFee) => {
    if (!row.region.trim()) {
      toast.error("Region cannot be empty");
      return;
    }
    setSavingId(row.id);
    const { error } = await supabase
      .from("delivery_fees")
      .update({
        region: row.region.trim(),
        city: row.city?.trim() || null,
        town: row.town?.trim() || null,
        fee: Number(row.fee) || 0,
        is_active: row.is_active,
        is_default: row.is_default,
      })
      .eq("id", row.id);
    setSavingId(null);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Delivery fee updated");
      load();
    }
  };

  const deleteRow = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error("You cannot delete the default delivery fee. Mark another row as default first.");
      return;
    }
    if (!confirm("Delete this delivery fee?")) return;
    const { error } = await supabase.from("delivery_fees").delete().eq("id", id);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Deleted");
      load();
    }
  };

  const addRow = async (customRegion?: string, customCity?: string, customTown?: string, customFeeVal?: string): Promise<boolean> => {
    const r = (customRegion !== undefined ? customRegion : newRegion).trim();
    const c = (customCity !== undefined ? customCity : newCity).trim();
    const t = (customTown !== undefined ? customTown : newTown).trim();
    const fStr = customFeeVal !== undefined ? customFeeVal : newFee;

    if (!r) {
      toast.error("Region is required");
      return false;
    }
    const fee = Number(fStr);
    if (isNaN(fee) || fee < 0) {
      toast.error("Enter a valid fee");
      return false;
    }

    const dup = fees.find(
      (item) =>
        item.region.trim().toLowerCase() === r.toLowerCase() &&
        (item.city ?? "").trim().toLowerCase() === c.toLowerCase() &&
        (item.town ?? "").trim().toLowerCase() === t.toLowerCase()
    );
    if (dup) {
      toast.error(`A fee for "${r}${c ? " > " + c : ""}${t ? " > " + t : ""}" already exists.`);
      return false;
    }

    setAdding(true);
    const { error } = await supabase
      .from("delivery_fees")
      .insert({
        region: r,
        city: c || null,
        town: t || null,
        fee,
        is_active: true,
      });
    setAdding(false);
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    toast.success("Location added");
    if (customRegion === undefined) {
      setNewRegion("");
      setNewCity("");
      setNewTown("");
      setNewFee("");
    }
    load();
    return true;
  };

  // Group fees hierarchically: Region -> City -> Towns
  const groupedTree = useMemo(() => {
    const filtered = fees.filter((f) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.region.toLowerCase().includes(q) ||
        (f.city && f.city.toLowerCase().includes(q)) ||
        (f.town && f.town.toLowerCase().includes(q)) ||
        String(f.fee).includes(q)
      );
    });

    const map = new Map<
      string,
      {
        region: string;
        regionBaseFee?: DeliveryFee;
        citiesMap: Map<string, { cityName: string; cityBaseFee?: DeliveryFee; towns: DeliveryFee[] }>;
        standaloneTowns: DeliveryFee[];
      }
    >();

    for (const f of filtered) {
      const regKey = f.region.trim();
      if (!map.has(regKey)) {
        map.set(regKey, {
          region: regKey,
          citiesMap: new Map(),
          standaloneTowns: [],
        });
      }
      const regGroup = map.get(regKey)!;

      const cityName = f.city?.trim();
      const townName = f.town?.trim();

      if (!cityName && !townName) {
        regGroup.regionBaseFee = f;
      } else if (cityName) {
        if (!regGroup.citiesMap.has(cityName)) {
          regGroup.citiesMap.set(cityName, { cityName, towns: [] });
        }
        const cityGroup = regGroup.citiesMap.get(cityName)!;
        if (!townName) {
          cityGroup.cityBaseFee = f;
        } else {
          cityGroup.towns.push(f);
        }
      } else if (townName) {
        regGroup.standaloneTowns.push(f);
      }
    }

    return Array.from(map.values());
  }, [fees, searchQuery]);

  const presetTowns = GHANA_TOWN_PRESETS[newCity.trim()] || [];

  const formatDate = (s: string) =>
    new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const renderDiff = (entry: AuditEntry) => {
    if (entry.action === "created") {
      return (
        <div className="text-xs space-y-0.5">
          {AUDITED_FIELDS.map((k) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span>{" "}
              <span className="font-mono">{String(entry.new_values?.[k] ?? "—")}</span>
            </div>
          ))}
        </div>
      );
    }
    if (entry.action === "deleted") {
      return (
        <div className="text-xs space-y-0.5">
          {AUDITED_FIELDS.map((k) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span>{" "}
              <span className="font-mono line-through opacity-70">{String(entry.old_values?.[k] ?? "—")}</span>
            </div>
          ))}
        </div>
      );
    }
    const changes = AUDITED_FIELDS.filter(
      (k) => String(entry.old_values?.[k] ?? "") !== String(entry.new_values?.[k] ?? "")
    );
    if (changes.length === 0) return <span className="text-xs text-muted-foreground">No tracked changes</span>;
    return (
      <div className="text-xs space-y-0.5">
        {changes.map((k) => (
          <div key={k}>
            <span className="text-muted-foreground">{k}:</span>{" "}
            <span className="font-mono line-through opacity-70">{String(entry.old_values?.[k] ?? "—")}</span>
            {" → "}
            <span className="font-mono font-semibold">{String(entry.new_values?.[k] ?? "—")}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Delivery Fees Management</h2>
          <p className="text-sm text-muted-foreground">
            Structured hierarchy: <strong>Region → City → Town/Area</strong>. Lookup order at checkout: <strong>Town → City → Region → Default</strong>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="w-4 h-4 mr-1" /> View history
        </Button>
      </div>

      {/* Add new Form */}
      <div className="border border-border rounded-lg p-5 bg-card space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Add New Delivery Location Fee</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-region" className="text-xs">Region *</Label>
            <Input id="new-region" placeholder="e.g. Greater Accra" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-city" className="text-xs">City (optional)</Label>
            <Input id="new-city" placeholder="e.g. Accra" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-town" className="text-xs">Town / Area (optional)</Label>
            <Input id="new-town" placeholder="e.g. East Legon, Osu" value={newTown} onChange={(e) => setNewTown(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-fee" className="text-xs">Fee (GH₵) *</Label>
            <Input id="new-fee" type="number" min="0" step="0.01" placeholder="0.00" value={newFee} onChange={(e) => setNewFee(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => addRow()} disabled={adding} className="w-full">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add Location</>}
            </Button>
          </div>
        </div>

        {/* Preset Town Suggestions */}
        {presetTowns.length > 0 && (
          <div className="pt-1 border-t border-border/50">
            <span className="text-xs text-muted-foreground mr-2 font-medium">Quick Town Shortcuts for {newCity}:</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {presetTowns.map((tName) => (
                <Badge
                  key={tName}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs py-1 px-2.5 transition-colors"
                  onClick={() => setNewTown(tName)}
                >
                  + {tName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search & Tree Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search regions, cities, or towns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedRegions(groupedTree.map((g) => g.region))}
            className="text-xs"
          >
            Expand All
          </Button>
          <span className="text-muted-foreground">•</span>
          <Button variant="ghost" size="sm" onClick={() => setExpandedRegions([])} className="text-xs">
            Collapse All
          </Button>
        </div>
      </div>

      {/* Grouped Accordion Tree */}
      {groupedTree.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground bg-card">
          <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-base font-medium">No delivery fees configured</p>
          <p className="text-xs mt-1">Add your first region or town above to get started.</p>
        </div>
      ) : (
        <Accordion type="multiple" value={expandedRegions} onValueChange={setExpandedRegions} className="space-y-4">
          {groupedTree.map((regGroup) => {
            const citiesList = Array.from(regGroup.citiesMap.values());
            const totalItemsCount =
              (regGroup.regionBaseFee ? 1 : 0) +
              citiesList.reduce((acc, c) => acc + (c.cityBaseFee ? 1 : 0) + c.towns.length, 0) +
              regGroup.standaloneTowns.length;

            return (
              <AccordionItem
                key={regGroup.region}
                value={regGroup.region}
                className="border border-border rounded-lg overflow-hidden bg-card shadow-sm"
              >
                {/* Region Header */}
                <AccordionTrigger className="px-5 py-4 hover:no-underline bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 text-left">
                    <Globe className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <span className="text-base font-semibold">{regGroup.region} Region</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {totalItemsCount} location{totalItemsCount === 1 ? "" : "s"}
                        </Badge>
                        {regGroup.regionBaseFee && (
                          <span className="text-xs text-muted-foreground">
                            Base Region Fee: <strong className="text-foreground">GH₵ {regGroup.regionBaseFee.fee}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="p-5 space-y-5">
                  {/* Base Region Row */}
                  {regGroup.regionBaseFee && (
                    <div className="p-3 border border-primary/20 bg-primary/5 rounded-md flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        {regGroup.regionBaseFee.is_default && <Star className="w-4 h-4 text-primary fill-primary" />}
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base Region Fee:</span>
                        <span className="text-sm font-medium">{regGroup.region} (Entire Region)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">GH₵</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={regGroup.regionBaseFee.fee}
                            onChange={(e) => updateField(regGroup.regionBaseFee!.id, { fee: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-24"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Active</span>
                          <Switch
                            checked={regGroup.regionBaseFee.is_active}
                            onCheckedChange={(checked) => updateField(regGroup.regionBaseFee!.id, { is_active: checked })}
                          />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => saveRow(regGroup.regionBaseFee!)} disabled={savingId === regGroup.regionBaseFee.id}>
                          {savingId === regGroup.regionBaseFee.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRow(regGroup.regionBaseFee!.id, regGroup.regionBaseFee!.is_default)}
                          disabled={regGroup.regionBaseFee.is_default}
                          className="text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Cities & Towns Tree */}
                  {citiesList.map((cityGroup) => (
                    <div key={cityGroup.cityName} className="border border-border rounded-lg p-4 bg-background space-y-3">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-bold">{cityGroup.cityName} City</h4>
                          <Badge variant="secondary" className="text-[10px]">
                            {cityGroup.towns.length} Town{cityGroup.towns.length === 1 ? "" : "s"}
                          </Badge>
                        </div>

                        {/* City Base Fee if exists */}
                        {cityGroup.cityBaseFee && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">City Base Fee:</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={cityGroup.cityBaseFee.fee}
                              onChange={(e) => updateField(cityGroup.cityBaseFee!.id, { fee: parseFloat(e.target.value) || 0 })}
                              className="h-7 w-20 text-xs"
                            />
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveRow(cityGroup.cityBaseFee!)}>
                              <Save className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Towns List under this City */}
                      {cityGroup.towns.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-1">No specific towns added for {cityGroup.cityName} yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                          {cityGroup.towns.map((tItem) => (
                            <div key={tItem.id} className="p-3 border border-border/80 rounded-md bg-muted/20 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="text-xs font-semibold truncate" title={tItem.town || ""}>
                                  {tItem.town}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] text-muted-foreground">GH₵</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={tItem.fee}
                                  onChange={(e) => updateField(tItem.id, { fee: parseFloat(e.target.value) || 0 })}
                                  className="h-7 w-16 text-xs px-1.5"
                                />
                                <Switch
                                  checked={tItem.is_active}
                                  onCheckedChange={(checked) => updateField(tItem.id, { is_active: checked })}
                                  className="scale-75"
                                />
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveRow(tItem)}>
                                  <Save className="w-3 h-3 text-foreground" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteRow(tItem.id, tItem.is_default)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Standalone Towns (Towns added directly under region without specifying a city) */}
                  {regGroup.standaloneTowns.length > 0 && (
                    <div className="border border-border rounded-lg p-4 bg-background space-y-3">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-bold">Towns & Areas (Direct Region)</h4>
                          <Badge variant="secondary" className="text-[10px]">
                            {regGroup.standaloneTowns.length} Town{regGroup.standaloneTowns.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                        {regGroup.standaloneTowns.map((tItem) => (
                          <div key={tItem.id} className="p-3 border border-border/80 rounded-md bg-muted/20 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="text-xs font-semibold truncate" title={tItem.town || ""}>
                                {tItem.town}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-muted-foreground">GH₵</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={tItem.fee}
                                onChange={(e) => updateField(tItem.id, { fee: parseFloat(e.target.value) || 0 })}
                                className="h-7 w-16 text-xs px-1.5"
                              />
                              <Switch
                                checked={tItem.is_active}
                                onCheckedChange={(checked) => updateField(tItem.id, { is_active: checked })}
                                className="scale-75"
                              />
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveRow(tItem)}>
                                <Save className="w-3 h-3 text-foreground" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteRow(tItem.id, tItem.is_default)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state prompt for adding cities/towns to this region */}
                  {citiesList.length === 0 && regGroup.standaloneTowns.length === 0 && (
                    <div className="p-4 border border-dashed border-border rounded-lg text-center bg-muted/10">
                      <p className="text-xs text-muted-foreground">No cities or towns added under {regGroup.region} yet.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => openAddModal(regGroup.region, "Accra")}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add a Town to {regGroup.region}
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Add Location Modal Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Add Delivery Town / Location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="modal-region" className="text-xs">Region *</Label>
              <Input
                id="modal-region"
                value={modalRegion}
                onChange={(e) => setModalRegion(e.target.value)}
                placeholder="e.g. Greater Accra"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="modal-city" className="text-xs">City (optional)</Label>
              <Input
                id="modal-city"
                value={modalCity}
                onChange={(e) => setModalCity(e.target.value)}
                placeholder="e.g. Accra, Tema, Kumasi"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="modal-town" className="text-xs">Town / Sub-Area *</Label>
              <Input
                id="modal-town"
                value={modalTown}
                onChange={(e) => setModalTown(e.target.value)}
                placeholder="e.g. East Legon, Osu, Madina, Spintex"
              />
            </div>

            {/* Quick Town Suggestions in Modal */}
            {modalCity.trim() && GHANA_TOWN_PRESETS[modalCity.trim()] && (
              <div className="pt-1">
                <span className="text-xs text-muted-foreground font-medium">Quick Town Suggestions:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto">
                  {GHANA_TOWN_PRESETS[modalCity.trim()].map((tName) => (
                    <Badge
                      key={tName}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs py-0.5 px-2"
                      onClick={() => setModalTown(tName)}
                    >
                      + {tName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="modal-fee" className="text-xs">Delivery Fee (GH₵) *</Label>
              <Input
                id="modal-fee"
                type="number"
                min="0"
                step="0.01"
                value={modalFee}
                onChange={(e) => setModalFee(e.target.value)}
                placeholder="20.00"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleModalSave} disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save Location Fee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Delivery fee history</DialogTitle>
          </DialogHeader>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No changes recorded yet.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {audit.map((a) => (
                <div key={a.id} className="border border-border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={a.action === "created" ? "default" : a.action === "deleted" ? "destructive" : "secondary"}
                        className="text-[10px] uppercase"
                      >
                        {a.action}
                      </Badge>
                      <span className="text-xs font-medium">
                        {a.new_values?.region || a.old_values?.region || "—"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>{a.changed_by_email || "system"}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(a.created_at)}</span>
                    </div>
                  </div>
                  {renderDiff(a)}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
