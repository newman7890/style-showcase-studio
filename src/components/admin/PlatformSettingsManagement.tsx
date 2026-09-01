import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Percent, Key, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export const PlatformSettingsManagement = () => {
  const { toast } = useToast();
  const [value, setValue] = useState<string>("10");
  const [paystackPublicKey, setPaystackPublicKey] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("default_commission_percent, paystack_public_key")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setValue(String((data as any).default_commission_percent ?? 10));
          setPaystackPublicKey((data as any).paystack_public_key || "");
        }
      });
  }, []);

  const save = async () => {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0 || n > 100) return toast({ title: "Enter commission between 0–100%", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        default_commission_percent: n,
        paystack_public_key: paystackPublicKey.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Platform Settings Saved Successfully! 🎉" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5" /> Platform Commission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pct">Default commission percentage (%)</Label>
            <div className="flex gap-2 mt-1">
              <Input id="pct" type="number" step="0.5" min="0" max="100" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Applies to every new sale unless a seller has an individual override. Existing orders keep their snapshotted rate.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl border-primary/20 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Key className="w-5 h-5" /> Paystack Public Integration Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Paystack Secret Key Secured
              </p>
              <p className="text-[11px] text-muted-foreground">
                Secret keys (<code className="text-emerald-500">sk_live_...</code>) are stored exclusively in encrypted Supabase Environment Secrets (backend-only) to prevent any web exposure.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="pub_key">Paystack Live Public Key (pk_live_...)</Label>
            <Input
              id="pub_key"
              type="text"
              placeholder="Enter Paystack Public Key"
              value={paystackPublicKey}
              onChange={(e) => setPaystackPublicKey(e.target.value)}
              className="font-mono mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used by frontend checkout inline popup.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto gap-2">
              {saving ? "Saving..." : <><CheckCircle2 className="w-4 h-4" /> Save Settings</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

