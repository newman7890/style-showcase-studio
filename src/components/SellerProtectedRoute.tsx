import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Wraps routes that only approved sellers (or admins) should see.
 * Redirects to /sell for pending/rejected/none, /auth for signed-out.
 */
export const SellerProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isSeller, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/sell" replace />;
  return <>{children}</>;
};
