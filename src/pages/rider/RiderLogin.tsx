import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Loader2, Bike, KeyRound, User, Phone, ShieldCheck } from "lucide-react";

const RiderLogin = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("Motorcycle");
  const [accessCode, setAccessCode] = useState("");
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
      .maybeSingle();
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
        .maybeSingle();

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim().toUpperCase();

    if (!cleanCode) {
      toast({ title: "Access Code Required", description: "Please enter your Admin-issued Access Code.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Verify Access Code exists and is not used
      const { data: codeData, error: codeErr } = await (supabase.from("rider_access_codes" as any) as any)
        .select("*")
        .eq("code", cleanCode)
        .maybeSingle();

      if (codeErr || !codeData) {
        throw new Error("Invalid Access Code. Please contact your administrator for a valid registration code.");
      }

      if (codeData.is_used) {
        throw new Error("This Access Code has already been used by another rider.");
      }

      // 2. Sign up the user account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error("Registration failed. Please try again.");

      const newUserId = authData.user.id;

      // 3. Assign rider role in user_roles
      const { error: roleErr } = await supabase.from("user_roles").insert({
        user_id: newUserId,
        role: "rider",
      });
      if (roleErr && !roleErr.message.includes("duplicate")) throw roleErr;

      // 4. Create rider_profiles entry
      const { error: profileErr } = await (supabase.from("rider_profiles" as any) as any).insert({
        user_id: newUserId,
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        vehicle_type: vehicleType,
        access_code: cleanCode,
        status: "active",
      });
      if (profileErr) throw profileErr;

      // 5. Mark Access Code as used
      await (supabase.from("rider_access_codes" as any) as any)
        .update({
          is_used: true,
          used_by: newUserId,
          used_at: new Date().toISOString(),
        })
        .eq("id", codeData.id);

      toast({
        title: "Account Registered Successfully! 🚴",
        description: "Welcome to the Rider App. You can now access your dashboard.",
      });

      navigate("/rider/dashboard");
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
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

        {/* Hero Header */}
        <div className="relative flex flex-col items-center justify-center pt-8 pb-6 px-6">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-[#4ade80]/10 blur-3xl pointer-events-none" />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4ade80] to-[#16a34a] flex items-center justify-center shadow-lg shadow-green-500/30 mb-4"
          >
            <Bike className="w-10 h-10 text-white" strokeWidth={1.5} />
          </motion.div>

          <div className="text-center relative z-10">
            <h1 className="text-2xl font-bold text-white tracking-tight">Rider Portal</h1>
            <p className="text-white/50 text-xs mt-0.5">Official Delivery Network</p>
          </div>

          {/* Toggle Switch */}
          <div className="flex bg-[#0f1620] border border-white/10 rounded-full p-1 mt-5 w-full max-w-xs relative z-10 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 rounded-full transition-all text-center ${
                !isRegister ? "bg-[#4ade80] text-gray-950 font-bold shadow" : "text-white/60 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 rounded-full transition-all text-center ${
                isRegister ? "bg-[#4ade80] text-gray-950 font-bold shadow" : "text-white/60 hover:text-white"
              }`}
            >
              Register Rider
            </button>
          </div>
        </div>

        {/* Card Body */}
        <motion.div
          key={isRegister ? "register" : "login"}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex-1 bg-[#1a2234] rounded-t-[32px] px-6 pt-6 pb-10 overflow-y-auto"
        >
          {isRegister ? (
            /* ─── REGISTRATION FORM ─────────────────────────────────────────── */
            <div>
              <h2 className="text-white text-lg font-bold mb-1 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#4ade80]" /> Rider Registration
              </h2>
              <p className="text-white/40 text-xs mb-5">
                Admin Access Code is required to create a rider account.
              </p>

              <form onSubmit={handleRegister} className="space-y-4 text-xs">
                {/* Admin Access Code */}
                <div>
                  <label className="text-[#4ade80] font-semibold uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Admin Access Code *
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. RIDER-4892"
                    className="w-full h-12 bg-[#0f1620] border border-[#4ade80]/40 rounded-xl px-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-[#4ade80] focus:ring-2 focus:ring-[#4ade80]/20 uppercase tracking-widest"
                  />
                  <p className="text-[11px] text-white/40 mt-1">Get your code from the Admin Dashboard.</p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Kwame Mensah"
                    className="w-full h-12 bg-[#0f1620] border border-white/10 rounded-xl px-4 text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ade80]/60"
                  />
                </div>

                {/* Phone & Vehicle */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="+233 24 123 4567"
                      className="w-full h-12 bg-[#0f1620] border border-white/10 rounded-xl px-4 text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ade80]/60"
                    />
                  </div>

                  <div>
                    <label className="text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">
                      Vehicle Type
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full h-12 bg-[#0f1620] border border-white/10 rounded-xl px-3 text-white focus:outline-none focus:border-[#4ade80]/60"
                    >
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Bicycle">Bicycle</option>
                      <option value="Car">Car</option>
                      <option value="Van">Van</option>
                    </select>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="rider@example.com"
                    className="w-full h-12 bg-[#0f1620] border border-white/10 rounded-xl px-4 text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ade80]/60"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full h-12 bg-[#0f1620] border border-white/10 rounded-xl px-4 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ade80]/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4ade80] to-[#16a34a] text-gray-950 font-bold text-sm shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying Code & Creating Account...</>
                  ) : (
                    "Register & Access App →"
                  )}
                </motion.button>
              </form>
            </div>
          ) : (
            /* ─── SIGN IN FORM ─────────────────────────────────────────────────── */
            <div>
              <h2 className="text-white text-xl font-bold mb-1">Sign In</h2>
              <p className="text-white/40 text-xs mb-6">Enter your registered rider credentials</p>

              <form onSubmit={handleLogin} className="space-y-4 text-xs">
                <div>
                  <label className="text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="rider@example.com"
                    className="w-full h-12 bg-[#0f1620] border border-white/10 rounded-xl px-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#4ade80]/60"
                  />
                </div>

                <div>
                  <label className="text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">
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
                      className="w-full h-12 bg-[#0f1620] border border-white/10 rounded-xl px-4 pr-12 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#4ade80]/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4ade80] to-[#16a34a] text-gray-950 font-bold text-sm shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Signing In...</>
                  ) : (
                    "Sign In →"
                  )}
                </motion.button>
              </form>
            </div>
          )}

          <p className="text-center text-white/25 text-[11px] mt-6 leading-relaxed">
            Only authorized delivery riders with an Admin Access Code can access this portal.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RiderLogin;
