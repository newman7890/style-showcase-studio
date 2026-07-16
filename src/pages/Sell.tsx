import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { Store, CheckCircle2, Clock, XCircle, AlertCircle, Upload, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  business_name: z.string().trim().min(2, "Business name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(6, "Phone is required").max(30),
  address: z.string().trim().min(4, "Address is required").max(300),
  ghana_card_number: z
    .string()
    .trim()
    .regex(/^GHA-?\d{9}-?\d$/i, "Format: GHA-XXXXXXXXX-X"),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

const Sell = () => {
  const { user, sellerStatus, isSeller, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    business_name: "",
    email: "",
    phone: "",
    address: "",
    ghana_card_number: "",
    bio: "",
  });
  const [ghanaCardFile, setGhanaCardFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth?redirect=/sell");
      return;
    }
    if (isSeller) {
      navigate("/seller");
      return;
    }
    if (user.email) setForm((f) => (f.email ? f : { ...f, email: user.email! }));
    if (sellerStatus === "rejected" || sellerStatus === "suspended") {
      supabase
        .from("seller_profiles")
        .select("rejection_reason")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setRejectionReason((data as any)?.rejection_reason ?? null));
    }
  }, [user, isSeller, sellerStatus, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((er) => {
        if (er.path[0]) errs[er.path[0] as string] = er.message;
      });
      setErrors(errs);
      return;
    }
    if (!ghanaCardFile) {
      setErrors({ ghana_card_image: "Please upload a photo of your Ghana Card" });
      return;
    }
    if (ghanaCardFile.size > 5 * 1024 * 1024) {
      setErrors({ ghana_card_image: "Image must be under 5MB" });
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      // Upload Ghana Card to private bucket under user's folder
      const ext = ghanaCardFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/ghana-card-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("seller-verification")
        .upload(path, ghanaCardFile, { upsert: true, contentType: ghanaCardFile.type });
      if (upErr) throw upErr;

      const { error } = await supabase.from("seller_profiles").insert({
        user_id: user.id,
        business_name: parsed.data.business_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        ghana_card_number: parsed.data.ghana_card_number.toUpperCase(),
        ghana_card_image_url: path,
        bio: parsed.data.bio || null,
      });
      if (error) throw error;
      toast({
        title: "Application submitted 📨",
        description: "An admin will review your application shortly. You'll be notified once approved.",
      });
      await refreshRoles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = () => {
    if (sellerStatus === "pending") {
      return (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <Clock className="w-12 h-12 text-yellow-500" />
            <h2 className="text-xl font-semibold">Application under review</h2>
            <p className="text-muted-foreground">We'll notify you shortly.</p>
          </CardContent>
        </Card>
      );
    }
    if (sellerStatus === "rejected") {
      return (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <XCircle className="w-12 h-12 text-destructive" />
            <h2 className="text-xl font-semibold">Application rejected</h2>
            {rejectionReason && <p className="text-muted-foreground">Reason: {rejectionReason}</p>}
          </CardContent>
        </Card>
      );
    }
    if (sellerStatus === "suspended") {
      return (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <h2 className="text-xl font-semibold">Account suspended</h2>
            {rejectionReason && <p className="text-muted-foreground">Reason: {rejectionReason}</p>}
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" /> Become a seller
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fill in your details to start selling instantly. Your info stays private and is used only for verification.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="business_name">Business / Shop name</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                maxLength={100}
                required
              />
              {errors.business_name && <p className="text-sm text-destructive mt-1">{errors.business_name}</p>}
            </div>
            <div>
              <Label htmlFor="email">Contact email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 024 000 0000"
                required
              />
              {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="House / street / city"
                required
              />
              {errors.address && <p className="text-sm text-destructive mt-1">{errors.address}</p>}
            </div>
            <div>
              <Label htmlFor="ghana_card_number">Ghana Card number</Label>
              <Input
                id="ghana_card_number"
                value={form.ghana_card_number}
                onChange={(e) => setForm({ ...form, ghana_card_number: e.target.value.toUpperCase() })}
                placeholder="GHA-XXXXXXXXX-X"
                required
              />
              {errors.ghana_card_number && (
                <p className="text-sm text-destructive mt-1">{errors.ghana_card_number}</p>
              )}
            </div>
            <div>
              <Label htmlFor="ghana_card_image">Ghana Card photo</Label>
              <label
                htmlFor="ghana_card_image"
                className="mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition"
              >
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-sm text-muted-foreground text-center">
                  {ghanaCardFile ? ghanaCardFile.name : "Tap to upload a clear photo (max 5MB)"}
                </span>
                <input
                  id="ghana_card_image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setGhanaCardFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {errors.ghana_card_image && (
                <p className="text-sm text-destructive mt-1">{errors.ghana_card_image}</p>
              )}
            </div>
            <div>
              <Label htmlFor="bio">About your shop (optional)</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                maxLength={500}
                rows={3}
                placeholder="Tell buyers what you sell."
              />
            </div>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground flex gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              <span>Once you submit, you can list products right away — no waiting.</span>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                "Start selling"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto px-4 max-w-2xl"
        >
          {renderStatus()}
        </motion.div>
      </main>
      <BottomNav />
    </>
  );
};

export default Sell;
