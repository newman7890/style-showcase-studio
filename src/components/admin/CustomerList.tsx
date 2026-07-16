import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Mail, Calendar, ShoppingBag, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CustomerData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  order_count: number;
  total_spent: number;
}

export const CustomerList = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CustomerData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const deleteCustomer = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: deleteTarget.id },
    });
    setDeleting(false);
    if (error) {
      return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    toast({ title: "Account deleted" });
    setDeleteTarget(null);
    fetchCustomers();
  };

  const fetchCustomers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch orders to calculate stats per customer
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("user_id, total_amount");

      if (ordersError) throw ordersError;

      // Calculate order stats for each customer
      const orderStats = (orders || []).reduce((acc, order) => {
        if (!acc[order.user_id]) {
          acc[order.user_id] = { count: 0, total: 0 };
        }
        acc[order.user_id].count++;
        acc[order.user_id].total += Number(order.total_amount);
        return acc;
      }, {} as Record<string, { count: number; total: number }>);

      // Combine profiles with order stats
      const customersWithStats: CustomerData[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at || "",
        order_count: orderStats[profile.id]?.count || 0,
        total_spent: orderStats[profile.id]?.total || 0,
      }));

      setCustomers(customersWithStats);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading customers...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Customer List</h2>
        <Badge variant="outline" className="text-sm">
          {customers.length} customers
        </Badge>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-border rounded-lg">
          No customers yet.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                        {customer.avatar_url ? (
                          <img
                            src={customer.avatar_url}
                            alt={customer.full_name || "Customer"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">
                        {customer.full_name || "No name"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{customer.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{formatDate(customer.created_at)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="secondary">{customer.order_count}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    GH₵{customer.total_spent.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-semibold">{customers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Customers</p>
              <p className="text-2xl font-semibold">
                {customers.filter((c) => c.order_count > 0).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Spent</p>
              <p className="text-2xl font-semibold">
                GH₵{customers.length > 0 
                  ? (customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length).toFixed(2) 
                  : "0.00"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
