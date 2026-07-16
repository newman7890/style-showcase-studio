import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Tag, Percent, DollarSign, Calendar } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

const discountSchema = z.object({
  code: z.string().min(1, "Code is required").max(20, "Code too long"),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.string().refine((val) => parseFloat(val) > 0, "Must be positive"),
  min_order_amount: z.string().optional(),
  max_uses: z.string().optional(),
  valid_until: z.string().optional(),
});

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export const DiscountManagement = () => {
  const { toast } = useToast();
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    min_order_amount: "0",
    max_uses: "",
    valid_until: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDiscounts(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const validationResult = discountSchema.safeParse(formData);
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
      const discountData = {
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_order_amount: parseFloat(formData.min_order_amount) || 0,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_until: formData.valid_until || null,
      };

      if (editingDiscount) {
        const { error } = await supabase
          .from("discount_codes")
          .update(discountData)
          .eq("id", editingDiscount.id);

        if (error) throw error;
        toast({ title: "Discount code updated successfully" });
      } else {
        const { error } = await supabase
          .from("discount_codes")
          .insert(discountData);

        if (error) throw error;
        toast({ title: "Discount code created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchDiscounts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this discount code?")) return;

    try {
      const { error } = await supabase.from("discount_codes").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Discount code deleted successfully" });
      fetchDiscounts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("discount_codes")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
      fetchDiscounts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (discount: DiscountCode) => {
    setEditingDiscount(discount);
    setFormData({
      code: discount.code,
      description: discount.description || "",
      discount_type: discount.discount_type as "percentage" | "fixed",
      discount_value: discount.discount_value.toString(),
      min_order_amount: discount.min_order_amount.toString(),
      max_uses: discount.max_uses?.toString() || "",
      valid_until: discount.valid_until ? discount.valid_until.split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingDiscount(null);
    setFormData({
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: "",
      min_order_amount: "0",
      max_uses: "",
      valid_until: "",
    });
    setFormErrors({});
  };

  const activeDiscounts = discounts.filter((d) => d.is_active);
  const totalUsage = discounts.reduce((sum, d) => sum + d.current_uses, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{discounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeDiscounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Uses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Discount Codes</h2>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Discount Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDiscount ? "Edit Discount Code" : "Create Discount Code"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER20"
                  maxLength={20}
                  className={formErrors.code ? "border-destructive" : ""}
                />
                {formErrors.code && (
                  <p className="text-sm text-destructive mt-1">{formErrors.code}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summer sale discount"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount_type">Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: "percentage" | "fixed") =>
                      setFormData({ ...formData, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discount_value">
                    Value {formData.discount_type === "percentage" ? "(%)" : "(GH₵)"}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.discount_type === "percentage" ? "100" : undefined}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className={formErrors.discount_value ? "border-destructive" : ""}
                  />
                  {formErrors.discount_value && (
                    <p className="text-sm text-destructive mt-1">{formErrors.discount_value}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_order_amount">Min Order Amount (GH₵)</Label>
                  <Input
                    id="min_order_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="max_uses">Max Uses (leave empty for unlimited)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="1"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="valid_until">Valid Until (optional)</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full">
                {editingDiscount ? "Update Discount Code" : "Create Discount Code"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Discount List */}
      <div className="space-y-4">
        {discounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No discount codes yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          discounts.map((discount) => (
            <Card key={discount.id} className={!discount.is_active ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      {discount.discount_type === "percentage" ? (
                        <Percent className="w-6 h-6 text-primary" />
                      ) : (
                        <DollarSign className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg">{discount.code}</span>
                        <Badge variant={discount.is_active ? "default" : "secondary"}>
                          {discount.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {discount.discount_type === "percentage"
                          ? `${discount.discount_value}% off`
                          : `GH₵${discount.discount_value} off`}
                        {discount.min_order_amount > 0 &&
                          ` on orders over GH₵${discount.min_order_amount}`}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          Used: {discount.current_uses}
                          {discount.max_uses && `/${discount.max_uses}`}
                        </span>
                        {discount.valid_until && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires: {format(new Date(discount.valid_until), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Switch
                      checked={discount.is_active}
                      onCheckedChange={(checked) => handleToggleActive(discount.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(discount)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(discount.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
};
