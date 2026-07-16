import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, AlertTriangle, Package, Sparkles, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

const productSchema = z.object({
  name: z.string()
    .min(1, "Product name is required")
    .max(100, "Product name must be less than 100 characters"),
  price: z.string()
    .min(1, "Price is required")
    .refine((val) => !isNaN(parseFloat(val)), "Price must be a valid number")
    .refine((val) => parseFloat(val) > 0, "Price must be a positive number")
    .refine((val) => parseFloat(val) <= 999999.99, "Price must be less than 1,000,000"),
  category: z.string()
    .min(1, "Category is required")
    .max(50, "Category must be less than 50 characters"),
  stock: z.string()
    .refine((val) => !isNaN(parseInt(val)), "Stock must be a valid number")
    .refine((val) => parseInt(val) >= 0, "Stock cannot be negative"),
  low_stock_threshold: z.string()
    .refine((val) => !isNaN(parseInt(val)), "Threshold must be a valid number")
    .refine((val) => parseInt(val) >= 0, "Threshold cannot be negative"),
});

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  low_stock_threshold: number;
  description?: string;
  department?: string;
}

const DEPARTMENTS = [
  { value: "all", label: "All" },
  { value: "fashion", label: "Fashion" },
  { value: "gadgets", label: "Gadgets" },
  { value: "home", label: "Home & Living" },
  { value: "other", label: "Other" },
];

export const ProductManagement = () => {
  const { user, isAdmin, isSeller } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    image: "",
    category: "",
    department: "fashion",
    stock: "0",
    low_stock_threshold: "5",
    description: "",
    sale_price: "",
    sale_ends_at: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    let query = supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (isSeller && !isAdmin && user) {
      query = query.eq("seller_id", user.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setProducts(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const validationResult = productSchema.safeParse(formData);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    try {
      const imageUrls: string[] = [];

      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          imageUrls.push(publicUrl);
        }
      }

      let finalImages = imageUrls;
      if (editingProduct && imagePreviews.length > imageFiles.length) {
        const existingImages = imagePreviews.filter((preview) => 
          !preview.startsWith('data:')
        );
        finalImages = [...existingImages, ...imageUrls];
      }

      const mainImage = finalImages.length > 0 ? finalImages[0] : formData.image;

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update({
            name: formData.name,
            price: parseFloat(formData.price),
            image: mainImage,
            images: finalImages,
            category: formData.category,
            department: formData.department,
            stock: parseInt(formData.stock),
            low_stock_threshold: parseInt(formData.low_stock_threshold),
            description: formData.description || null,
            sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
            sale_ends_at: formData.sale_ends_at || null,
            ...(isAdmin && { status: 'approved' }),
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast({ title: "Product updated successfully" });
      } else {
        const { error } = await supabase.from("products").insert({
          name: formData.name,
          price: parseFloat(formData.price),
          image: mainImage,
          images: finalImages,
          category: formData.category,
          department: formData.department,
          stock: parseInt(formData.stock),
          low_stock_threshold: parseInt(formData.low_stock_threshold),
          description: formData.description || null,
          sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
          sale_ends_at: formData.sale_ends_at || null,
          status: isAdmin ? 'approved' : 'pending',
        });

        if (error) throw error;
        toast({ title: "Product created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Product deleted successfully" });
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      image: product.image,
      category: product.category,
      department: (product as any).department || "fashion",
      stock: product.stock.toString(),
      low_stock_threshold: product.low_stock_threshold.toString(),
      description: product.description || "",
      sale_price: (product as any).sale_price?.toString() || "",
      sale_ends_at: (product as any).sale_ends_at || "",
    });
    const existingImages = (product as any).images || [product.image];
    setImagePreviews(existingImages);
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImageFiles(files);
      const readers = files.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      
      Promise.all(readers).then((previews) => {
        setImagePreviews(previews);
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      setImageFiles(files);
      const readers = files.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      
      Promise.all(readers).then((previews) => {
        setImagePreviews(previews);
      });
    }
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({ name: "", price: "", image: "", category: "", department: "fashion", stock: "0", low_stock_threshold: "5", description: "", sale_price: "", sale_ends_at: "" });
    setFormErrors({});
    setImageFiles([]);
    setImagePreviews([]);
  };

  const generateAIDescription = async () => {
    if (!formData.name.trim() || !formData.category.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter product name and category first",
        variant: "destructive",
      });
      return;
    }

    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-description", {
        body: {
          productName: formData.name,
          category: formData.category,
          price: formData.price ? parseFloat(formData.price) : undefined,
        },
      });

      if (error) throw error;

      if (data?.description) {
        setFormData({ ...formData, description: data.description });
        toast({
          title: "Description Generated",
          description: "AI has created a product description for you",
        });
      }
    } catch (error) {
      console.error("Error generating description:", error);
      toast({
        title: "Error",
        description: "Failed to generate description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingDescription(false);
    }
  };

  const lowStockProducts = products.filter(p => p.stock <= p.low_stock_threshold);
  const outOfStockProducts = products.filter(p => p.stock === 0);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  const getStockBadge = (product: Product) => {
    if (product.stock === 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Out of Stock</Badge>;
    }
    if (product.stock <= product.low_stock_threshold) {
      return <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500"><AlertTriangle className="w-3 h-3" /> Low Stock ({product.stock})</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><Package className="w-3 h-3" /> In Stock ({product.stock})</Badge>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Inventory Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
          </CardContent>
        </Card>
        <Card className={lowStockProducts.length > 0 ? "border-orange-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              {lowStockProducts.length > 0 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockProducts.length > 0 ? "text-orange-500" : ""}`}>
              {lowStockProducts.length}
            </div>
          </CardContent>
        </Card>
        <Card className={outOfStockProducts.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              {outOfStockProducts.length > 0 && <AlertTriangle className="w-4 h-4 text-destructive" />}
              Out of Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${outOfStockProducts.length > 0 ? "text-destructive" : ""}`}>
              {outOfStockProducts.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Warnings */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-500 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Low Stock Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(product => (
                <Badge key={product.id} variant="outline" className="border-orange-500 text-orange-600">
                  {product.name}: {product.stock} left
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Product Management</h2>
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 gap-0">
              <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
                <DialogTitle>
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    maxLength={100}
                    className={formErrors.name ? "border-destructive" : ""}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-destructive mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="price">Price (GH₵)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="999999.99"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className={formErrors.price ? "border-destructive" : ""}
                  />
                  {formErrors.price && (
                    <p className="text-sm text-destructive mt-1">{formErrors.price}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="image">Product Images</Label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {imagePreviews.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          {imagePreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-32 object-cover rounded-md"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {index === 0 && (
                                <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                  Main
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Drag new images or click to replace
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-muted-foreground">
                          Drag and drop images here, or click to select (multiple images supported)
                        </p>
                      </div>
                    )}
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="image"
                      className="inline-block mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90"
                    >
                      Select Images
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <select
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="fashion">Fashion</option>
                      <option value="gadgets">Gadgets</option>
                      <option value="home">Home & Living</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      maxLength={50}
                      className={formErrors.category ? "border-destructive" : ""}
                    />
                    {formErrors.category && (
                      <p className="text-sm text-destructive mt-1">{formErrors.category}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: e.target.value })
                      }
                      className={formErrors.stock ? "border-destructive" : ""}
                    />
                    {formErrors.stock && (
                      <p className="text-sm text-destructive mt-1">{formErrors.stock}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="low_stock_threshold">Low Stock Alert</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      min="0"
                      value={formData.low_stock_threshold}
                      onChange={(e) =>
                        setFormData({ ...formData, low_stock_threshold: e.target.value })
                      }
                      className={formErrors.low_stock_threshold ? "border-destructive" : ""}
                    />
                    {formErrors.low_stock_threshold && (
                      <p className="text-sm text-destructive mt-1">{formErrors.low_stock_threshold}</p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="description">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateAIDescription}
                      disabled={generatingDescription}
                      className="gap-1"
                    >
                      {generatingDescription ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {t("generating")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          {t("generateDescription")}
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Enter product description or generate with AI..."
                    className="min-h-[80px]"
                  />
                </div>
                {/* Flash Sale Fields */}
                <div className="border-t pt-4 mt-2">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    🔥 Flash Sale (Optional)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sale_price">Sale Price (GH₵)</Label>
                      <Input
                        id="sale_price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Leave empty for no sale"
                        value={formData.sale_price}
                        onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sale_ends_at">Sale Ends At</Label>
                      <Input
                        id="sale_ends_at"
                        type="datetime-local"
                        value={formData.sale_ends_at ? formData.sale_ends_at.slice(0, 16) : ""}
                        onChange={(e) => setFormData({ ...formData, sale_ends_at: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                      />
                    </div>
                  </div>
                </div>
                </div>
                <div className="border-t px-6 py-4">
                  <Button type="submit" className="w-full">
                    {editingProduct ? "Update Product" : "Create Product"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Department filter tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {DEPARTMENTS.map((d) => {
          const count = d.value === "all"
            ? products.length
            : products.filter((p) => (p.department || "fashion") === d.value).length;
          const active = departmentFilter === d.value;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => setDepartmentFilter(d.value)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {d.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products
          .filter((p) => departmentFilter === "all" || (p.department || "fashion") === departmentFilter)
          .map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card border border-border rounded-lg overflow-hidden"
          >
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium">{product.name}</h3>
                {getStockBadge(product)}
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="capitalize">
                  {product.department || "fashion"}
                </Badge>
                <span className="text-sm text-muted-foreground">{product.category}</span>
              </div>
              <p className="text-lg font-light mb-4">GH₵{product.price}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(product)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDelete(product.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {products.filter((p) => departmentFilter === "all" || (p.department || "fashion") === departmentFilter).length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-border rounded-lg">
          {departmentFilter === "all"
            ? 'No products yet. Click "Add Product" to create your first product.'
            : `No products in ${DEPARTMENTS.find((d) => d.value === departmentFilter)?.label} yet. Click "Add Product" and select this department.`}
        </div>
      )}
    </motion.div>
  );
};
