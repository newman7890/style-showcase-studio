import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Plus, Pencil, Trash2, Eye, EyeOff, ImageIcon, Save, X, FolderOpen, Upload, Loader2, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRESET_FASHION_CATEGORIES,
  PRESET_GADGETS_CATEGORIES,
  PRESET_ART_CATEGORIES,
  PRESET_OTHER_CATEGORIES,
  PRESET_HOME_CATEGORIES,
  PRESET_CATEGORIES_BY_DEPARTMENT,
  CategoryItem,
} from "@/constants/categories";

interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  display_order: number;
  is_active: boolean;
  department?: string;
  created_at?: string;
}

interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
}

export const CategoryManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formDepartment, setFormDepartment] = useState("fashion");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignCategory, setAssignCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);

  // Admin Search & Department Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `categories/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file);
      if (uploadErr) throw uploadErr;

      const pubUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      setFormImage(pubUrl);
      toast({ title: "Image uploaded successfully!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from("categories").select("*").order("display_order", { ascending: true }),
        supabase.from("products").select("id, name, image, category"),
      ]);

      const dbCats: Category[] = (catRes.data as Category[]) || [];
      const dbSlugs = new Set(dbCats.map((c) => c.slug));

      // Flatten presets
      const allPresets: CategoryItem[] = [
        ...PRESET_FASHION_CATEGORIES,
        ...PRESET_GADGETS_CATEGORIES,
        ...PRESET_ART_CATEGORIES,
        ...PRESET_OTHER_CATEGORIES,
        ...PRESET_HOME_CATEGORIES,
      ];

      // Merge missing presets into category list so admin can edit them all
      let orderCounter = dbCats.length + 1;
      const missingPresets: Category[] = allPresets
        .filter((p) => !dbSlugs.has(p.slug))
        .map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          department: p.department,
          image: p.image || null,
          display_order: orderCounter++,
          is_active: true,
          created_at: new Date().toISOString(),
        }));

      setCategories([...dbCats, ...missingPresets]);
      setProducts(prodRes.data || []);
    } catch {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPresetsToDb = async () => {
    setSyncing(true);
    try {
      const allPresets: CategoryItem[] = [
        ...PRESET_FASHION_CATEGORIES,
        ...PRESET_GADGETS_CATEGORIES,
        ...PRESET_ART_CATEGORIES,
        ...PRESET_OTHER_CATEGORIES,
        ...PRESET_HOME_CATEGORIES,
      ];
      let order = 1;
      const rows = allPresets.map((p) => ({
        name: p.name,
        slug: p.slug,
        department: p.department,
        image: p.image || null,
        is_active: true,
        display_order: order++,
      }));

      const { error } = await supabase.from("categories").upsert(rows, { onConflict: "slug" });
      if (error) throw error;

      toast({
        title: "All Preset Categories Synced! 🎉",
        description: `Successfully stored ${rows.length} categories to the database.`,
      });
      fetchData();
    } catch (err: any) {
      toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const openCreate = () => {
    setEditingCategory(null);
    setFormName("");
    setFormSlug("");
    setFormImage("");
    setFormDepartment("fashion");
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormImage(cat.image || "");
    setFormDepartment(cat.department || "fashion");
    setFormActive(cat.is_active);
    setDialogOpen(true);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingCategory) setFormSlug(generateSlug(val));
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) {
      toast({ title: "Name and slug are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName,
        slug: formSlug,
        image: formImage || null,
        is_active: formActive,
        department: formDepartment,
      };

      const { error } = await supabase
        .from("categories")
        .upsert(
          editingCategory ? { ...payload, id: editingCategory.id } : { ...payload, display_order: categories.length + 1 },
          { onConflict: "slug" }
        );

      if (error) throw error;
      toast({ title: editingCategory ? "Category updated" : "Category created" });
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: err.message || "Error saving category", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting category", variant: "destructive" });
    } else {
      toast({ title: "Category deleted" });
      fetchData();
    }
  };

  const handleToggleActive = async (cat: Category) => {
    const { error } = await supabase
      .from("categories")
      .upsert({ slug: cat.slug, name: cat.name, department: cat.department || "fashion", is_active: !cat.is_active }, { onConflict: "slug" });
    if (!error) fetchData();
  };

  const moveCategory = async (cat: Category, direction: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === cat.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;
    const other = categories[swapIdx];
    await Promise.all([
      supabase.from("categories").update({ display_order: other.display_order }).eq("id", cat.id),
      supabase.from("categories").update({ display_order: cat.display_order }).eq("id", other.id),
    ]);
    fetchData();
  };

  const openAssign = (cat: Category) => {
    setAssignCategory(cat);
    setCategoryProducts(
      products.filter(
        (p) =>
          p.category === cat.slug ||
          p.category === cat.name ||
          p.category.toLowerCase() === cat.slug.toLowerCase() ||
          p.category.toLowerCase() === cat.name.toLowerCase()
      )
    );
    setAssignDialogOpen(true);
  };

  const assignProduct = async (productId: string, catName: string) => {
    const { error } = await supabase.from("products").update({ category: catName }).eq("id", productId);
    if (error) {
      toast({ title: "Error assigning product", variant: "destructive" });
    } else {
      toast({ title: "Product assigned" });
      fetchData();
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, category: catName } : p)));
      setCategoryProducts((prev) => {
        const product = products.find((p) => p.id === productId);
        return product ? [...prev, { ...product, category: catName }] : prev;
      });
    }
  };

  const unassignProduct = async (productId: string) => {
    const { error } = await supabase.from("products").update({ category: "Uncategorized" }).eq("id", productId);
    if (!error) {
      toast({ title: "Product removed from category" });
      fetchData();
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, category: "Uncategorized" } : p)));
      setCategoryProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const getProductCount = (catName: string, slug: string) =>
    products.filter(
      (p) =>
        p.category === catName ||
        p.category === slug ||
        p.category.toLowerCase() === catName.toLowerCase() ||
        p.category.toLowerCase() === slug.toLowerCase()
    ).length;

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchesDept = activeTab === "all" || c.department === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
      return matchesDept && matchesSearch;
    });
  }, [categories, activeTab, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <LayoutGrid className="w-5 h-5 text-primary" />
                Category Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage all {categories.length} categories across Fashion, Gadgets, Art, Home, & Other.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSyncPresetsToDb} disabled={syncing} variant="outline" size="sm" className="gap-2">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <RefreshCw className="w-4 h-4 text-primary" />}
                Sync to DB
              </Button>
              <Button onClick={openCreate} size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Add Category
              </Button>
            </div>
          </div>

          {/* Department Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t mt-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: "all", label: `All (${categories.length})` },
                { id: "fashion", label: "Fashion 👗" },
                { id: "gadgets", label: "Gadgets 📱" },
                { id: "art", label: "Art 🎨" },
                { id: "other", label: "Other 📦" },
                { id: "home", label: "Home 🏠" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-1">
            <AnimatePresence>
              {filteredCategories.map((cat, index) => (
                <motion.div
                  key={cat.id || cat.slug}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveCategory(cat, "up")}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveCategory(cat, "down")}
                      disabled={index === filteredCategories.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Image */}
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium truncate">{cat.name}</h4>
                      {cat.department && (
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">
                          {cat.department}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{cat.slug}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {getProductCount(cat.name, cat.slug)} products
                      </Badge>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggleActive(cat)} title={cat.is_active ? "Visible" : "Hidden"}>
                      {cat.is_active ? (
                        <Eye className="w-4 h-4 text-primary" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <button onClick={() => openAssign(cat)} title="Assign products">
                      <FolderOpen className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button onClick={() => openEdit(cat)} title="Edit Category">
                      <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)} title="Delete Category">
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredCategories.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No categories found for this filter.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Category Name</Label>
              <Input value={formName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. T-Shirts" />
            </div>
            <div>
              <Label>Slug (URL-friendly)</Label>
              <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="e.g. t-shirts" className="font-mono text-sm" />
            </div>
            <div>
              <Label>Department</Label>
              <select
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="fashion">Fashion</option>
                <option value="gadgets">Gadgets</option>
                <option value="art">Art & Collectibles</option>
                <option value="home">Home & Living</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Category Cover Image</Label>
              
              {/* Direct File Upload Option */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-md text-xs font-medium cursor-pointer transition-colors border">
                  {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-primary" />}
                  <span>{uploadingImage ? "Uploading Image..." : "Upload Image File"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-muted-foreground">or paste URL below</span>
              </div>

              {/* URL fallback */}
              <Input
                value={formImage}
                onChange={(e) => setFormImage(e.target.value)}
                placeholder="https://..."
                className="text-xs"
              />

              {formImage && (
                <div className="relative w-24 h-24 mt-2 rounded-lg overflow-hidden border group">
                  <img src={formImage} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormImage("")}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <Label>Visible on website</Label>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Products Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Products in "{assignCategory?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Currently assigned */}
            <div>
              <h4 className="text-sm font-medium mb-2">Assigned Products ({categoryProducts.length})</h4>
              {categoryProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No products in this category yet.</p>
              ) : (
                <div className="space-y-2">
                  {categoryProducts.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/60 bg-secondary/20">
                      <img src={p.image} alt={p.name} className="w-8 h-8 rounded object-cover" />
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <button onClick={() => unassignProduct(p.id)} className="text-xs text-destructive hover:underline">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add from unassigned */}
            <div>
              <h4 className="text-sm font-medium mb-2">Add Products</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {products
                  .filter((p) => p.category !== assignCategory?.name && p.category !== assignCategory?.slug)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/40 hover:bg-secondary/30">
                      <img src={p.image} alt={p.name} className="w-8 h-8 rounded object-cover" />
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{p.category}</Badge>
                      <button
                        onClick={() => assignProduct(p.id, assignCategory!.name)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
