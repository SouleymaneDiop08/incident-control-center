
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type IncidentCategory = Database['public']['Enums']['incident_category'];
type IncidentStatus = Database['public']['Enums']['incident_status'];

interface Incident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  incident_date: string;
  resolution_comment: string | null;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  creator?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export function useIncidents(profile: any, isIT: boolean, isAdmin: boolean, isEmployee: boolean) {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      console.log('Fetching incidents for profile:', profile);
      
      if (!profile) {
        throw new Error('Profil utilisateur non disponible');
      }

      try {
        let query = supabase
          .from('incidents')
          .select(`
            id,
            title,
            description,
            category,
            status,
            incident_date,
            resolution_comment,
            created_at,
            created_by,
            assigned_to
          `);

        // Si l'utilisateur est uniquement employé, ne voir que ses incidents
        if (isEmployee && !isIT && !isAdmin) {
          query = query.eq('created_by', profile.id);
        }

        const { data: incidentsData, error: incidentsError } = await query
          .order('created_at', { ascending: false });
        
        if (incidentsError) {
          console.error('Error fetching incidents:', incidentsError);
          throw incidentsError;
        }

        if (!incidentsData || incidentsData.length === 0) {
          console.log('No incidents found');
          return [];
        }

        // Récupérer les profils des créateurs
        const creatorIds = [...new Set(incidentsData.map(incident => incident.created_by))];
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', creatorIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          // Ne pas faire échouer la requête si on ne peut pas récupérer les profils
        }

        const incidentsWithCreators = incidentsData.map(incident => ({
          ...incident,
          creator: profiles?.find(profile => profile.id === incident.created_by) || null
        }));
        
        console.log(`Successfully fetched ${incidentsWithCreators.length} incidents`);
        return incidentsWithCreators as Incident[];
      } catch (error) {
        console.error('Error in incidents query:', error);
        throw error;
      }
    },
    enabled: !!(profile && (isIT || isAdmin || isEmployee)),
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
