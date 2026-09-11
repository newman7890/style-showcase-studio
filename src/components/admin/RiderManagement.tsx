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
  LifeBuoy,
  MessageSquare,
  AlertCircle,
  Send,
  RefreshCw,
} from "lucide-react";
import { createNotification } from "@/services/notificationService";

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
  is_online?: boolean;
  last_seen_at?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
}

interface SupportTicket {
  id: string;
  rider_id: string;
  order_id: string | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  rider_name?: string;
  rider_phone?: string;
}

interface DeliveryOrder {
  id: string;
  status: string;
  created_at: string;
  shipping_address?: string | null;
  shipping_phone?: string | null;
  shipping_name?: string | null;
  delivery_address?: string | null;
  phone?: string | null;
  total_amount: number;
  order_items?: Array<{
    id: string;
    quantity: number;
    price?: number;
    unit_price?: number;
    products?: {
      name: string;
    };
  }>;
}

export const RiderManagement = () => {
  const { toast } = useToast();
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeOrdersByRider, setActiveOrdersByRider] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");

  // Ticket modal state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [adminReplyNotes, setAdminReplyNotes] = useState("");
  const [updatingTicketStatus, setUpdatingTicketStatus] = useState("open");
  const [savingTicket, setSavingTicket] = useState(false);
  
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
    fetchData(true);

    // Realtime channel for live rider profile status changes
    const channel = supabase
      .channel("admin-rider-management-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_profiles" },
        () => {
          fetchData(false);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchData(false);
        }
      )
      .subscribe();

    // Automatic polling interval to refresh presence and heartbeats
    const interval = setInterval(() => {
      fetchData(false);
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    try {
      const [codesRes, ridersRes, ticketsRes, activeOrdersRes, rolesRes] = await Promise.all([
        supabase.from("rider_access_codes" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("rider_profiles" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("rider_support_tickets" as any).select("*").order("created_at", { ascending: false }),
        supabase
          .from("orders" as any)
          .select("assigned_rider_id, status")
          .not("assigned_rider_id", "is", null)
          .in("status", ["confirmed", "processing", "shipped"]),
        supabase.from("user_roles" as any).select("user_id, role").eq("role", "rider"),
      ]);
      if (codesRes.data) setAccessCodes(codesRes.data as any);
      const riderList: RiderProfile[] = [...((ridersRes.data as unknown as RiderProfile[]) || [])];

      // Auto-include any users assigned rider role if profile row was missing
      if (rolesRes.data) {
        (rolesRes.data as any[]).forEach((rRole) => {
          if (!riderList.some((r) => r.user_id === rRole.user_id)) {
            riderList.push({
              id: rRole.user_id,
              user_id: rRole.user_id,
              full_name: "Delivery Rider",
              phone_number: "N/A",
              vehicle_type: "Motorcycle",
              license_plate: null,
              access_code: `RIDER-${rRole.user_id.slice(0, 4).toUpperCase()}`,
              status: "active",
              created_at: new Date().toISOString(),
              is_online: false,
              last_seen_at: null,
            });
          }
        });
      }
      setRiders(riderList);

      const activeMap: Record<string, number> = {};
      if (activeOrdersRes.data) {
        (activeOrdersRes.data as any[]).forEach((o) => {
          if (o.assigned_rider_id) {
            activeMap[o.assigned_rider_id] = (activeMap[o.assigned_rider_id] || 0) + 1;
          }
        });
      }
      setActiveOrdersByRider(activeMap);

      if (ticketsRes.data) {
        const enrichedTickets = (ticketsRes.data as any[]).map((t) => {
          const matchedRider = riderList.find((r) => r.user_id === t.rider_id);
          return {
            ...t,
            rider_name: matchedRider ? matchedRider.full_name : "Unknown Rider",
            rider_phone: matchedRider ? matchedRider.phone_number : "N/A",
          };
        });
        setTickets(enrichedTickets);
      }
    } catch (err: any) {
      toast({ title: "Error loading rider data", description: err.message, variant: "destructive" });
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  };

  const isRiderOnline = (rider: RiderProfile): boolean => {
    if (!rider) return false;
    const val = (rider as any).is_online;
    if (val === true || val === "true" || val === 1) return true;
    
    // Heartbeat check: active in app within the last 5 minutes
    if (rider.last_seen_at && val !== false && val !== "false") {
      const diffMs = Date.now() - new Date(rider.last_seen_at).getTime();
      if (diffMs < 5 * 60 * 1000) return true;
    }
    return false;
  };

  const toggleRiderOnlineStatus = async (riderId: string, currentOnline: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextOnline = !currentOnline;
    try {
      const { error } = await supabase
        .from("rider_profiles" as any)
        .update({
          is_online: nextOnline,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", riderId);

      if (error) throw error;
      toast({
        title: nextOnline ? "Rider Set to Online 🟢" : "Rider Set to Offline ⚪",
        description: `Status updated successfully.`,
      });
      fetchData(false);
    } catch (err: any) {
      toast({ title: "Failed to update presence", description: err.message, variant: "destructive" });
    }
  };

  const getRiderPresence = (rider: RiderProfile) => {
    const activeCount = activeOrdersByRider[rider.user_id] || 0;
    if (rider.status === "suspended") {
      return {
        status: "suspended",
        label: "Suspended",
        badgeClass: "bg-red-100 text-red-700 border-red-200",
        dotClass: "bg-red-500",
        activeCount,
      };
    }
    if (activeCount > 0) {
      return {
        status: "busy",
        label: `On Delivery (${activeCount} active)`,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        dotClass: "bg-amber-500 animate-pulse",
        activeCount,
      };
    }
    if (isRiderOnline(rider)) {
      return {
        status: "online",
        label: "Online (Available)",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        dotClass: "bg-emerald-500 animate-pulse",
        activeCount: 0,
      };
    }
    return {
      status: "offline",
      label: "Offline",
      badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
      dotClass: "bg-gray-400",
      activeCount: 0,
    };
  };

  const formatLastSeen = (timestamp: string | null | undefined) => {
    if (!timestamp) return "Never";
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
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
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, status, created_at, shipping_address, shipping_phone, shipping_name, total_amount, order_items(id, quantity, price, unit_price, products(name))")
        .eq("assigned_rider_id", rider.user_id)
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
      const updatePayload: Record<string, any> = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      if (nextStatus === "suspended") {
        updatePayload.is_online = false;
      }

      const { error } = await supabase
        .from("rider_profiles" as any)
        .update(updatePayload as any)
        .eq("id", riderId);
      if (error) throw error;

      const targetRider = riders.find((r) => r.id === riderId) || (selectedRider?.id === riderId ? selectedRider : null);
      if (targetRider?.user_id) {
        createNotification({
          userId: targetRider.user_id,
          title: nextStatus === "active" ? "Rider Account Activated 🚴" : "Rider Account Suspended ⚠️",
          message: nextStatus === "active"
            ? "Your rider dispatch account has been activated. You can now accept deliveries."
            : "Your rider dispatch account has been suspended. Please contact admin for assistance.",
          type: "general",
        });
      }

      toast({ title: `Rider ${nextStatus}`, description: `Rider status updated to ${nextStatus}.` });
      if (selectedRider && selectedRider.id === riderId) {
        setSelectedRider({ ...selectedRider, status: nextStatus });
      }
      fetchData();
    } catch (err: any) {
      toast({ title: "Error updating status", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setAdminReplyNotes(ticket.admin_notes || "");
    setUpdatingTicketStatus(ticket.status || "open");
    setTicketModalOpen(true);
  };

  const handleSaveTicketResponse = async () => {
    if (!selectedTicket) return;
    setSavingTicket(true);

    try {
      const { error } = await supabase
        .from("rider_support_tickets" as any)
        .update({
          admin_notes: adminReplyNotes.trim() || null,
          status: updatingTicketStatus,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedTicket.id);

      if (error) throw error;

      // Find the rider's user_id from the ticket
      const riderForTicket = riders.find((r) => r.id === selectedTicket.rider_id);
      const recipientUserId = riderForTicket?.user_id || selectedTicket.rider_id;
      if (recipientUserId) {
        createNotification({
          userId: recipientUserId,
          title: "Support Ticket Updated 💬",
          message: `Admin responded to your ticket: "${selectedTicket.subject}" (${updatingTicketStatus}).`,
          type: "general",
        });
      }

      toast({
        title: "Ticket Updated! 🎟️",
        description: "Admin response saved and status updated for the rider.",
      });

      setTicketModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Failed to update ticket",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingTicket(false);
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
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="riders" className="gap-2">
            <Bike className="w-4 h-4" /> Registered Riders ({riders.length})
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Access Codes ({accessCodes.filter((c) => !c.is_used).length} unused)
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <LifeBuoy className="w-4 h-4 text-emerald-600" /> Rider Reports ({tickets.filter((t) => t.status === "open").length})
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: REGISTERED RIDERS DIRECTORY ─────────────────────────────────── */}
        <TabsContent value="riders" className="space-y-6 mt-6">
          {/* Live Status Metric Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">Online (Available)</span>
                <span className="text-xl font-bold text-emerald-700">
                  {riders.filter((r) => r.status !== "suspended" && isRiderOnline(r) && (activeOrdersByRider[r.user_id] || 0) === 0).length}
                </span>
              </div>
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-100" />
            </div>
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">On Delivery (Busy)</span>
                <span className="text-xl font-bold text-amber-700">
                  {riders.filter((r) => r.status !== "suspended" && (activeOrdersByRider[r.user_id] || 0) > 0).length}
                </span>
              </div>
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
            </div>
            <div className="p-3 bg-gray-50/80 border border-gray-200 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block">Offline</span>
                <span className="text-xl font-bold text-gray-700">
                  {riders.filter((r) => r.status !== "suspended" && !isRiderOnline(r) && (activeOrdersByRider[r.user_id] || 0) === 0).length}
                </span>
              </div>
              <div className="w-3.5 h-3.5 rounded-full bg-gray-400" />
            </div>
            <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wider block">Suspended</span>
                <span className="text-xl font-bold text-red-600">
                  {riders.filter((r) => r.status === "suspended").length}
                </span>
              </div>
              <div className="w-3.5 h-3.5 rounded-full bg-red-500" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Delivery Riders Directory</h2>
              <p className="text-xs text-muted-foreground">
                Real-time rider tracking, availability status, active packages, and delivery performance.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(false)}
                disabled={refreshing}
                className="gap-1.5 text-xs h-9 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
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
          </div>

          {filteredRiders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                No registered riders found. Generate an access code under "Access Codes" to allow new riders to register.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRiders.map((rider) => {
                const presence = getRiderPresence(rider);
                return (
                  <Card
                    key={rider.id}
                    onClick={() => handleOpenRiderDetails(rider)}
                    className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group relative overflow-hidden"
                  >
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
                              <Bike className="w-5 h-5" />
                            </div>
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${presence.dotClass}`} />
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
                          variant="outline"
                          className={`text-[10px] font-semibold border ${presence.badgeClass}`}
                        >
                          {presence.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs text-gray-600">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Access Code</span>
                          <span className="font-mono font-medium text-gray-900">{rider.access_code}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Vehicle</span>
                          <span className="font-medium text-gray-900">{rider.vehicle_type}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Last Seen</span>
                          <span className="font-medium text-gray-700">{formatLastSeen(rider.last_seen_at)}</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-primary font-semibold pt-1 flex items-center justify-between">
                        <span>View Delivery History & Packages →</span>
                        {presence.activeCount > 0 && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {presence.activeCount} in transit
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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

        {/* ─── TAB 3: RIDER SUPPORT TICKETS & REPORTS ────────────────────────── */}
        <TabsContent value="reports" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Rider Issue Reports & Support Tickets</h2>
              <p className="text-xs text-muted-foreground">
                Review, respond to, and resolve support requests submitted by delivery riders.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
                className="text-xs border rounded-md px-3 py-2 bg-background font-medium"
              >
                <option value="all">All Statuses ({tickets.length})</option>
                <option value="open">Open Only ({tickets.filter((t) => t.status === "open").length})</option>
                <option value="in_progress">In Progress ({tickets.filter((t) => t.status === "in_progress").length})</option>
                <option value="resolved">Resolved ({tickets.filter((t) => t.status === "resolved").length})</option>
              </select>
            </div>
          </div>

          {tickets.filter((t) => ticketStatusFilter === "all" || t.status === ticketStatusFilter).length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                No support tickets found matching this filter.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets
                .filter((t) => ticketStatusFilter === "all" || t.status === ticketStatusFilter)
                .map((ticket) => {
                  const isResolved = ticket.status === "resolved";
                  const isInProgress = ticket.status === "in_progress";

                  return (
                    <Card
                      key={ticket.id}
                      onClick={() => handleOpenTicketDetails(ticket)}
                      className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md relative overflow-hidden"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant="outline" className="mb-2 uppercase text-[10px] tracking-wider font-semibold">
                              {ticket.category.replace("_", " ")}
                            </Badge>
                            <CardTitle className="text-base font-bold line-clamp-1">{ticket.subject}</CardTitle>
                          </div>
                          <Badge
                            className={
                              isResolved
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : isInProgress
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-blue-100 text-blue-800 border-blue-300"
                            }
                          >
                            {ticket.status.toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <p className="text-muted-foreground line-clamp-2">{ticket.description}</p>
                        <div className="flex justify-between items-center pt-2 border-t text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <User className="w-3 h-3 text-primary" /> {ticket.rider_name} ({ticket.rider_phone})
                          </span>
                          <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                        {ticket.admin_notes && (
                          <div className="bg-primary/5 p-2 rounded border border-primary/20 text-[11px]">
                            <span className="font-semibold text-primary block mb-0.5">Admin Response:</span>
                            <span className="text-muted-foreground line-clamp-1">{ticket.admin_notes}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── RIDER PROFILE & DELIVERIES HISTORY MODAL DIALOG ────────────────────── */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedRider && (() => {
            const presence = getRiderPresence(selectedRider);
            return (
              <div className="space-y-6 pt-2">
                {/* Header Profile Info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary/30 p-4 rounded-xl border">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">
                        <Bike className="w-7 h-7" />
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${presence.dotClass}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-900">{selectedRider.full_name}</h2>
                        <Badge variant="outline" className={`text-[10px] font-semibold border ${presence.badgeClass}`}>
                          {presence.label}
                        </Badge>
                      </div>
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
                        <span>·</span>
                        <span className="text-gray-700 font-medium">Last Active: {formatLastSeen(selectedRider.last_seen_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={selectedRider.status === "active" ? "default" : "destructive"}>
                      Account: {selectedRider.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant={isRiderOnline(selectedRider) ? "secondary" : "outline"}
                      onClick={(e) => toggleRiderOnlineStatus(selectedRider.id, isRiderOnline(selectedRider), e)}
                      className="text-xs gap-1.5"
                    >
                      <span className={`w-2 h-2 rounded-full ${isRiderOnline(selectedRider) ? "bg-emerald-500" : "bg-gray-400"}`} />
                      {isRiderOnline(selectedRider) ? "Set Offline" : "Set Online"}
                    </Button>
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
                            {order.shipping_name && (
                              <div className="font-semibold text-gray-900 flex items-center gap-1">
                                <User className="w-3 h-3 text-primary" /> Customer: {order.shipping_name}
                              </div>
                            )}
                            {(order.shipping_address || order.delivery_address) && (
                              <div className="flex items-start gap-1">
                                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                <span>Destination: {order.shipping_address || order.delivery_address}</span>
                              </div>
                            )}
                            {(order.shipping_phone || order.phone) && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>Phone: {order.shipping_phone || order.phone}</span>
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
                                {order.order_items.map((item) => {
                                  const itemPrice = Number(item.price ?? item.unit_price ?? 0);
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex justify-between items-center bg-background px-2.5 py-1 rounded border text-[11px]"
                                    >
                                      <span className="font-medium text-gray-800">
                                        {item.quantity}x {item.products?.name || "Product"}
                                      </span>
                                      <span className="font-semibold">
                                        GH₵{(itemPrice * item.quantity).toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                })}
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
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── TICKET DETAILS & ADMIN RESPONSE MODAL DIALOG ────────────────────── */}
      <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <LifeBuoy className="w-5 h-5 text-emerald-600" />
              Manage Rider Support Ticket
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-5 pt-2">
              <div className="bg-secondary/40 p-4 rounded-xl border space-y-2">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {selectedTicket.category.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Submitted {new Date(selectedTicket.created_at).toLocaleString()}
                  </span>
                </div>
                <h3 className="font-bold text-base text-foreground">{selectedTicket.subject}</h3>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              <div className="flex items-center justify-between text-xs bg-background p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block">Rider Info:</span>
                  <span className="font-bold text-foreground">{selectedTicket.rider_name}</span> ({selectedTicket.rider_phone})
                </div>
                <a
                  href={`tel:${selectedTicket.rider_phone}`}
                  className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-md font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Rider
                </a>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">TICKET STATUS</Label>
                <select
                  value={updatingTicketStatus}
                  onChange={(e) => setUpdatingTicketStatus(e.target.value)}
                  className="w-full text-xs border rounded-lg p-2.5 bg-background font-medium"
                >
                  <option value="open">OPEN (Awaiting Review)</option>
                  <option value="in_progress">IN PROGRESS (Being Resolved)</option>
                  <option value="resolved">RESOLVED (Completed)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">ADMIN RESPONSE NOTE (Visible to Rider)</Label>
                <textarea
                  value={adminReplyNotes}
                  onChange={(e) => setAdminReplyNotes(e.target.value)}
                  placeholder="Type instructions, resolution notes, or reply to the rider..."
                  rows={4}
                  className="w-full text-xs border rounded-lg p-3 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setTicketModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveTicketResponse}
                  disabled={savingTicket}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {savingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Save Response & Notify Rider
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
