
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
            assigned_to,
            creator:profiles!incidents_created_by_fkey(
              first_name,
              last_name,
              email
            )
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

        console.log(`Successfully fetched ${incidentsData.length} incidents with creators`);
        return incidentsData as Incident[];
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
