import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export const PlatformSettingsManagement = () => {
  const { toast } = useToast();
  const [value, setValue] = useState<string>("10");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("default_commission_percent").eq("id", 1).maybeSingle()
      .then(({ data }) => { if (data) setValue(String((data as any).default_commission_percent)); });
  }, []);

  const save = async () => {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0 || n > 100) return toast({ title: "Enter 0–100", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("platform_settings").update({ default_commission_percent: n, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Saved" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5" /> Platform Commission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pct">Default commission percentage</Label>
            <div className="flex gap-2 mt-1">
              <Input id="pct" type="number" step="0.5" min="0" max="100" value={value} onChange={(e) => setValue(e.target.value)} />
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Applies to every new sale unless a seller has an individual override. Existing orders keep their snapshotted rate.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
