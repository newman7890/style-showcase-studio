import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, DollarSign, ShoppingBag, Users, Bike, MapPin, RefreshCw, CheckCircle2, Clock, Truck, Package
} from "lucide-react";
import { toast } from "sonner";

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface RegionSales {
  region: string;
  count: number;
  revenue: number;
}

interface StatusDistribution {
  name: string;
  value: number;
  color: string;
}

interface RiderStat {
  rider_id: string;
  name: string;
  claimed_count: number;
  delivered_count: number;
  completion_rate: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#EAB308",
  confirmed: "#10B981",
  processing: "#3B82F6",
  shipped: "#A855F7",
  delivered: "#22C55E",
  cancelled: "#EF4444",
};

export const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalSellers, setTotalSellers] = useState(0);
  const [totalRiders, setTotalRiders] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  
  const [dailyData, setDailyData] = useState<DailyRevenue[]>([]);
  const [regionData, setRegionData] = useState<RegionSales[]>([]);
  const [statusData, setStatusData] = useState<StatusDistribution[]>([]);
  const [riderStats, setRiderStats] = useState<RiderStat[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders
      const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: true });

      if (oErr) throw oErr;

      // 2. Fetch Sellers
      const { count: sellerCount } = await supabase
        .from("seller_profiles")
        .select("*", { count: "exact", head: true });

      // 3. Fetch Riders
      const { data: riderProfiles } = await supabase
        .from("rider_profiles")
        .select("user_id, full_name");

      // 4. Fetch Seller Earnings
      const { data: earnings } = await supabase
        .from("seller_earnings")
        .select("platform_fee");

      const revenueSum = (orders || [])
        .filter((o) => o.payment_status === "paid" || o.status === "delivered" || o.status === "shipped")
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const commSum = (earnings || []).reduce((sum, e) => sum + Number(e.platform_fee || 0), 0);

      setTotalRevenue(revenueSum);
      setTotalOrders((orders || []).length);
      setTotalSellers(sellerCount || 0);
      setTotalRiders((riderProfiles || []).length);
      setTotalCommission(commSum > 0 ? commSum : revenueSum * 0.10);

      // Process Daily Trend Data
      const dailyMap = new Map<string, { revenue: number; orders: number }>();
      const regionMap = new Map<string, { count: number; revenue: number }>();
      const statusMap = new Map<string, number>();

      (orders || []).forEach((o) => {
        // Status Distribution
        const st = o.status || "pending";
        statusMap.set(st, (statusMap.get(st) || 0) + 1);

        // Region Sales
        const reg = o.shipping_region || "Accra";
        const currentReg = regionMap.get(reg) || { count: 0, revenue: 0 };
        currentReg.count += 1;
        currentReg.revenue += Number(o.total_amount || 0);
        regionMap.set(reg, currentReg);

        // Daily trend
        if (o.created_at) {
          const dateStr = new Date(o.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const currentDaily = dailyMap.get(dateStr) || { revenue: 0, orders: 0 };
          currentDaily.orders += 1;
          if (o.payment_status === "paid" || o.status === "delivered" || o.status === "shipped") {
            currentDaily.revenue += Number(o.total_amount || 0);
          }
          dailyMap.set(dateStr, currentDaily);
        }
      });

      // Format Daily Data
      const formattedDaily: DailyRevenue[] = Array.from(dailyMap.entries()).map(([date, val]) => ({
        date,
        revenue: Math.round(val.revenue * 100) / 100,
        orders: val.orders,
      }));

      setDailyData(formattedDaily.slice(-14)); // Last 14 days

      // Format Region Data
      const formattedRegion: RegionSales[] = Array.from(regionMap.entries())
        .map(([region, val]) => ({
          region,
          count: val.count,
          revenue: Math.round(val.revenue * 100) / 100,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      setRegionData(formattedRegion);

      // Format Status Distribution Data
      const formattedStatus: StatusDistribution[] = Array.from(statusMap.entries()).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: STATUS_COLORS[name] || "#94A3B8",
      }));

      setStatusData(formattedStatus);

      // Process Rider Performance Stats
      const riderMap = new Map<string, { name: string; claimed: number; delivered: number }>();
      (riderProfiles || []).forEach((r) => {
        riderMap.set(r.user_id, { name: r.full_name || "Rider", claimed: 0, delivered: 0 });
      });

      (orders || []).forEach((o) => {
        if (o.assigned_rider_id) {
          const r = riderMap.get(o.assigned_rider_id) || { name: "Rider", claimed: 0, delivered: 0 };
          r.claimed += 1;
          if (o.status === "delivered") {
            r.delivered += 1;
          }
          riderMap.set(o.assigned_rider_id, r);
        }
      });

      const formattedRiders: RiderStat[] = Array.from(riderMap.entries())
        .map(([rider_id, val]) => ({
          rider_id,
          name: val.name,
          claimed_count: val.claimed,
          delivered_count: val.delivered,
          completion_rate: val.claimed > 0 ? Math.round((val.delivered / val.claimed) * 100) : 0,
        }))
        .filter((r) => r.claimed_count > 0);

      setRiderStats(formattedRiders);
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      toast.error(err.message || "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Analytics & Growth</h2>
          <p className="text-muted-foreground text-sm">
            Real-time breakdown of revenue, sales volume, regional distribution, and rider performance metrics.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading} className="w-fit">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total GMV Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              GH₵{totalRevenue.toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Gross sales volume
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Platform Commission</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              GH₵{totalCommission.toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">10% marketplace share</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{totalOrders}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Total placed customer orders</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Sellers</CardTitle>
            <Users className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{totalSellers}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Registered marketplace vendors</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Registered Riders</CardTitle>
            <Bike className="w-4 h-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{totalRiders}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Active delivery personnel</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Trend Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Revenue & Order Volume Trend
            </CardTitle>
            <CardDescription>Daily revenue performance over recent order activity</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-4">
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No revenue data recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1E293B", borderRadius: "8px", border: "none", color: "#FFF" }}
                    formatter={(val: any) => [`GH₵${val}`, "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Distribution Donut Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              Order Status Breakdown
            </CardTitle>
            <CardDescription>Distribution of active order states</CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No order statuses to display.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1E293B", borderRadius: "8px", border: "none", color: "#FFF" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Region Sales & Rider Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Sales Breakdown */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-500" />
              Top Regions by Sales Volume
            </CardTitle>
            <CardDescription>Breakdown of sales revenue across Ghana delivery regions</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {regionData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No regional data recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="region" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1E293B", borderRadius: "8px", border: "none", color: "#FFF" }}
                    formatter={(val: any) => [`GH₵${val}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Rider Fulfillment Rate */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4 text-teal-500" />
              Rider Fulfillment & Completion Rate
            </CardTitle>
            <CardDescription>Delivery completion success rate per active rider</CardDescription>
          </CardHeader>
          <CardContent>
            {riderStats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No rider fulfillment activity recorded yet.</p>
            ) : (
              <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                {riderStats.map((r) => (
                  <div key={r.rider_id} className="flex items-center justify-between border-b border-border/40 pb-2.5 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.delivered_count} of {r.claimed_count} orders completed
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${r.completion_rate}%` }}
                        />
                      </div>
                      <Badge variant="outline" className="font-mono text-xs text-teal-500 border-teal-500/20">
                        {r.completion_rate}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
