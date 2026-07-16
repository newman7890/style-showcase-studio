import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Package, ShoppingCart, Users, BarChart3, Tag, MessageSquare, Sparkles, LayoutGrid, Truck, Store, PackageCheck, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductManagement } from "@/components/admin/ProductManagement";
import { OrderManagement } from "@/components/admin/OrderManagement";
import { CustomerList } from "@/components/admin/CustomerList";
import { SalesAnalytics } from "@/components/admin/SalesAnalytics";
import { DiscountManagement } from "@/components/admin/DiscountManagement";
import { TestimonialManagement } from "@/components/admin/TestimonialManagement";
import { NewArrivalsManagement } from "@/components/admin/NewArrivalsManagement";
import { CategoryManagement } from "@/components/admin/CategoryManagement";
import { DeliveryFeeManagement } from "@/components/admin/DeliveryFeeManagement";
import { SellerApprovalsManagement } from "@/components/admin/SellerApprovalsManagement";
import { ProductApprovalsManagement } from "@/components/admin/ProductApprovalsManagement";
import { PlatformSettingsManagement } from "@/components/admin/PlatformSettingsManagement";

const Admin = () => {
  const { user, isAdmin, isSeller, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !isSeller))) {
      navigate("/auth");
    }
  }, [user, isAdmin, isSeller, loading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin && !isSeller) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl md:text-4xl font-semibold"
            >
              Admin Dashboard
            </motion.h1>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          <Tabs defaultValue="seller-apps" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:w-auto lg:inline-flex flex-wrap h-auto">
              {isAdmin && (
                <>
                  <TabsTrigger value="seller-apps" className="flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    <span className="hidden sm:inline">Sellers</span>
                  </TabsTrigger>
                  <TabsTrigger value="product-approvals" className="flex items-center gap-2">
                    <PackageCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">Approvals</span>
                  </TabsTrigger>
                  <TabsTrigger value="platform" className="flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    <span className="hidden sm:inline">Commission</span>
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Products</span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="new-arrivals" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">New Arrivals</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Orders</span>
              </TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger value="discounts" className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    <span className="hidden sm:inline">Discounts</span>
                  </TabsTrigger>
                  <TabsTrigger value="delivery" className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    <span className="hidden sm:inline">Delivery</span>
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Customers</span>
                  </TabsTrigger>
                  <TabsTrigger value="testimonials" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Testimonials</span>
                  </TabsTrigger>
                  <TabsTrigger value="categories" className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:inline">Categories</span>
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seller-apps"><SellerApprovalsManagement /></TabsContent>
            <TabsContent value="product-approvals"><ProductApprovalsManagement /></TabsContent>
            <TabsContent value="platform"><PlatformSettingsManagement /></TabsContent>


            <TabsContent value="products">
              <ProductManagement />
            </TabsContent>


            <TabsContent value="new-arrivals">
              <NewArrivalsManagement />
            </TabsContent>

            <TabsContent value="orders">
              <OrderManagement />
            </TabsContent>

            <TabsContent value="discounts">
              <DiscountManagement />
            </TabsContent>

            <TabsContent value="delivery">
              <DeliveryFeeManagement />
            </TabsContent>

            <TabsContent value="customers">
              <CustomerList />
            </TabsContent>

            <TabsContent value="testimonials">
              <TestimonialManagement />
            </TabsContent>

            <TabsContent value="categories">
              <CategoryManagement />
            </TabsContent>

            <TabsContent value="analytics">
              <SalesAnalytics />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <BottomNav />
    </>
  );
};

export default Admin;
