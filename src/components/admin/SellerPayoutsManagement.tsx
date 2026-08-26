import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, ArrowUpRight, CheckCircle2, Clock, Wallet, Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SellerPayoutSummary {
  seller_id: string;
  seller_name: string;
  business_name: string;
  subaccount_code: string | null;
  gross_sales: number;
  platform_fee: number;
  net_earnings: number;
  paid_out: number;
  pending_balance: number;
}

export const SellerPayoutsManagement = () => {
  const [summaries, setSummaries] = useState<SellerPayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<SellerPayoutSummary | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPayoutData = async () => {
    setLoading(true);
    try {
      // 1. Fetch seller profiles
      const { data: sellerProfiles, error: pErr } = await supabase
        .from("seller_profiles")
        .select("user_id, business_name, paystack_subaccount_code");
      
      if (pErr) throw pErr;

      // 2. Fetch profiles for user names
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      if (profErr) throw profErr;

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      // 3. Fetch seller earnings
      const { data: earnings, error: eErr } = await supabase
        .from("seller_earnings")
        .select("*");

      if (eErr) throw eErr;

      // 4. Fetch seller payouts history
      const { data: payouts, error: payErr } = await supabase
        .from("seller_payouts")
        .select("*");

      if (payErr) throw payErr;

      // Aggregate data per seller
      const map = new Map<string, SellerPayoutSummary>();

      (sellerProfiles || []).forEach((sp) => {
        const u = profileMap.get(sp.user_id);
        map.set(sp.user_id, {
          seller_id: sp.user_id,
          seller_name: u?.full_name || u?.email || "Seller",
          business_name: sp.business_name || "N/A",
          subaccount_code: sp.paystack_subaccount_code || null,
          gross_sales: 0,
          platform_fee: 0,
          net_earnings: 0,
          paid_out: 0,
          pending_balance: 0,
        });
      });

      (earnings || []).forEach((e) => {
        if (e.seller_id) {
          const item = map.get(e.seller_id);
          if (item) {
            item.gross_sales += Number(e.gross_amount || 0);
            item.platform_fee += Number(e.platform_fee || 0);
            item.net_earnings += Number(e.net_amount || 0);
          }
        }
      });

      (payouts || []).forEach((p) => {
        if (p.seller_id) {
          const item = map.get(p.seller_id);
          if (item && p.status === "completed") {
            item.paid_out += Number(p.amount || 0);
          }
        }
      });

      map.forEach((item) => {
        item.pending_balance = Math.max(0, item.net_earnings - item.paid_out);
      });

      setSummaries(Array.from(map.values()));
    } catch (err: any) {
      console.error("Error fetching payout data:", err);
      toast.error(err.message || "Failed to load seller payout data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayoutData();
  }, []);

  const totalGross = summaries.reduce((s, x) => s + x.gross_sales, 0);
  const totalCommission = summaries.reduce((s, x) => s + x.platform_fee, 0);
  const totalPaidOut = summaries.reduce((s, x) => s + x.paid_out, 0);
  const totalPending = summaries.reduce((s, x) => s + x.pending_balance, 0);

  const handleOpenPayoutModal = (s: SellerPayoutSummary) => {
    setSelectedSeller(s);
    setPayoutAmount(s.pending_balance.toFixed(2));
    setPayoutNotes("");
    setDialogOpen(true);
  };

  const handleRecordPayout = async () => {
    if (!selectedSeller) return;
    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid payout amount");
      return;
    }

    setIsProcessing(true);
    try {
      const ref = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const { error } = await supabase.from("seller_payouts").insert({
        seller_id: selectedSeller.seller_id,
        amount: amt,
        payout_reference: ref,
        payout_method: selectedSeller.subaccount_code ? "paystack_subaccount" : "manual_transfer",
        status: "completed",
        notes: payoutNotes || "Payout processed by Administrator",
      });

      if (error) throw error;

      toast.success(`Payout of GH₵${amt.toFixed(2)} recorded successfully!`);
      setDialogOpen(false);
      fetchPayoutData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payout");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Seller Payouts & Commission</h2>
          <p className="text-muted-foreground text-sm">
            Track seller sales, platform commissions, Paystack split payments, and disbursement history.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPayoutData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gross Sales</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              GH₵{totalGross.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Platform gross merchandise volume</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Commission (10%)</CardTitle>
            <Wallet className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              GH₵{totalCommission.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Net platform marketplace fees retained</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Disbursed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              GH₵{totalPaidOut.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total earnings paid out to sellers</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payouts</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              GH₵{totalPending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Available seller balances ready for payout</p>
          </CardContent>
        </Card>
      </div>

      {/* Seller Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Seller Accounts & Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller / Business</TableHead>
                  <TableHead>Subaccount Code</TableHead>
                  <TableHead className="text-right">Gross Sales</TableHead>
                  <TableHead className="text-right">Commission (10%)</TableHead>
                  <TableHead className="text-right">Net Earnings</TableHead>
                  <TableHead className="text-right">Paid Out</TableHead>
                  <TableHead className="text-right">Pending Balance</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                      No sellers or earnings recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  summaries.map((s) => (
                    <TableRow key={s.seller_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{s.business_name}</p>
                          <p className="text-xs text-muted-foreground">{s.seller_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.subaccount_code ? (
                          <Badge variant="outline" className="font-mono bg-blue-500/10 text-blue-500 border-blue-500/20">
                            {s.subaccount_code}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Manual Settlement
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">GH₵{s.gross_sales.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">GH₵{s.platform_fee.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                        GH₵{s.net_earnings.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-purple-600 dark:text-purple-400">
                        GH₵{s.paid_out.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                        GH₵{s.pending_balance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={s.pending_balance <= 0}
                          onClick={() => handleOpenPayoutModal(s)}
                          className="h-8"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                          Disburse
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Disburse Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Seller Payout</DialogTitle>
          </DialogHeader>
          {selectedSeller && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-secondary/50 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seller:</span>
                  <span className="font-medium">{selectedSeller.business_name} ({selectedSeller.seller_name})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Pending:</span>
                  <span className="font-bold text-amber-600">GH₵{selectedSeller.pending_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paystack Subaccount:</span>
                  <span className="font-mono">{selectedSeller.subaccount_code || "None (Manual Transfer)"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payout Amount (GH₵)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes / Transfer Ref (Optional)</label>
                <Input
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Bank transfer ref #99812"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayout} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Confirm & Disburse Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
