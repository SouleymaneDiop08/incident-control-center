
-- Remplacer la fonction en utilisant CASCADE pour supprimer les dépendances
DROP FUNCTION IF EXISTS public.has_role_or_higher(uuid, user_role) CASCADE;

-- Recréer la fonction avec la bonne logique pour les nouveaux rôles
CREATE OR REPLACE FUNCTION public.has_role_or_higher(user_id UUID, min_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND (
      (min_role = 'employé'::user_role) OR
      (min_role = 'IT'::user_role AND role IN ('IT'::user_role, 'admin'::user_role)) OR
      (min_role = 'admin'::user_role AND role = 'admin'::user_role)
    )
  );
$$;

-- Recréer les politiques RLS qui ont été supprimées
CREATE POLICY "Managers and admins can view all incidents"
  ON public.incidents FOR SELECT
  USING (public.has_role_or_higher(auth.uid(), 'IT'));

CREATE POLICY "Managers and admins can update incidents"
  ON public.incidents FOR UPDATE
  USING (public.has_role_or_higher(auth.uid(), 'IT'));

-- Corriger les rôles dans la base de données
UPDATE public.profiles 
SET role = 'employé'::user_role 
WHERE role::text = 'employee';

UPDATE public.profiles 
SET role = 'IT'::user_role 
WHERE role::text = 'manager';

-- Vérifier les rôles après correction
SELECT role, COUNT(*) as count 
FROM public.profiles 
GROUP BY role;
