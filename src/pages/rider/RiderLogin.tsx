import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Loader2, Bike } from "lucide-react";

const RiderLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      checkRiderRole(user.id);
    }
  }, [user, authLoading]);

  const checkRiderRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "rider")
      .single();
    if (data) navigate("/rider/dashboard");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "rider")
        .single();

      if (roleError || !roleData) {
        await supabase.auth.signOut();
        throw new Error("Access denied. You are not registered as a delivery rider.");
      }

      toast({ title: "Welcome back! 🚴", description: "Logged in successfully." });
      navigate("/rider/dashboard");
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4ade80]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0f1117] flex justify-center">
      <div className="w-full max-w-[520px] min-h-[100dvh] bg-[#111827] overflow-hidden flex flex-col">


        {/* Hero gradient area */}
        <div className="relative flex flex-col items-center justify-center pt-10 pb-8 px-6">
          {/* Glow blob */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-[#4ade80]/10 blur-3xl pointer-events-none" />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-[#4ade80] to-[#16a34a] flex items-center justify-center shadow-lg shadow-green-500/30 mb-6"
          >
            <Bike className="w-12 h-12 text-white" strokeWidth={1.5} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-center relative z-10"
          >
            <h1 className="text-2xl font-bold text-white tracking-tight">Rider Portal</h1>
            <p className="text-white/50 text-sm mt-1">Cynt</p>
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex-1 bg-[#1a2234] rounded-t-[32px] px-6 pt-8 pb-10 overflow-y-auto"
        >
          <h2 className="text-white text-xl font-bold mb-1">Sign In</h2>
          <p className="text-white/40 text-sm mb-8">Enter your credentials to continue</p>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="rider@example.com"
                  className="w-full h-14 bg-[#0f1620] border border-white/10 rounded-2xl px-5 text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-[#4ade80]/60 focus:ring-2 focus:ring-[#4ade80]/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full h-14 bg-[#0f1620] border border-white/10 rounded-2xl px-5 pr-14 text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-[#4ade80]/60 focus:ring-2 focus:ring-[#4ade80]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#4ade80] to-[#16a34a] text-white font-bold text-base shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Signing In...</>
              ) : (
                "Sign In →"
              )}
            </motion.button>
          </form>

          <p className="text-center text-white/25 text-xs mt-8 leading-relaxed">
            Only authorized delivery riders can access this portal.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RiderLogin;
