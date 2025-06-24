
-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('employee', 'manager', 'admin');

-- Create enum for incident status
CREATE TYPE public.incident_status AS ENUM ('nouveau', 'en_cours', 'resolu');

-- Create enum for incident categories
CREATE TYPE public.incident_category AS ENUM ('phishing', 'malware', 'acces_non_autorise', 'perte_donnees', 'autre');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role user_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category incident_category NOT NULL,
  status incident_status NOT NULL DEFAULT 'nouveau',
  incident_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  resolution_comment TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create logs table for audit trail
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Create function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, required_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = required_role
  );
$$;

-- Create function to check if user has role or higher
CREATE OR REPLACE FUNCTION public.has_role_or_higher(user_id UUID, min_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND (
      (min_role = 'employee') OR
      (min_role = 'manager' AND role IN ('manager', 'admin')) OR
      (min_role = 'admin' AND role = 'admin')
    )
  );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for incidents
CREATE POLICY "Employees can view their own incidents"
  ON public.incidents FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Managers and admins can view all incidents"
  ON public.incidents FOR SELECT
  USING (public.has_role_or_higher(auth.uid(), 'manager'));

CREATE POLICY "Employees can create incidents"
  ON public.incidents FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Managers and admins can update incidents"
  ON public.incidents FOR UPDATE
  USING (public.has_role_or_higher(auth.uid(), 'manager'));

-- RLS Policies for audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')::user_role
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for incident attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('incident-attachments', 'incident-attachments', false);

-- Create storage policy for incident attachments
CREATE POLICY "Authenticated users can upload incident attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'incident-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view incident attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'incident-attachments' AND auth.role() = 'authenticated');

-- Create function to log actions
CREATE OR REPLACE FUNCTION public.log_action(
  action_name TEXT,
  target_type_name TEXT,
  target_id_val UUID DEFAULT NULL,
  details_val JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details)
  VALUES (auth.uid(), action_name, target_type_name, target_id_val, details_val);
END;
$$;
