import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const RiderProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isRider, setIsRider] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "rider")
        .single()
        .then(({ data }) => setIsRider(!!data));
    } else if (!authLoading) {
      setIsRider(false);
    }
  }, [user, authLoading]);

  if (authLoading || isRider === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isRider) {
    return <Navigate to="/rider/login" replace />;
  }

  return <>{children}</>;
};
