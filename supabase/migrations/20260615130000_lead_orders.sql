CREATE TABLE public.lead_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT,
  company TEXT,
  source_portal TEXT DEFAULT 'manual_entry',
  equipment TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'delivered', 'lost')),
  quoted_amount NUMERIC,
  advance_amount NUMERIC,
  before_delivery_amount NUMERIC,
  after_delivery_amount NUMERIC,
  closed_amount NUMERIC GENERATED ALWAYS AS (
    COALESCE(advance_amount, 0) + COALESCE(before_delivery_amount, 0) + COALESCE(after_delivery_amount, 0)
  ) STORED,
  edd DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lead_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their lead orders" ON public.lead_orders
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_orders.lead_id AND leads.assigned_to = auth.uid())
);

CREATE POLICY "Admins can view all lead orders" ON public.lead_orders
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can insert lead orders" ON public.lead_orders
FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team members can update their lead orders" ON public.lead_orders
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_orders.lead_id AND leads.assigned_to = auth.uid())
);

CREATE POLICY "Admins can update all lead orders" ON public.lead_orders
FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can delete own lead orders" ON public.lead_orders
FOR DELETE USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);

CREATE OR REPLACE FUNCTION update_lead_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER lead_orders_updated_at
BEFORE UPDATE ON public.lead_orders
FOR EACH ROW EXECUTE FUNCTION update_lead_orders_updated_at();
