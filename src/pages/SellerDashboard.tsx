import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Plus, Pencil, Trash2, Package, DollarSign, ShoppingBag, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
  { value: "other", label: "Other" },
];

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  department: string | null;
  stock: number;
  low_stock_threshold: number;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "hidden";
  rejection_reason: string | null;
  created_at: string;
}

const emptyForm = {
  name: "",
  price: "",
  category: "",
  department: "fashion",
  stock: "0",
  low_stock_threshold: "5",
  description: "",
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [p, oi, s] = await Promise.all([
      supabase.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("order_items")
        .select("id, quantity, unit_price, seller_earnings, commission_amount, created_at, order_id, product_id, products(name)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("get_seller_earnings_summary", { _seller_id: user.id }),
    ]);
    setProducts((p.data as any) ?? []);
    setOrderItems((oi.data as any) ?? []);
    setSummary(Array.isArray(s.data) ? s.data[0] : s.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setImageFile(null);
    setImagePreview("");
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
    });
    setImagePreview(p.image);
    setDialogOpen(true);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    const r = new FileReader();
    r.onloadend = () => setImagePreview(r.result as string);
    r.readAsDataURL(f);
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
    if (!editing && !imageFile) {
      setErrors({ image: "Image required" });
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl = editing?.image ?? "";
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("product-images").upload(path, imageFile);
        if (up.error) throw up.error;
        imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        name: form.name,
        price: parseFloat(form.price),
        image: imageUrl,
        images: [imageUrl],
        category: form.category,
        department: form.department,
        stock: parseInt(form.stock),
        low_stock_threshold: parseInt(form.low_stock_threshold),
        description: form.description || null,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({
          title: "Product updated",
          description: "Price/name/image changes go back to pending review.",
        });
      } else {
        const { error } = await supabase
          .from("products")
          .insert({ ...payload, seller_id: user.id });
        if (error) throw error;
        toast({ title: "Product submitted", description: "Awaiting admin approval." });
      }
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
            </TabsList>

            <TabsContent value="products">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-muted-foreground">
                  {products.length} product{products.length === 1 ? "" : "s"}
                </div>
                <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="w-4 h-4 mr-2" />Add product</Button>
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
                      <div>
                        <Label htmlFor="image">Image</Label>
                        <Input id="image" type="file" accept="image/*" onChange={handleImage} />
                        {imagePreview && (
                          <img src={imagePreview} alt="preview" className="mt-2 w-32 h-32 object-cover rounded" />
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
                          <Input id="stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                          {errors.stock && <p className="text-sm text-destructive">{errors.stock}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                          {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
                        </div>
                        <div>
                          <Label htmlFor="department">Department</Label>
                          <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((d) => (
                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
          </Tabs>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default SellerDashboard;
