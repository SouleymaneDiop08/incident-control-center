
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];
type IncidentCategory = Database['public']['Enums']['incident_category'];

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
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export default function IncidentsList() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<IncidentStatus>('nouveau');
  const [resolutionComment, setResolutionComment] = useState('');

  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      console.log('Fetching incidents...');
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          profiles!incidents_created_by_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching incidents:', error);
        throw error;
      }
      
      console.log('Incidents fetched:', data);
      return data as Incident[];
    },
    enabled: profile?.role === 'IT' || profile?.role === 'admin'
  });

  const updateIncidentMutation = useMutation({
    mutationFn: async ({ incidentId, status, comment }: { incidentId: string; status: IncidentStatus; comment?: string }) => {
      console.log('Updating incident:', { incidentId, status, comment });
      
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (comment) {
        updateData.resolution_comment = comment;
      }
      
      const { error } = await supabase
        .from('incidents')
        .update(updateData)
        .eq('id', incidentId);
      
      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      // Log the action
      try {
        await supabase.rpc('log_action', {
          action_name: `incident_status_updated_to_${status}`,
          target_type_name: 'incident',
          target_id_val: incidentId,
          details_val: { new_status: status, comment }
        });
      } catch (logError) {
        console.error('Error logging incident update:', logError);
      }
      
      console.log('Incident updated successfully');
    },
    onSuccess: () => {
      toast.success('Statut de l\'incident mis à jour');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setIsDetailDialogOpen(false);
      setResolutionComment('');
    },
    onError: (error: any) => {
      console.error('Update incident error:', error);
      toast.error('Erreur lors de la mise à jour', {
        description: error.message || 'Une erreur est survenue'
      });
    }
  });

  const getCategoryLabel = (category: IncidentCategory) => {
    const labels = {
      'phishing': 'Phishing',
      'malware': 'Malware',
      'acces_non_autorise': 'Accès non autorisé',
      'perte_donnees': 'Perte de données',
      'autre': 'Autre'
    };
    return labels[category] || category;
  };

  const getStatusIcon = (status: IncidentStatus) => {
    switch (status) {
      case 'nouveau':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'en_cours':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolu':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: IncidentStatus) => {
    const labels = {
      'nouveau': 'Nouveau',
      'en_cours': 'En cours',
      'resolu': 'Résolu'
    };
    return labels[status] || status;
  };

  const openIncidentDetail = (incident: Incident) => {
    setSelectedIncident(incident);
    setNewStatus(incident.status);
    setResolutionComment(incident.resolution_comment || '');
    setIsDetailDialogOpen(true);
  };

  const handleUpdateIncident = () => {
    if (!selectedIncident) return;
    
    updateIncidentMutation.mutate({
      incidentId: selectedIncident.id,
      status: newStatus,
      comment: resolutionComment || undefined
    });
  };

  if (profile?.role !== 'IT' && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 px-4">
          <p className="text-red-600">Accès refusé. Cette page est réservée aux IT et administrateurs.</p>
        </div>
      </div>
    );
  }

  console.log('Current profile:', profile);
  console.log('Incidents data:', incidents);
  console.log('Loading state:', isLoading);
  console.log('Error state:', error);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des incidents</h1>
          <p className="text-gray-600">Consulter et traiter les incidents de sécurité</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des incidents</CardTitle>
            <CardDescription>
              Tous les incidents rapportés dans le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <p>Erreur lors du chargement des incidents:</p>
                <p className="text-sm mt-2">{error.message}</p>
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['incidents'] })}
                  variant="outline"
                  className="mt-4"
                >
                  Réessayer
                </Button>
              </div>
            ) : !incidents || incidents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Aucun incident trouvé</p>
                <p className="text-sm">Les incidents déclarés apparaîtront ici</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Rapporté par</TableHead>
                    <TableHead>Date incident</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-medium">{incident.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCategoryLabel(incident.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(incident.status)}
                          <span>{getStatusLabel(incident.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {incident.profiles ? 
                          `${incident.profiles.first_name || ''} ${incident.profiles.last_name || ''}`.trim() || incident.profiles.email
                          : 'Utilisateur inconnu'
                        }
                      </TableCell>
                      <TableCell>
                        {new Date(incident.incident_date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openIncidentDetail(incident)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Détails
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Détails de l'incident</DialogTitle>
              <DialogDescription>
                Consulter et modifier le statut de l'incident
              </DialogDescription>
            </DialogHeader>
            
            {selectedIncident && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Titre</h3>
                  <p className="text-gray-600">{selectedIncident.title}</p>
                </div>
                
                <div>
                  <h3 className="font-medium">Description</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{selectedIncident.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Catégorie</h3>
                    <p className="text-gray-600">{getCategoryLabel(selectedIncident.category)}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Date de l'incident</h3>
                    <p className="text-gray-600">{new Date(selectedIncident.incident_date).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium">Rapporté par</h3>
                  <p className="text-gray-600">
                    {selectedIncident.profiles ? 
                      `${selectedIncident.profiles.first_name || ''} ${selectedIncident.profiles.last_name || ''}`.trim() || selectedIncident.profiles.email
                      : 'Utilisateur inconnu'
                    }
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Statut</h3>
                  <Select value={newStatus} onValueChange={(value: IncidentStatus) => setNewStatus(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nouveau">Nouveau</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="resolu">Résolu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <h3 className="font-medium">Commentaire de résolution</h3>
                  <Textarea
                    value={resolutionComment}
                    onChange={(e) => setResolutionComment(e.target.value)}
                    placeholder="Ajouter un commentaire sur la résolution..."
                    rows={3}
                  />
                </div>
                
                <Button 
                  onClick={handleUpdateIncident}
                  className="w-full"
                  disabled={updateIncidentMutation.isPending}
                >
                  {updateIncidentMutation.isPending ? 'Mise à jour...' : 'Mettre à jour l\'incident'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
