import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Building2, Package, ArrowRightLeft, CheckCircle2, Clock, XCircle, Mail, Phone, MapPin, ExternalLink, Info, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const HubManagement = () => {
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHub, setNewHub] = useState({
    name: "",
    region: "",
    address: "",
    contact_phone: "",
    contact_email: "",
    operating_hours: "Mon - Fri: 8:00 AM - 5:00 PM",
    dropoff_instructions: "",
    google_maps_url: "",
  });

  const [editingHub, setEditingHub] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updatingHub, setUpdatingHub] = useState(false);

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
      toast.success("Hub created successfully!");
      setNewHub({
        name: "",
        region: "",
        address: "",
        contact_phone: "",
        contact_email: "",
        operating_hours: "Mon - Fri: 8:00 AM - 5:00 PM",
        dropoff_instructions: "",
        google_maps_url: "",
      });
      loadData();
    }
  };

  const openEditHub = (hub: any) => {
    setEditingHub({ ...hub });
    setEditDialogOpen(true);
  };

  const handleUpdateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHub) return;
    setUpdatingHub(true);
    try {
      const { error } = await supabase
        .from("hubs")
        .update({
          name: editingHub.name,
          region: editingHub.region,
          address: editingHub.address,
          contact_phone: editingHub.contact_phone,
          contact_email: editingHub.contact_email,
          operating_hours: editingHub.operating_hours,
          dropoff_instructions: editingHub.dropoff_instructions,
          google_maps_url: editingHub.google_maps_url,
        })
        .eq("id", editingHub.id);

      if (error) throw error;
      toast.success("Hub updated successfully!");
      setEditDialogOpen(false);
      setEditingHub(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update hub");
    } finally {
      setUpdatingHub(false);
    }
  };

  const handleDeleteHub = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    const { error } = await supabase.from("hubs").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Hub "${name}" deleted`);
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
            <CardHeader><CardTitle>Add New Fulfillment Hub</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateHub} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Hub Name *</Label>
                  <Input placeholder="e.g. Accra Central Hub" value={newHub.name} onChange={e => setNewHub({...newHub, name: e.target.value})} required />
                </div>
                <div>
                  <Label>Region *</Label>
                  <Input placeholder="e.g. Greater Accra" value={newHub.region} onChange={e => setNewHub({...newHub, region: e.target.value})} required />
                </div>
                <div className="md:col-span-2">
                  <Label>Physical Address *</Label>
                  <Input placeholder="e.g. 14 Ring Road Central, Kwame Nkrumah Circle" value={newHub.address} onChange={e => setNewHub({...newHub, address: e.target.value})} required />
                </div>
                <div>
                  <Label>Contact Phone Number</Label>
                  <Input placeholder="e.g. +233 24 123 4567" value={newHub.contact_phone} onChange={e => setNewHub({...newHub, contact_phone: e.target.value})} />
                </div>
                <div>
                  <Label>Business Support Email</Label>
                  <Input type="email" placeholder="e.g. accra-hub@store.com" value={newHub.contact_email} onChange={e => setNewHub({...newHub, contact_email: e.target.value})} />
                </div>
                <div>
                  <Label>Operating Hours</Label>
                  <Input placeholder="e.g. Mon - Fri: 8am - 5pm, Sat: 9am - 1pm" value={newHub.operating_hours} onChange={e => setNewHub({...newHub, operating_hours: e.target.value})} />
                </div>
                <div>
                  <Label>Google Maps Live Location URL</Label>
                  <Input placeholder="e.g. https://maps.google.com/..." value={newHub.google_maps_url} onChange={e => setNewHub({...newHub, google_maps_url: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                  <Label>Drop-off Instructions for Sellers</Label>
                  <Textarea placeholder="Instructions on how sellers should deliver packages (e.g. Present Order ID at Gate 2 loading dock)" value={newHub.dropoff_instructions} onChange={e => setNewHub({...newHub, dropoff_instructions: e.target.value})} rows={2} />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-fit"><Plus className="w-4 h-4 mr-2" /> Add Hub</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hubs.map(hub => (
              <Card key={hub.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold">{hub.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">{hub.region}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => openEditHub(hub)}
                        title="Edit Hub Details"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteHub(hub.id, hub.name)}
                        title="Delete Hub"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-xs space-y-2.5 text-muted-foreground">
                  <div className="flex items-start gap-2 text-gray-800">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{hub.address}</span>
                  </div>

                  {hub.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <a href={`tel:${hub.contact_phone}`} className="hover:underline text-emerald-700 font-medium">{hub.contact_phone}</a>
                    </div>
                  )}

                  {hub.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <a href={`mailto:${hub.contact_email}`} className="hover:underline text-blue-700 font-medium">{hub.contact_email}</a>
                    </div>
                  )}

                  {hub.operating_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{hub.operating_hours}</span>
                    </div>
                  )}

                  {hub.dropoff_instructions && (
                    <div className="p-2 bg-gray-50 rounded border text-gray-700 flex items-start gap-1.5 mt-2">
                      <Info className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                      <span>{hub.dropoff_instructions}</span>
                    </div>
                  )}

                  {hub.google_maps_url && (
                    <a
                      href={hub.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary font-medium hover:underline mt-1"
                    >
                      <ExternalLink className="w-3 h-3" /> View Live Location on Map
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Hub Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <Pencil className="w-5 h-5 text-primary" /> Edit Hub Details
                </DialogTitle>
              </DialogHeader>
              {editingHub && (
                <form onSubmit={handleUpdateHub} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label>Hub Name *</Label>
                    <Input
                      value={editingHub.name || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Region *</Label>
                    <Input
                      value={editingHub.region || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, region: e.target.value })}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Physical Address *</Label>
                    <Input
                      value={editingHub.address || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, address: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Contact Phone Number</Label>
                    <Input
                      value={editingHub.contact_phone || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, contact_phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Business Support Email</Label>
                    <Input
                      type="email"
                      value={editingHub.contact_email || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, contact_email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Operating Hours</Label>
                    <Input
                      value={editingHub.operating_hours || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, operating_hours: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Google Maps Live Location URL</Label>
                    <Input
                      value={editingHub.google_maps_url || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, google_maps_url: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Drop-off Instructions for Sellers</Label>
                    <Textarea
                      rows={3}
                      value={editingHub.dropoff_instructions || ""}
                      onChange={(e) => setEditingHub({ ...editingHub, dropoff_instructions: e.target.value })}
                    />
                  </div>
                  <DialogFooter className="md:col-span-2 gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updatingHub}>
                      {updatingHub ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
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
