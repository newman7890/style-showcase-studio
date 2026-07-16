import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, ShoppingCart, Package, Users, CreditCard, CheckCircle, XCircle, RefreshCw, Download, FileText, FileSpreadsheet, Calendar, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToPDF } from "@/utils/exportUtils";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from "date-fns";

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  ordersByStatus: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  topProducts: { name: string; sold: number }[];
  paymentMethodStats: { method: string; count: number; revenue: number }[];
  successfulPayments: number;
  failedPayments: number;
  refundedOrders: number;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142, 76%, 36%)",
  "hsl(221, 83%, 53%)",
  "hsl(280, 87%, 65%)",
];

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
  orders: {
    label: "Orders",
    color: "hsl(var(--accent))",
  },
};

const presetRanges = [
  { label: "Last 7 days", value: "7days" },
  { label: "Last 30 days", value: "30days" },
  { label: "This month", value: "thisMonth" },
  { label: "Last month", value: "lastMonth" },
  { label: "This year", value: "thisYear" },
  { label: "All time", value: "all" },
];

export const SalesAnalytics = () => {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [presetRange, setPresetRange] = useState<string>("all");

  const applyPresetRange = (preset: string) => {
    const today = new Date();
    let from: Date | undefined;
    let to: Date | undefined = today;

    switch (preset) {
      case "7days":
        from = subDays(today, 7);
        break;
      case "30days":
        from = subDays(today, 30);
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "lastMonth":
        const lastMonth = subDays(startOfMonth(today), 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      case "thisYear":
        from = startOfYear(today);
        to = endOfYear(today);
        break;
      case "all":
        from = undefined;
        to = undefined;
        break;
    }

    setPresetRange(preset);
    setDateRange({ from, to });
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      // Fetch orders with optional date filtering
      let ordersQuery = supabase.from("orders").select("*");
      
      if (dateRange.from) {
        ordersQuery = ordersQuery.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange.to) {
        ordersQuery = ordersQuery.lte("created_at", dateRange.to.toISOString());
      }
      
      const { data: orders, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      // Fetch products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*");

      if (productsError) throw productsError;

      // Fetch customers
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id");

      if (profilesError) throw profilesError;

      // Get order IDs for filtering order items
      const orderIds = (orders || []).map(o => o.id);
      
      // Fetch order items for the filtered orders
      let orderItemsData: { product_id: string; quantity: number }[] = [];
      if (orderIds.length > 0) {
        const { data: orderItems, error: orderItemsError } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .in("order_id", orderIds);

        if (orderItemsError) throw orderItemsError;
        orderItemsData = orderItems || [];
      }

      // Filter orders based on date range
      const filteredOrders = orders || [];

      // Calculate analytics
      const totalRevenue = filteredOrders.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0
      );

      const ordersByStatus = (orders || []).reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate revenue by month
      const revenueByMonthMap = (orders || []).reduce((acc, order) => {
        const month = new Date(order.created_at).toLocaleDateString("en-US", {
          month: "short",
        });
        acc[month] = (acc[month] || 0) + Number(order.total_amount);
        return acc;
      }, {} as Record<string, number>);

      const revenueByMonth = Object.entries(revenueByMonthMap).map(([month, revenue]) => ({
        month,
        revenue,
      }));

      // Calculate top products
      const productSales = orderItemsData.reduce((acc, item) => {
        acc[item.product_id] = (acc[item.product_id] || 0) + item.quantity;
        return acc;
      }, {} as Record<string, number>);

      const productMap = (products || []).reduce((acc, product) => {
        acc[product.id] = product.name;
        return acc;
      }, {} as Record<string, string>);

      const topProducts = Object.entries(productSales)
        .map(([productId, sold]) => ({
          name: productMap[productId] || "Unknown",
          sold: sold as number,
        }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 5);

      // Calculate payment method statistics
      const paymentMethodStatsMap = (orders || []).reduce((acc, order) => {
        const method = order.payment_method || "unknown";
        if (!acc[method]) {
          acc[method] = { count: 0, revenue: 0 };
        }
        acc[method].count += 1;
        acc[method].revenue += Number(order.total_amount);
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      const paymentMethodStats = Object.entries(paymentMethodStatsMap).map(([method, stats]) => ({
        method: method.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        count: stats.count,
        revenue: stats.revenue,
      }));

      // Calculate payment success/failure stats
      const successfulPayments = (orders || []).filter(o => 
        ["processing", "shipped", "delivered", "completed"].includes(o.status)
      ).length;
      
      const failedPayments = (orders || []).filter(o => 
        o.status === "payment_failed"
      ).length;

      const refundedOrders = (orders || []).filter(o => 
        ["refunded", "refund_pending"].includes(o.status)
      ).length;

      setAnalytics({
        totalRevenue,
        totalOrders: orders?.length || 0,
        totalProducts: products?.length || 0,
        totalCustomers: profiles?.length || 0,
        ordersByStatus,
        revenueByMonth,
        topProducts,
        paymentMethodStats,
        successfulPayments,
        failedPayments,
        refundedOrders,
      });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load analytics data.
      </div>
    );
  }

  const statusData = Object.entries(analytics.ordersByStatus).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Sales Analytics</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Select value={presetRange} onValueChange={applyPresetRange}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {presetRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Custom
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">From Date</p>
                    <CalendarComponent
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => {
                        setDateRange(prev => ({ ...prev, from: date }));
                        setPresetRange("");
                      }}
                      initialFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">To Date</p>
                    <CalendarComponent
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => {
                        setDateRange(prev => ({ ...prev, to: date }));
                        setPresetRange("");
                      }}
                      initialFocus
                    />
                  </div>
                  {(dateRange.from || dateRange.to) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        setDateRange({ from: undefined, to: undefined });
                        setPresetRange("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Show active date range */}
          {(dateRange.from || dateRange.to) && (
            <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
              {dateRange.from ? format(dateRange.from, "MMM d, yyyy") : "Start"} - {dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "Now"}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCSV(analytics)} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF(analytics)} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">GH₵{analytics.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{analytics.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{analytics.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{analytics.totalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Statistics */}
      <h3 className="text-xl font-semibold mt-8">Payment Statistics</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Successful Payments</p>
                <p className="text-2xl font-bold">{analytics.successfulPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed Payments</p>
                <p className="text-2xl font-bold">{analytics.failedPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Refunded Orders</p>
                <p className="text-2xl font-bold">{analytics.refundedOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.revenueByMonth.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={analytics.revenueByMonth}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No revenue data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Orders by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No order data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Revenue by Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.paymentMethodStats.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={analytics.paymentMethodStats.map(s => ({
                      name: s.method,
                      value: s.revenue
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: GH₵${value.toFixed(0)}`}
                  >
                    {analytics.paymentMethodStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No payment data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.paymentMethodStats.length > 0 ? (
              <div className="space-y-4">
                {analytics.paymentMethodStats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="font-medium">{stat.method}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">GH₵{stat.revenue.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{stat.count} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No payment data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              Top Selling Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topProducts.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={analytics.topProducts} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="sold"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No product sales data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};
