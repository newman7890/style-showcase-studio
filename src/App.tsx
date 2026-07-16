import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AIChatbot } from "@/components/AIChatbot";
import Index from "./pages/Index";
import Products from "./pages/Products";
import Department from "./pages/Department";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Profile from "./pages/Profile";
import Favorites from "./pages/Favorites";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import TrackOrder from "./pages/TrackOrder";
import Settings from "./pages/Settings";
import PersonalInformation from "./pages/PersonalInformation";
import Notifications from "./pages/Notifications";
import Address from "./pages/Address";
import Language from "./pages/Language";
import ContactUs from "./pages/ContactUs";
import ChangePassword from "./pages/ChangePassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import OrderHistory from "./pages/OrderHistory";
import PaymentCallback from "./pages/PaymentCallback";
import SharedWishlist from "./pages/SharedWishlist";
import NotFound from "./pages/NotFound";
import RiderLogin from "./pages/rider/RiderLogin";
import RiderDashboard from "./pages/rider/RiderDashboard";
import RiderOrderDetail from "./pages/rider/RiderOrderDetail";
import { RiderProtectedRoute } from "@/components/RiderProtectedRoute";
import Sell from "./pages/Sell";
import SellerDashboard from "./pages/SellerDashboard";
import { SellerProtectedRoute } from "@/components/SellerProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <LanguageProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<Products />} />
              <Route path="/department/:slug" element={<Department />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
              <Route path="/track" element={<TrackOrder />} />
              <Route path="/track/:trackingCode" element={<TrackOrder />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/personal" element={<PersonalInformation />} />
              <Route path="/profile/notifications" element={<Notifications />} />
              <Route path="/profile/address" element={<Address />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/language" element={<Language />} />
              <Route path="/settings/contact" element={<ContactUs />} />
              <Route path="/settings/password" element={<ChangePassword />} />
              <Route path="/settings/privacy" element={<PrivacyPolicy />} />
              <Route path="/orders" element={<OrderHistory />} />
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/wishlist/:token" element={<SharedWishlist />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route path="/sell" element={<Sell />} />
              <Route
                path="/seller"
                element={
                  <SellerProtectedRoute>
                    <SellerDashboard />
                  </SellerProtectedRoute>
                }
              />
              {/* Rider Delivery App Routes */}
              <Route path="/rider/login" element={<RiderLogin />} />
              <Route path="/rider/dashboard" element={
                <RiderProtectedRoute><RiderDashboard /></RiderProtectedRoute>
              } />
              <Route path="/rider/order/:id" element={
                <RiderProtectedRoute><RiderOrderDetail /></RiderProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AIChatbot />
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
