-- Create rider_support_tickets table for rider app support requests and issue reporting
CREATE TABLE IF NOT EXISTS public.rider_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_rider_support_tickets_rider ON public.rider_support_tickets(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_support_tickets_status ON public.rider_support_tickets(status);

-- Enable RLS
ALTER TABLE public.rider_support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Riders can view own tickets" ON public.rider_support_tickets;
CREATE POLICY "Riders can view own tickets"
  ON public.rider_support_tickets FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Riders can create tickets" ON public.rider_support_tickets;
CREATE POLICY "Riders can create tickets"
  ON public.rider_support_tickets FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update tickets" ON public.rider_support_tickets;
CREATE POLICY "Admins can update tickets"
  ON public.rider_support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_rider_support_tickets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rider_support_tickets_updated_at ON public.rider_support_tickets;
CREATE TRIGGER trg_rider_support_tickets_updated_at
  BEFORE UPDATE ON public.rider_support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rider_support_tickets_updated_at();

-- Grant permissions
GRANT SELECT, INSERT ON public.rider_support_tickets TO authenticated;
GRANT ALL ON public.rider_support_tickets TO service_role;
