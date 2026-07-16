import { useState, useEffect } from "react";
import { Star, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

interface Testimonial {
  id: string;
  name: string;
  avatar_url: string | null;
  rating: number;
  text: string;
  role: string;
}

const TestimonialCard = ({ t }: { t: Testimonial }) => (
  <Card className="min-w-[320px] max-w-[360px] flex-shrink-0 border-border/50 bg-background/80 backdrop-blur-sm">
    <CardContent className="p-6 flex flex-col h-full">
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, si) => (
          <Star
            key={si}
            className={`w-4 h-4 ${
              si < t.rating ? "fill-primary text-primary" : "fill-muted text-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-foreground/90 leading-relaxed flex-1 mb-6">"{t.text}"</p>
      <div className="flex items-center gap-3 pt-4 border-t border-border/50">
        <Avatar className="h-10 w-10">
          <AvatarImage src={t.avatar_url || ""} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {t.name.split(" ").map((n) => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-sm">{t.name}</p>
          <p className="text-xs text-muted-foreground">{t.role}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTestimonials = async () => {
      const { data } = await supabase
        .from("testimonials")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setTestimonials(data || []);
      setLoading(false);
    };
    fetchTestimonials();
  }, []);

  if (loading) {
    return (
      <section className="py-20 bg-secondary/20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </section>
    );
  }

  if (testimonials.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...testimonials, ...testimonials];

  return (
    <section className="py-20 bg-secondary/20 overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-14">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
            What People Say
          </p>
          <h2 className="text-3xl md:text-4xl font-bold">Loved by Our Customers</h2>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-6 animate-marquee">
          {items.map((t, i) => (
            <TestimonialCard key={`${t.id}-${i}`} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
};
