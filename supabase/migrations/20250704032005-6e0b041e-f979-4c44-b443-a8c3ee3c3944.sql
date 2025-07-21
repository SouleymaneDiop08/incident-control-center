
-- Créer une table pour gérer plusieurs rôles par utilisateur
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Migrer les rôles existants vers la nouvelle table
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles;

-- Créer une fonction pour vérifier si un utilisateur a un rôle spécifique
CREATE OR REPLACE FUNCTION public.user_has_role(user_id UUID, required_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_has_role.user_id AND role = required_role
  );
$$;

-- Créer une fonction pour vérifier si un utilisateur a un rôle ou supérieur
CREATE OR REPLACE FUNCTION public.user_has_role_or_higher(user_id UUID, min_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_has_role_or_higher.user_id AND (
      (min_role = 'employé'::user_role) OR
      (min_role = 'IT'::user_role AND role IN ('IT'::user_role, 'admin'::user_role)) OR
      (min_role = 'admin'::user_role AND role = 'admin'::user_role)
    )
  );
$$;

-- Mettre à jour les politiques RLS pour les incidents
DROP POLICY IF EXISTS "Employees can view their own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Managers and admins can view all incidents" ON public.incidents;
DROP POLICY IF EXISTS "Managers and admins can update incidents" ON public.incidents;

-- Les employés peuvent voir leurs propres incidents
CREATE POLICY "Employees can view their own incidents"
  ON public.incidents FOR SELECT
  USING (
    created_by = auth.uid() OR 
    public.user_has_role_or_higher(auth.uid(), 'IT'::user_role)
  );

-- Seuls les IT peuvent modifier les incidents (pas les admins)
CREATE POLICY "IT can update incidents"
  ON public.incidents FOR UPDATE
  USING (public.user_has_role(auth.uid(), 'IT'::user_role));

-- Activer RLS sur la nouvelle table user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Politiques pour user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles"
  ON public.user_roles FOR ALL
  USING (public.user_has_role(auth.uid(), 'admin'::user_role));
