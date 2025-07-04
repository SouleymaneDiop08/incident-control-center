
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];

export function useIncidentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ incidentId, status, comment, assignedTo }: { 
      incidentId: string; 
      status: IncidentStatus; 
      comment?: string; 
      assignedTo?: string;
    }) => {
      console.log('Updating incident:', { incidentId, status, comment, assignedTo });
      
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (comment) {
        updateData.resolution_comment = comment;
      }
      
      if (assignedTo !== undefined) {
        updateData.assigned_to = assignedTo || null;
      }
      
      const { error } = await supabase
        .from('incidents')
        .update(updateData)
        .eq('id', incidentId);
      
      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      try {
        await supabase.rpc('log_action', {
          action_name: `incident_status_updated_to_${status}`,
          target_type_name: 'incident',
          target_id_val: incidentId,
          details_val: { new_status: status, comment, assigned_to: assignedTo }
        });
      } catch (logError) {
        console.error('Error logging incident update:', logError);
      }
    },
    onSuccess: () => {
      toast.success('Incident mis à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: any) => {
      console.error('Update incident error:', error);
      toast.error('Erreur lors de la mise à jour', {
        description: error.message || 'Une erreur est survenue'
      });
    }
  });
}
