import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Account created!",
          description: "You've successfully signed up.",
        });
        navigate("/");
      }
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Error", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/settings/password`,
      });
      if (error) throw error;
      toast({
        title: "Reset link sent!",
        description: "Check your email inbox for a password reset link.",
      });
      setIsForgotPassword(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Generate background logo grid items (plenty of logos across the entire background)
  const logoGrid = Array.from({ length: 30 });

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 pb-20 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-emerald-50/50 via-background to-green-50/50">
        
        {/* Background Tiled & Floating Logo Pattern (Distributed across the ENTIRE screen) */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Tiled Grid Watermark of Logos */}
          <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-6 sm:gap-10 p-6 opacity-[0.09] dark:opacity-[0.06]">
            {logoGrid.map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-center"
                style={{
                  transform: `rotate(${i % 2 === 0 ? "-12deg" : "12deg"}) scale(${0.85 + (i % 3) * 0.1})`,
                }}
              >
                <img
                  src="/logo.png"
                  alt="Trades Point"
                  className="w-16 h-16 sm:w-24 sm:h-24 object-contain filter grayscale hover:grayscale-0 transition-all"
                />
              </div>
            ))}
          </div>

          {/* Floating Animated Hero Logos on all sides & corners */}
          <motion.img
            src="/logo.png"
            alt="Trades Point Floating Logo"
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 0.25, y: [0, 15, 0], scale: 1 }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 left-[4%] w-24 h-24 sm:w-36 sm:h-36 object-contain"
          />
          <motion.img
            src="/logo.png"
            alt="Trades Point Floating Logo"
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 0.25, y: [0, -18, 0], scale: 1.1 }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-24 right-[4%] w-28 h-28 sm:w-40 sm:h-40 object-contain"
          />
          <motion.img
            src="/logo.png"
            alt="Trades Point Floating Logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.2, y: [0, 12, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-24 left-[6%] w-28 h-28 sm:w-36 sm:h-36 object-contain"
          />
          <motion.img
            src="/logo.png"
            alt="Trades Point Floating Logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.25, y: [0, -15, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            className="absolute bottom-20 right-[6%] w-24 h-24 sm:w-36 sm:h-36 object-contain"
          />

          {/* Center Glow Effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md px-4 relative z-10 my-6"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/10">
            {/* Prominent Logo Header inside Card */}
            <div className="flex flex-col items-center justify-center mb-6 text-center">
              <motion.img
                src="/logo.png"
                alt="Trades Point Logo"
                whileHover={{ scale: 1.06, rotate: 2 }}
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-3 drop-shadow-md"
              />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-800 bg-clip-text text-transparent">
                {isForgotPassword ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {isForgotPassword
                  ? "Enter your email and we'll send you a reset link"
                  : isLogin
                  ? "Sign in to access your Trades Point account"
                  : "Join Trades Point to shop and sell items"}
              </p>
            </div>

            {isForgotPassword ? (
              <>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all mt-2"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
                <button
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full mt-5 text-xs sm:text-sm text-muted-foreground hover:text-emerald-600 transition-colors text-center font-medium"
                >
                  Back to Sign In
                </button>
              </>
            ) : (
              <>
                <form onSubmit={handleAuth} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={!isLogin}
                        placeholder="John Doe"
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="mt-1"
                    />
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline mt-1.5 font-medium transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all mt-2"
                    disabled={loading}
                  >
                    {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
                  </Button>
                </form>

                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="w-full mt-5 text-xs sm:text-sm text-muted-foreground hover:text-emerald-600 transition-colors text-center font-medium"
                >
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </main>
      <BottomNav />
    </>
  );
};

export default Auth;
