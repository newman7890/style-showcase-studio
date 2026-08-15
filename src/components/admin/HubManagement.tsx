import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Building2, Package, ArrowRightLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const HubManagement = () => {
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHub, setNewHub] = useState({ name: "", region: "", address: "", contact_phone: "" });
  const [dropoffs, setDropoffs] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [hubsRes, dropoffsRes] = await Promise.all([
      supabase.from("hubs").select("*").order("created_at", { ascending: false }),
      supabase
        .from("seller_dropoffs")
        .select("*, hubs(name)")
        .order("created_at", { ascending: false }),
    ]);
    if (hubsRes.data) setHubs(hubsRes.data);

    // Enrich dropoffs with seller business names
    const rawDropoffs = dropoffsRes.data || [];
    if (rawDropoffs.length > 0) {
      const sellerIds = [...new Set(rawDropoffs.map((d) => d.seller_id))];
      const { data: sellerProfiles } = await supabase
        .from("seller_profiles")
        .select("user_id, business_name")
        .in("user_id", sellerIds);

      const sellerMap = new Map(
        (sellerProfiles || []).map((sp) => [sp.user_id, sp.business_name])
      );

      setDropoffs(
        rawDropoffs.map((d) => ({
          ...d,
          seller_business_name: sellerMap.get(d.seller_id) || null,
        }))
      );
    } else {
      setDropoffs([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("hubs").insert(newHub);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Hub created");
      setNewHub({ name: "", region: "", address: "", contact_phone: "" });
      loadData();
    }
  };

  const updateDropoffStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("seller_dropoffs").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Drop-off marked as ${status}`);
      loadData();
    }
  };

  const pendingDropoffs = dropoffs.filter((d) => d.status === "pending");
  const receivedDropoffs = dropoffs.filter((d) => d.status === "received");
  const rejectedDropoffs = dropoffs.filter((d) => d.status === "rejected");

  const DropoffStatusBadge = ({ status }: { status: string }) => {
    if (status === "received") return <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" />Received</Badge>;
    if (status === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="hubs">
        <TabsList>
          <TabsTrigger value="hubs"><Building2 className="w-4 h-4 mr-2" /> Hub Locations</TabsTrigger>
          <TabsTrigger value="receiving">
            <Package className="w-4 h-4 mr-2" /> Receiving Dock
            {pendingDropoffs.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">{pendingDropoffs.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="transfers"><ArrowRightLeft className="w-4 h-4 mr-2" /> Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="hubs" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle>Add New Hub</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateHub} className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hub Name</Label>
                  <Input value={newHub.name} onChange={e => setNewHub({...newHub, name: e.target.value})} required />
                </div>
                <div>
                  <Label>Region</Label>
                  <Input value={newHub.region} onChange={e => setNewHub({...newHub, region: e.target.value})} required />
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <Input value={newHub.address} onChange={e => setNewHub({...newHub, address: e.target.value})} required />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input value={newHub.contact_phone} onChange={e => setNewHub({...newHub, contact_phone: e.target.value})} />
                </div>
                <Button type="submit" className="w-fit mt-2"><Plus className="w-4 h-4 mr-2" /> Add Hub</Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hubs.map(hub => (
              <Card key={hub.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{hub.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2 text-muted-foreground">
                  <p><strong>Region:</strong> {hub.region}</p>
                  <p><strong>Address:</strong> {hub.address}</p>
                  {hub.contact_phone && <p><strong>Phone:</strong> {hub.contact_phone}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="receiving" className="mt-6 space-y-6">
          {/* Pending */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Pending Seller Drop-offs</h2>
            {pendingDropoffs.length === 0 ? (
              <p className="text-muted-foreground">No pending drop-offs at any hub.</p>
            ) : (
              <div className="space-y-3">
                {pendingDropoffs.map(d => (
                  <Card key={d.id}>
                    <CardContent className="pt-4 flex justify-between items-center">
                      <div>
                        <div className="font-semibold">
                          Seller: {d.seller_business_name || d.seller_id?.slice(0, 8) + "..."}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Hub: {d.hubs?.name || "Unknown"} · {new Date(d.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateDropoffStatus(d.id, "received")}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Receive
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateDropoffStatus(d.id, "rejected")}>
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Recent History */}
          {(receivedDropoffs.length > 0 || rejectedDropoffs.length > 0) && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Recent History</h2>
              <div className="space-y-2">
                {[...receivedDropoffs, ...rejectedDropoffs]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 20)
                  .map(d => (
                    <Card key={d.id} className="opacity-75">
                      <CardContent className="pt-4 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">
                            {d.seller_business_name || d.seller_id?.slice(0, 8) + "..."}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.hubs?.name} · {new Date(d.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <DropoffStatusBadge status={d.status} />
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transfers" className="mt-6">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Inter-hub transfer manifests will be generated here when orders require items from multiple regions.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
