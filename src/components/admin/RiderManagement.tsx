import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bike,
  Copy,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Package,
  Phone,
  User,
  Loader2,
  Calendar,
  MapPin,
  FileText,
  ShieldCheck,
  Check,
} from "lucide-react";

interface AccessCode {
  id: string;
  code: string;
  assigned_name: string | null;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
}

interface RiderProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  vehicle_type: string;
  license_plate: string | null;
  access_code: string;
  status: string;
  created_at: string;
}

interface DeliveryOrder {
  id: string;
  status: string;
  created_at: string;
  delivery_address: string | null;
  phone: string | null;
  total_amount: number;
  profiles?: {
    full_name: string | null;
  };
  order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    products?: {
      name: string;
    };
  }>;
}

export const RiderManagement = () => {
  const { toast } = useToast();
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Access Code Generation form state
  const [assignedName, setAssignedName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Selected Rider Modal state
  const [selectedRider, setSelectedRider] = useState<RiderProfile | null>(null);
  const [riderDeliveries, setRiderDeliveries] = useState<DeliveryOrder[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [codesRes, ridersRes] = await Promise.all([
        supabase.from("rider_access_codes" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("rider_profiles" as any).select("*").order("created_at", { ascending: false }),
      ]);
      if (codesRes.data) setAccessCodes(codesRes.data as any);
      if (ridersRes.data) setRiders(ridersRes.data as any);
    } catch (err: any) {
      toast({ title: "Error loading rider data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const generatedCode = customCode.trim()
        ? customCode.trim().toUpperCase()
        : `RIDER-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error } = await supabase.from("rider_access_codes" as any).insert({
        code: generatedCode,
        assigned_name: assignedName.trim() || null,
      } as any);

      if (error) throw error;

      toast({
        title: "Access Code Generated! 🔑",
        description: `Code ${generatedCode} created successfully for registration.`,
      });

      setAssignedName("");
      setCustomCode("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to generate code", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyCodeToClipboard = (codeObj: AccessCode) => {
    navigator.clipboard.writeText(codeObj.code);
    setCopiedCodeId(codeObj.id);
    toast({ title: "Code Copied!", description: `${codeObj.code} copied to clipboard.` });
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleOpenRiderDetails = async (rider: RiderProfile) => {
    setSelectedRider(rider);
    setDetailModalOpen(true);
    setLoadingDeliveries(true);

    try {
      // Query orders assigned to this rider
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, created_at, delivery_address, phone, total_amount, profiles(full_name), order_items(id, quantity, unit_price, products(name))")
        .eq("assigned_rider_id" as any, rider.user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRiderDeliveries((data as any) || []);
    } catch (err: any) {
      toast({ title: "Failed to fetch rider deliveries", description: err.message, variant: "destructive" });
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const toggleRiderStatus = async (riderId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const { error } = await supabase
        .from("rider_profiles" as any)
        .update({ status: nextStatus } as any)
        .eq("id", riderId);
      if (error) throw error;

      toast({ title: `Rider ${nextStatus}`, description: `Rider status updated to ${nextStatus}.` });
      if (selectedRider && selectedRider.id === riderId) {
        setSelectedRider({ ...selectedRider, status: nextStatus });
      }
      fetchData();
    } catch (err: any) {
      toast({ title: "Error updating status", description: err.message, variant: "destructive" });
    }
  };

  const filteredRiders = riders.filter(
    (r) =>
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone_number.includes(searchQuery) ||
      r.access_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedCount = riderDeliveries.filter((d) => d.status === "delivered").length;
  const activeCount = riderDeliveries.filter((d) => d.status !== "delivered" && d.status !== "cancelled").length;
  const totalValueDelivered = riderDeliveries
    .filter((d) => d.status === "delivered")
    .reduce((sum, d) => sum + (d.total_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="riders">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="riders" className="gap-2">
            <Bike className="w-4 h-4" /> Registered Riders ({riders.length})
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Access Codes ({accessCodes.filter((c) => !c.is_used).length} unused)
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: REGISTERED RIDERS DIRECTORY ─────────────────────────────────── */}
        <TabsContent value="riders" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Delivery Riders Directory</h2>
              <p className="text-xs text-muted-foreground">
                Click any rider to view their profile, assigned packages, and completed delivery history.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search rider, phone, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
          </div>

          {filteredRiders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                No registered riders found. Generate an access code under "Access Codes" to allow new riders to register.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRiders.map((rider) => (
                <Card
                  key={rider.id}
                  onClick={() => handleOpenRiderDetails(rider)}
                  className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group relative overflow-hidden"
                >
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
                          <Bike className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary transition-colors">
                            {rider.full_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{rider.phone_number}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={rider.status === "active" ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {rider.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-gray-600">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Access Code</span>
                        <span className="font-mono font-medium text-gray-900">{rider.access_code}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Vehicle</span>
                        <span className="font-medium text-gray-900">{rider.vehicle_type}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-primary font-semibold pt-1 flex items-center gap-1">
                      <span>View Delivery History & Packages →</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── TAB 2: ACCESS CODE GENERATION ────────────────────────────────────── */}
        <TabsContent value="codes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Generate New Rider Access Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateCode} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="assigned-name">Intended Rider Name (Optional)</Label>
                  <Input
                    id="assigned-name"
                    placeholder="e.g. Kwame Mensah"
                    value={assignedName}
                    onChange={(e) => setAssignedName(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="custom-code">Custom Code (Optional, leave blank for auto)</Label>
                  <Input
                    id="custom-code"
                    placeholder="e.g. RIDER-7892"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="mt-1 text-xs uppercase font-mono"
                  />
                </div>

                <Button type="submit" disabled={generating} className="w-full sm:w-auto gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Generate Access Code
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generated Access Codes History</CardTitle>
            </CardHeader>
            <CardContent>
              {accessCodes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No access codes generated yet. Click "Generate Access Code" above to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  {accessCodes.map((codeObj) => (
                    <div
                      key={codeObj.id}
                      className="p-3 bg-secondary/30 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm bg-background px-2.5 py-1 rounded border text-primary">
                          {codeObj.code}
                        </span>
                        <div>
                          {codeObj.assigned_name && (
                            <span className="font-medium text-gray-900 block">
                              Intended for: {codeObj.assigned_name}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            Created {new Date(codeObj.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {codeObj.is_used ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Used on{" "}
                            {new Date(codeObj.used_at!).toLocaleDateString()}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500 text-emerald-700 bg-emerald-50">
                            <Clock className="w-3 h-3 text-emerald-600" /> Ready to use
                          </Badge>
                        )}

                        {!codeObj.is_used && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => copyCodeToClipboard(codeObj)}
                            className="h-8 px-2 text-xs gap-1"
                          >
                            {copiedCodeId === codeObj.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> Copy Code
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── RIDER PROFILE & DELIVERIES HISTORY MODAL DIALOG ────────────────────── */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedRider && (
            <div className="space-y-6 pt-2">
              {/* Header Profile Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary/30 p-4 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">
                    <Bike className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedRider.full_name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <a href={`tel:${selectedRider.phone_number}`} className="font-medium text-emerald-700 hover:underline">
                          {selectedRider.phone_number}
                        </a>
                      </span>
                      <span>·</span>
                      <span className="font-mono bg-background px-2 py-0.5 rounded border">
                        Code: {selectedRider.access_code}
                      </span>
                      <span>·</span>
                      <span>Vehicle: {selectedRider.vehicle_type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={selectedRider.status === "active" ? "default" : "destructive"}>
                    {selectedRider.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant={selectedRider.status === "active" ? "outline" : "default"}
                    onClick={() => toggleRiderStatus(selectedRider.id, selectedRider.status)}
                    className="text-xs"
                  >
                    {selectedRider.status === "active" ? "Suspend Rider" : "Activate Rider"}
                  </Button>
                </div>
              </div>

              {/* Performance Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-center">
                  <div className="text-2xl font-bold text-emerald-700">{completedCount}</div>
                  <div className="text-[11px] text-emerald-800 font-medium">Completed Deliveries</div>
                </div>

                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-center">
                  <div className="text-2xl font-bold text-blue-700">{activeCount}</div>
                  <div className="text-[11px] text-blue-800 font-medium">Active In-Transit</div>
                </div>

                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-center">
                  <div className="text-2xl font-bold text-purple-700">
                    GH₵{totalValueDelivered.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-purple-800 font-medium">Package Value Delivered</div>
                </div>
              </div>

              {/* Delivery History Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-900">
                  <Package className="w-4 h-4 text-primary" /> Delivery History & Package Log ({riderDeliveries.length})
                </h3>

                {loadingDeliveries ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : riderDeliveries.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-xs text-muted-foreground">
                      No delivery orders assigned to this rider yet.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {riderDeliveries.map((order) => (
                      <Card key={order.id} className="border">
                        <CardContent className="pt-4 space-y-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono font-bold text-sm text-gray-900">
                                Order #{order.id.slice(0, 8)}
                              </span>
                              <div className="text-muted-foreground text-[11px] flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                {new Date(order.created_at).toLocaleString()}
                              </div>
                            </div>
                            <Badge
                              variant={
                                order.status === "delivered"
                                  ? "default"
                                  : order.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {order.status}
                            </Badge>
                          </div>

                          {/* Customer & Address */}
                          <div className="bg-secondary/40 p-2.5 rounded-lg space-y-1 text-gray-700">
                            {order.profiles?.full_name && (
                              <div className="font-semibold text-gray-900 flex items-center gap-1">
                                <User className="w-3 h-3 text-primary" /> Customer: {order.profiles.full_name}
                              </div>
                            )}
                            {order.delivery_address && (
                              <div className="flex items-start gap-1">
                                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                <span>Destination: {order.delivery_address}</span>
                              </div>
                            )}
                            {order.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>Phone: {order.phone}</span>
                              </div>
                            )}
                          </div>

                          {/* Items inside package */}
                          {order.order_items && order.order_items.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                Package Items ({order.order_items.length}):
                              </span>
                              <div className="space-y-1">
                                {order.order_items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex justify-between items-center bg-background px-2.5 py-1 rounded border text-[11px]"
                                  >
                                    <span className="font-medium text-gray-800">
                                      {item.quantity}x {item.products?.name || "Product"}
                                    </span>
                                    <span className="font-semibold">
                                      GH₵{(item.unit_price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1 border-t text-xs">
                            <span className="text-muted-foreground">Total Order Amount:</span>
                            <span className="font-bold text-gray-900">
                              GH₵{Number(order.total_amount || 0).toFixed(2)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
