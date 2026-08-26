import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Loader2, Copy, Download, Trash2, Calendar, CheckCircle2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Subscriber {
  id: string;
  email: string;
  subscribed_at: string;
  is_active: boolean;
}

export const SubscribersManagement = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from("subscribers" as any)
        .select("*")
        .order("subscribed_at", { ascending: false });

      if (error) throw error;
      setSubscribers((data as Subscriber[]) || []);
    } catch (err: any) {
      console.error("Error fetching subscribers:", err);
      toast.error("Failed to load newsletter subscribers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this subscriber?")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("subscribers" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Subscriber removed");
    } catch (err: any) {
      toast.error("Failed to delete subscriber");
    } finally {
      setDeletingId(null);
    }
  };

  const copyAllEmails = () => {
    const emails = subscribers.map((s) => s.email).join(", ");
    navigator.clipboard.writeText(emails);
    toast.success(`Copied ${subscribers.length} subscriber emails to clipboard!`);
  };

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Email,Subscribed Date", ...subscribers.map((s) => `"${s.email}","${new Date(s.subscribed_at).toLocaleString()}"`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tradespoint_subscribers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported subscribers CSV!");
  };

  const filtered = subscribers.filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Newsletter Subscribers</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage captured customer emails from the "Ready to Get Our New Stuff?" signup forms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyAllEmails} disabled={subscribers.length === 0} className="gap-2">
            <Copy className="w-4 h-4" /> Copy All Emails
          </Button>
          <Button size="sm" onClick={exportCSV} disabled={subscribers.length === 0} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filter and Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Input
          placeholder="Search subscriber email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-background h-10 rounded-xl"
        />
        <div className="text-xs text-muted-foreground font-semibold">
          Total Subscribers: <span className="text-foreground font-bold">{subscribers.length}</span>
        </div>
      </div>

      {/* List Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-2xl bg-card">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-semibold">No subscribers found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? "No emails match your search filter." : "When users submit their email on the site, they will appear here."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Date Joined</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((sub) => (
                  <tr key={sub.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{sub.email}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 opacity-70" />
                        <span>{new Date(sub.subscribed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(sub.id)}
                        disabled={deletingId === sub.id}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        {deletingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
