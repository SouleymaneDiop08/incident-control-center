
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];

interface UpdateIncidentParams {
  incidentId: string; 
  status: IncidentStatus; 
  comment?: string; 
  assignedTo?: string;
}

export function useIncidentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ incidentId, status, comment, assignedTo }: UpdateIncidentParams) => {
      console.log('Updating incident:', { incidentId, status, comment, assignedTo });
      
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (comment !== undefined) {
        updateData.resolution_comment = comment || null;
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

      // Log the action for audit trail
      try {
        await supabase.rpc('log_action', {
          action_name: `incident_status_updated_to_${status}`,
          target_type_name: 'incident',
          target_id_val: incidentId,
          details_val: { 
            new_status: status, 
            comment: comment || null, 
            assigned_to: assignedTo || null,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.error('Error logging incident update:', logError);
        // Don't fail the main operation if logging fails
      }

      return { incidentId, status, comment, assignedTo };
    },
    onSuccess: (data) => {
      const statusLabels = {
        'nouveau': 'Nouveau',
        'en_cours': 'En cours',
        'resolu': 'Résolu'
      };
      
      toast.success(
        `Incident mis à jour avec succès`, 
        {
          description: `Statut changé vers "${statusLabels[data.status]}"`,
          duration: 4000,
        }
      );
      
      // Invalidate and refetch incidents
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      
      // Optimistically update the cache if possible
      queryClient.setQueryData(['incidents'], (oldData: any) => {
        if (!oldData) return oldData;
        
        return oldData.map((incident: any) => 
          incident.id === data.incidentId 
            ? { 
                ...incident, 
                status: data.status, 
                resolution_comment: data.comment || incident.resolution_comment,
                assigned_to: data.assignedTo !== undefined ? data.assignedTo : incident.assigned_to,
                updated_at: new Date().toISOString()
              }
            : incident
        );
      });
    },
    onError: (error: any) => {
      console.error('Update incident error:', error);
      
      let errorMessage = 'Une erreur est survenue lors de la mise à jour';
      let errorDescription = error.message;
      
      // Handle specific error cases
      if (error.code === 'PGRST116') {
        errorMessage = 'Incident non trouvé';
        errorDescription = 'L\'incident que vous essayez de modifier n\'existe pas ou a été supprimé.';
      } else if (error.code === 'PGRST301') {
        errorMessage = 'Permissions insuffisantes';
        errorDescription = 'Vous n\'avez pas les droits nécessaires pour modifier cet incident.';
      } else if (error.message?.includes('JWT')) {
        errorMessage = 'Session expirée';
        errorDescription = 'Votre session a expiré. Veuillez vous reconnecter.';
      }
      
      toast.error(errorMessage, {
        description: errorDescription,
        duration: 6000,
      });
    },
    retry: (failureCount, error: any) => {
      // Don't retry on authentication or permission errors
      if (error?.code === 'PGRST301' || error?.message?.includes('JWT') || error?.code === 'PGRST116') {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// Hook for bulk incident updates
export function useBulkIncidentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateIncidentParams[]) => {
      const results = await Promise.allSettled(
        updates.map(async (update) => {
          const { error } = await supabase
            .from('incidents')
            .update({
              status: update.status,
              resolution_comment: update.comment || null,
              assigned_to: update.assignedTo || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', update.incidentId);
          
          if (error) throw error;
          return update;
        })
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { succeeded, failed, total: updates.length };
    },
    onSuccess: (data) => {
      if (data.failed > 0) {
        toast.warning(
          `Mise à jour partielle`, 
          {
            description: `${data.succeeded} incidents mis à jour, ${data.failed} ont échoué`,
          }
        );
      } else {
        toast.success(
          `${data.succeeded} incidents mis à jour avec succès`
        );
      }
      
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: any) => {
      console.error('Bulk update error:', error);
      toast.error('Erreur lors de la mise à jour en lot', {
        description: error.message || 'Une erreur est survenue'
      });
    }
  });
}
