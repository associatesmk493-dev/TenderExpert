
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('ceo', 'manager', 'team_member');

-- Create enum for funnel stages
CREATE TYPE public.funnel_stage AS ENUM ('calling', 'walkin', 'booking', 'delivery');

-- Create enum for lead temperature
CREATE TYPE public.lead_temperature AS ENUM ('hot', 'warm', 'cold');

-- Create enum for call outcome
CREATE TYPE public.call_outcome AS ENUM ('walkin_scheduled', 'not_picked_up', 'not_interested', 'follow_up', 'switched_off', 'wrong_number');

-- Create enum for source portal
CREATE TYPE public.source_portal AS ENUM ('cardekho', 'carwale', 'olx', 'facebook', 'instagram', 'walk_in', 'reference', 'other');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'team_member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Showrooms table
CREATE TABLE public.showrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.showrooms ENABLE ROW LEVEL SECURITY;

-- Showroom assignments (which users belong to which showroom)
CREATE TABLE public.showroom_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id UUID REFERENCES public.showrooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (showroom_id, user_id)
);
ALTER TABLE public.showroom_members ENABLE ROW LEVEL SECURITY;

-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source_portal source_portal NOT NULL DEFAULT 'other',
  showroom_id UUID REFERENCES public.showrooms(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  funnel_stage funnel_stage NOT NULL DEFAULT 'calling',
  temperature lead_temperature NOT NULL DEFAULT 'warm',
  last_call_outcome call_outcome,
  walkin_date DATE,
  follow_up_date DATE,
  booking_date DATE,
  delivery_date DATE,
  car_interest TEXT,
  budget TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Lead activities / log
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: is user CEO or Manager
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ceo', 'manager')
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_showrooms_updated_at BEFORE UPDATE ON public.showrooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles: admins can manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.is_admin(auth.uid()));

-- Showrooms: everyone authenticated can view, admins can manage
CREATE POLICY "Authenticated users can view showrooms" ON public.showrooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage showrooms" ON public.showrooms FOR ALL USING (public.is_admin(auth.uid()));

-- Showroom members: authenticated can view, admins can manage
CREATE POLICY "Authenticated users can view showroom members" ON public.showroom_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage showroom members" ON public.showroom_members FOR ALL USING (public.is_admin(auth.uid()));

-- Leads: team members see only assigned, admins see all
CREATE POLICY "Team members can view assigned leads" ON public.leads FOR SELECT USING (auth.uid() = assigned_to);
CREATE POLICY "Admins can view all leads" ON public.leads FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert leads" ON public.leads FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Team members can insert leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update all leads" ON public.leads FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Team members can update assigned leads" ON public.leads FOR UPDATE USING (auth.uid() = assigned_to);
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE USING (public.is_admin(auth.uid()));

-- Lead activities: same as leads access
CREATE POLICY "Users can view activities for their leads" ON public.lead_activities FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_activities.lead_id AND leads.assigned_to = auth.uid())
);
CREATE POLICY "Admins can view all activities" ON public.lead_activities FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated users can insert activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
