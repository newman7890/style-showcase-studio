import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, ImageIcon, Save, X, FolderOpen } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  display_order: number;
  is_active: boolean;
  department?: string;
  created_at: string;
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
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignCategory, setAssignCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from("categories").select("*").order("display_order", { ascending: true }),
        supabase.from("products").select("id, name, image, category"),
      ]);
      if (catRes.error) throw catRes.error;
      if (prodRes.error) throw prodRes.error;
      setCategories(catRes.data || []);
      setProducts(prodRes.data || []);
    } catch {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
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
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({ name: formName, slug: formSlug, image: formImage || null, is_active: formActive, department: formDepartment })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast({ title: "Category updated" });
      } else {
        const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.display_order)) : 0;
        const { error } = await supabase
          .from("categories")
          .insert({ name: formName, slug: formSlug, image: formImage || null, is_active: formActive, department: formDepartment, display_order: maxOrder + 1 });
        if (error) throw error;
        toast({ title: "Category created" });
      }
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
    const { error } = await supabase.from("categories").update({ is_active: !cat.is_active }).eq("id", cat.id);
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
    setCategoryProducts(products.filter((p) => p.category === cat.slug));
    setAssignDialogOpen(true);
  };

  const assignProduct = async (productId: string, slug: string) => {
    const { error } = await supabase.from("products").update({ category: slug }).eq("id", productId);
    if (error) {
      toast({ title: "Error assigning product", variant: "destructive" });
    } else {
      toast({ title: "Product assigned" });
      fetchData();
      // Refresh local state
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, category: slug } : p)));
      setCategoryProducts((prev) => {
        const product = products.find((p) => p.id === productId);
        return product ? [...prev, { ...product, category: slug }] : prev;
      });
    }
  };

  const unassignProduct = async (productId: string) => {
    const { error } = await supabase.from("products").update({ category: "uncategorized" }).eq("id", productId);
    if (!error) {
      toast({ title: "Product removed from category" });
      fetchData();
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, category: "uncategorized" } : p)));
      setCategoryProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const getProductCount = (slug: string) => products.filter((p) => p.category === slug).length;

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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              Category Management
            </CardTitle>
            <Button onClick={openCreate} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Create and manage categories that appear on the homepage and shop page. Drag to reorder, assign products to categories.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <AnimatePresence>
              {categories.map((cat, index) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: index * 0.04 }}
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
                      disabled={index === categories.length - 1}
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
                    <h4 className="text-sm font-medium truncate">{cat.name}</h4>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{cat.slug}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {getProductCount(cat.slug)} products
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
                    <button onClick={() => openEdit(cat)} title="Edit">
                      <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)} title="Delete">
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {categories.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No categories yet. Create one to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
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
                <option value="home">Home & Living</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input value={formImage} onChange={(e) => setFormImage(e.target.value)} placeholder="https://..." />
              {formImage && (
                <img src={formImage} alt="Preview" className="w-20 h-20 rounded-lg object-cover mt-2" />
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
                  .filter((p) => p.category !== assignCategory?.slug)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/40 hover:bg-secondary/30">
                      <img src={p.image} alt={p.name} className="w-8 h-8 rounded object-cover" />
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{p.category}</Badge>
                      <button
                        onClick={() => assignProduct(p.id, assignCategory!.slug)}
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
