
-- Corriger les valeurs de rôle incorrectes dans la base de données
-- Remplacer 'employee' par 'employé' et 'manager' par 'IT'
UPDATE public.profiles 
SET role = 'employé'::user_role 
WHERE role::text = 'employee';

UPDATE public.profiles 
SET role = 'IT'::user_role 
WHERE role::text = 'manager';

-- Vérifier les données corrigées
SELECT role, COUNT(*) as count 
FROM public.profiles 
GROUP BY role;
