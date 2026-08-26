-- Platforms table
CREATE TABLE public.platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view platforms"
ON public.platforms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage platforms"
ON public.platforms FOR ALL USING (is_admin(auth.uid()));

CREATE TRIGGER update_platforms_updated_at
BEFORE UPDATE ON public.platforms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Platform members (multi-platform per user)
CREATE TABLE public.platform_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform_id)
);

ALTER TABLE public.platform_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view platform members"
ON public.platform_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage platform members"
ON public.platform_members FOR ALL USING (is_admin(auth.uid()));