import { useState, useEffect, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SellerStatus = "none" | "pending" | "approved" | "rejected" | "suspended";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSeller: boolean; // convenience: seller_status === 'approved'
  sellerStatus: SellerStatus;
  loading: boolean;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isSeller: false,
  sellerStatus: "none",
  loading: true,
  refreshRoles: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>("none");
  const [loading, setLoading] = useState(true);

  const loadRoles = async (userId: string) => {
    try {
      const [rolesRes, sellerRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase
          .from("seller_profiles")
          .select("status")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      const roles = (rolesRes.data ?? []).map((r: any) => r.role);
      setIsAdmin(roles.includes("admin"));
      setSellerStatus(((sellerRes.data as any)?.status as SellerStatus) ?? "none");
    } catch {
      setIsAdmin(false);
      setSellerStatus("none");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          setIsAdmin(false);
          setSellerStatus("none");
          setLoading(true);
          setTimeout(() => loadRoles(s.user.id), 0);
        } else {
          setIsAdmin(false);
          setSellerStatus("none");
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadRoles(session.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshRoles = async () => {
    if (user) await loadRoles(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        isSeller: sellerStatus === "approved",
        sellerStatus,
        loading,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
