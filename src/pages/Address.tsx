import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, MapPin, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AddressType {
  id: string;
  label: string;
  address: string;
  city: string;
  region: string;
  isDefault: boolean;
}

const Address = () => {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<AddressType[]>([
    {
      id: "1",
      label: "Home",
      address: "123 Main Street",
      city: "Accra",
      region: "Greater Accra",
      isDefault: true,
    },
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressType | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    address: "",
    city: "",
    region: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingAddress) {
      setAddresses(addresses.map(addr => 
        addr.id === editingAddress.id 
          ? { ...addr, ...formData }
          : addr
      ));
    } else {
      const newAddress: AddressType = {
        id: Date.now().toString(),
        ...formData,
        isDefault: addresses.length === 0,
      };
      setAddresses([...addresses, newAddress]);
    }
    
    setFormData({ label: "", address: "", city: "", region: "" });
    setEditingAddress(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (address: AddressType) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      address: address.address,
      city: address.city,
      region: address.region,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setAddresses(addresses.filter(addr => addr.id !== id));
  };

  const setDefault = (id: string) => {
    setAddresses(addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id,
    })));
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-background max-w-2xl mx-auto">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Addresses</h1>
          <div className="w-10 h-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 max-w-2xl mx-auto"
        >
          {/* Address List */}
          <div className="space-y-4 mb-6">
            {addresses.map((address, index) => (
              <motion.div
                key={address.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 border border-border rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{address.label}</p>
                        {address.isDefault && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{address.address}</p>
                      <p className="text-sm text-muted-foreground">{address.city}, {address.region}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(address)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => handleDelete(address.id)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                {!address.isDefault && (
                  <button 
                    onClick={() => setDefault(address.id)}
                    className="mt-3 text-sm text-primary font-medium"
                  >
                    Set as Default
                  </button>
                )}
              </motion.div>
            ))}

            {addresses.length === 0 && (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No addresses saved yet</p>
              </div>
            )}
          </div>

          {/* Add Address Button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add New Address
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAddress ? "Edit Address" : "Add New Address"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Home, Work"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter street address"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Enter city"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder="Enter region"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingAddress ? "Update Address" : "Save Address"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
      <BottomNav />
    </>
  );
};

export default Address;
