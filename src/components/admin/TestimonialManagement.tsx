import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  rating: number;
  text: string;
  is_active: boolean;
  created_at: string;
}

export const TestimonialManagement = () => {
  const { toast } = useToast();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState({ name: "", role: "Customer", text: "", rating: 5, is_active: true });

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const fetchTestimonials = async () => {
    const { data } = await supabase
      .from("testimonials")
      .select("*")
      .order("created_at", { ascending: false });
    setTestimonials(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", role: "Customer", text: "", rating: 5, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({ name: t.name, role: t.role, text: t.text, rating: t.rating, is_active: t.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.text.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("testimonials")
          .update({ name: form.name, role: form.role, text: form.text, rating: form.rating, is_active: form.is_active })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Testimonial updated" });
      } else {
        const { error } = await supabase
          .from("testimonials")
          .insert({ name: form.name, role: form.role, text: form.text, rating: form.rating, is_active: form.is_active });
        if (error) throw error;
        toast({ title: "Testimonial added" });
      }
      setDialogOpen(false);
      await fetchTestimonials();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Testimonial deleted" });
      await fetchTestimonials();
    }
  };

  const toggleActive = async (t: Testimonial) => {
    await supabase.from("testimonials").update({ is_active: !t.is_active }).eq("id", t.id);
    await fetchTestimonials();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Testimonials ({testimonials.length})</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-2" />Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Customer Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <Label>Role / Title</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Loyal Customer" />
              </div>
              <div>
                <Label>Rating</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, rating: s })}>
                      <Star className={`w-6 h-6 ${s <= form.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Testimonial Text</Label>
                <Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="What did the customer say?" rows={4} maxLength={500} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active (visible on site)</Label>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.text.trim()} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? "Update" : "Add"} Testimonial
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {testimonials.map((t) => (
          <Card key={t.id} className={`${!t.is_active ? "opacity-50" : ""}`}>
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{t.name}</p>
                  <span className="text-xs text-muted-foreground">• {t.role}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < t.rating ? "fill-primary text-primary" : "text-muted"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground truncate">{t.text}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
