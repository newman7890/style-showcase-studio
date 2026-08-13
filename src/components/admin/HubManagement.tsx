import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Building2, Package, ArrowRightLeft } from "lucide-react";
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
      supabase.from("seller_dropoffs").select("*, hubs(name), profiles(business_name)").eq("status", "pending")
    ]);
    if (hubsRes.data) setHubs(hubsRes.data);
    if (dropoffsRes.data) setDropoffs(dropoffsRes.data);
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

  const receiveDropoff = async (id: string) => {
    const { error } = await supabase.from("seller_dropoffs").update({ status: "received" }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Drop-off received successfully");
      loadData();
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="hubs">
        <TabsList>
          <TabsTrigger value="hubs"><Building2 className="w-4 h-4 mr-2" /> Hub Locations</TabsTrigger>
          <TabsTrigger value="receiving"><Package className="w-4 h-4 mr-2" /> Receiving Dock</TabsTrigger>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="receiving" className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Pending Seller Drop-offs</h2>
          {dropoffs.length === 0 ? (
            <p className="text-muted-foreground">No pending drop-offs at any hub.</p>
          ) : (
            <div className="space-y-4">
              {dropoffs.map(d => (
                <Card key={d.id}>
                  <CardContent className="pt-6 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Seller: {d.profiles?.business_name || d.seller_id}</div>
                      <div className="text-sm text-muted-foreground">Destination: {d.hubs?.name}</div>
                    </div>
                    <Button onClick={() => receiveDropoff(d.id)}>Mark Received</Button>
                  </CardContent>
                </Card>
              ))}
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
