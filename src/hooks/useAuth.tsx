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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isSeller: false,
  sellerStatus: "none",
  loading: true,
  refreshRoles: async () => {},
  signOut: async () => {},
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
    let currentUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        setSession(s);
        const newUser = s?.user ?? null;
        const newUserId = newUser?.id ?? null;

        setUser(newUser);

        if (newUserId) {
          // Only trigger loading & reload roles if the user actually changed (e.g. fresh login or switching accounts)
          // Background token refreshes (TOKEN_REFRESHED) or tab focus events MUST NOT reset loading to true!
          if (currentUserId !== newUserId) {
            currentUserId = newUserId;
            setIsAdmin(false);
            setSellerStatus("none");
            setLoading(true);
            setTimeout(() => loadRoles(newUserId), 0);
          }
        } else {
          currentUserId = null;
          setIsAdmin(false);
          setSellerStatus("none");
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const initialUser = session?.user ?? null;
      setUser(initialUser);
      if (initialUser) {
        currentUserId = initialUser.id;
        loadRoles(initialUser.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshRoles = async () => {
    if (user) await loadRoles(user.id);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    } finally {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase.auth"))) {
            localStorage.removeItem(key);
          }
        }
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase.auth"))) {
            sessionStorage.removeItem(key);
          }
        }
      } catch {}

      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setSellerStatus("none");
      setLoading(false);
    }
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
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
