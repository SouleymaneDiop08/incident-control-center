
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
import { Eye, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
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
  creator?: {
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

  const { data: incidents, isLoading, error, refetch } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      console.log('Fetching incidents for profile:', profile);
      
      if (!profile) {
        throw new Error('Profil utilisateur non disponible');
      }

      // Vérifier les permissions
      if (profile.role !== 'IT' && profile.role !== 'admin') {
        throw new Error('Accès non autorisé');
      }

      try {
        // Récupérer les incidents avec une seule requête optimisée
        const { data: incidentsData, error: incidentsError } = await supabase
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
          `)
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
          // Continuer sans les profils plutôt que de faire échouer
        }

        // Joindre les données des profils aux incidents
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
    enabled: !!(profile && (profile.role === 'IT' || profile.role === 'admin')),
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
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
    },
    onSuccess: () => {
      toast.success('Statut de l\'incident mis à jour');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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

  const getStatusBadgeVariant = (status: IncidentStatus) => {
    switch (status) {
      case 'nouveau':
        return 'destructive';
      case 'en_cours':
        return 'secondary';
      case 'resolu':
        return 'default';
      default:
        return 'outline';
    }
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 px-4">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-red-600">Chargement du profil utilisateur...</p>
          </div>
        </div>
      </div>
    );
  }

  if (profile.role !== 'IT' && profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 px-4">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 text-lg font-semibold">Accès refusé</p>
            <p className="text-gray-600 mt-2">Cette page est réservée aux IT et administrateurs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des incidents</h1>
            <p className="text-gray-600">Consulter et traiter les incidents de sécurité</p>
          </div>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des incidents</CardTitle>
            <CardDescription>
              {incidents?.length || 0} incident(s) trouvé(s) dans le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Chargement des incidents...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-500 font-semibold mb-2">Erreur lors du chargement</p>
                <p className="text-sm text-gray-600 mb-4">{error.message}</p>
                <Button 
                  onClick={() => refetch()}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
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
              <div className="overflow-x-auto">
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
                      <TableRow key={incident.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium max-w-xs">
                          <div className="truncate" title={incident.title}>
                            {incident.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getCategoryLabel(incident.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(incident.status)}
                            <Badge variant={getStatusBadgeVariant(incident.status)}>
                              {getStatusLabel(incident.status)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {incident.creator ? (
                              <>
                                <div className="font-medium">
                                  {`${incident.creator.first_name || ''} ${incident.creator.last_name || ''}`.trim() || 'Nom non renseigné'}
                                </div>
                                <div className="text-gray-500 text-xs">
                                  {incident.creator.email}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-400 italic">Utilisateur inconnu</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(incident.incident_date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                            <div className="text-xs text-gray-500">
                              {new Date(incident.incident_date).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
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
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détails de l'incident</DialogTitle>
              <DialogDescription>
                Consulter et modifier le statut de l'incident
              </DialogDescription>
            </DialogHeader>
            
            {selectedIncident && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Titre</h3>
                  <p className="text-gray-900 mt-1">{selectedIncident.title}</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Description</h3>
                  <p className="text-gray-900 whitespace-pre-wrap mt-1">{selectedIncident.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Catégorie</h3>
                    <Badge variant="outline" className="mt-1">
                      {getCategoryLabel(selectedIncident.category)}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Date de l'incident</h3>
                    <p className="text-gray-900 mt-1">
                      {new Date(selectedIncident.incident_date).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Rapporté par</h3>
                  <div className="mt-1">
                    {selectedIncident.creator ? (
                      <>
                        <p className="text-gray-900 font-medium">
                          {`${selectedIncident.creator.first_name || ''} ${selectedIncident.creator.last_name || ''}`.trim() || 'Nom non renseigné'}
                        </p>
                        <p className="text-gray-600 text-sm">{selectedIncident.creator.email}</p>
                      </>
                    ) : (
                      <p className="text-gray-400 italic">Utilisateur inconnu</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Statut</h3>
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
                  <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Commentaire de résolution</h3>
                  <Textarea
                    value={resolutionComment}
                    onChange={(e) => setResolutionComment(e.target.value)}
                    placeholder="Ajouter un commentaire sur la résolution..."
                    rows={3}
                    className="w-full"
                  />
                </div>
                
                <div className="flex space-x-2 pt-4">
                  <Button 
                    onClick={handleUpdateIncident}
                    className="flex-1"
                    disabled={updateIncidentMutation.isPending}
                  >
                    {updateIncidentMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Mise à jour...
                      </>
                    ) : (
                      'Mettre à jour l\'incident'
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDetailDialogOpen(false)}
                    disabled={updateIncidentMutation.isPending}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
