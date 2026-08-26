import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewsletterProps {
  variant?: "banner" | "card";
  title?: string;
  subtitle?: string;
}

export const NewsletterSubscribe = ({
  variant = "banner",
  title = "Ready to Get Our New Stuff?",
  subtitle = "We'll listen to your needs and craft a shopping experience that's right for you.",
}: NewsletterProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      // 1. Insert into subscribers table in Supabase
      const { error } = await supabase
        .from("subscribers" as any)
        .insert([{ email: cleanEmail }]);

      if (error) {
        // Handle duplicate key error (23505) gracefully
        if (error.code === "23505" || error.message.includes("unique")) {
          setSubscribed(true);
          toast.info("You are already subscribed! Thank you for staying connected.");
          setEmail("");
          setLoading(false);
          return;
        }
        throw error;
      }

      setSubscribed(true);
      setEmail("");
      toast.success("Thank you for subscribing! Check your inbox for updates.");

      // 2. Notify admin via Edge Function or Order notification system (non-blocking)
      try {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            type: "newsletter",
            email: cleanEmail,
            message: `New subscriber registered: ${cleanEmail}`,
          },
        });
      } catch {
        // Silent catch for optional edge function
      }
    } catch (err: any) {
      console.error("Newsletter error:", err);
      toast.error(err?.message || "Failed to subscribe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "card") {
    return (
      <section className="px-4 py-10 bg-[#f2f4f3] dark:bg-card my-4 flex flex-col items-center text-center rounded-3xl mx-4 lg:mx-0 border border-border/40">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
          <Mail className="w-7 h-7" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 font-plus-jakarta">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm">
          {subtitle}
        </p>

        {subscribed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-5 py-3 rounded-full text-sm font-semibold"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>You're subscribed! We'll keep you updated.</span>
          </motion.div>
        ) : (
          <form onSubmit={handleSubscribe} className="w-full max-w-sm flex flex-col gap-3">
            <Input
              type="email"
              placeholder="Enter your email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full h-12 px-5 rounded-full border-gray-200 focus:border-primary bg-background shadow-xs text-sm"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full font-semibold text-sm gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Subscribe <Send className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        )}
      </section>
    );
  }

  return (
    <div className="mt-16 bg-foreground text-background rounded-3xl p-8 md:p-12 grid md:grid-cols-2 gap-6 items-center shadow-xl">
      <div>
        <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-2">
          {title}
        </h3>
        <p className="text-sm opacity-80 max-w-md">{subtitle}</p>
      </div>
      <div>
        {subscribed ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-background/10 backdrop-blur-md text-background p-4 rounded-2xl border border-background/20"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-bold">Subscribed successfully!</p>
              <p className="text-xs opacity-80">We will send updates and feedback to your inbox.</p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex gap-2 bg-background rounded-full p-1.5 border border-background/20 shadow-md">
            <input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="flex-1 bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none border-none"
            />
            <Button
              type="submit"
              disabled={loading}
              className="rounded-full px-6 h-11 font-semibold text-sm shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
