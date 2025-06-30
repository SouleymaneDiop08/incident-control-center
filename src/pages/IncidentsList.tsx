
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
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, CheckCircle, Clock, AlertTriangle, RefreshCw, Search, Filter, User, Calendar, FileText } from 'lucide-react';
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
  
  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: incidents, isLoading, error, refetch } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      console.log('Fetching incidents for profile:', profile);
      
      if (!profile) {
        throw new Error('Profil utilisateur non disponible');
      }

      if (profile.role !== 'IT' && profile.role !== 'admin') {
        throw new Error('Accès non autorisé');
      }

      try {
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

        const creatorIds = [...new Set(incidentsData.map(incident => incident.created_by))];
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', creatorIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
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
    enabled: !!(profile && (profile.role === 'IT' || profile.role === 'admin')),
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const updateIncidentMutation = useMutation({
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

  // Filtrer les incidents
  const filteredIncidents = incidents?.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.creator?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || incident.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  }) || [];

  // Statistiques rapides
  const stats = {
    total: incidents?.length || 0,
    nouveau: incidents?.filter(i => i.status === 'nouveau').length || 0,
    en_cours: incidents?.filter(i => i.status === 'en_cours').length || 0,
    resolu: incidents?.filter(i => i.status === 'resolu').length || 0
  };

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

  const getPriorityColor = (status: IncidentStatus, createdAt: string) => {
    const hoursOld = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (status === 'nouveau' && hoursOld > 24) return 'bg-red-50 border-red-200';
    if (status === 'en_cours' && hoursOld > 72) return 'bg-orange-50 border-orange-200';
    return '';
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
      comment: resolutionComment || undefined,
      assignedTo: profile?.id
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
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
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

          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Nouveaux</p>
                    <p className="text-2xl font-bold text-red-600">{stats.nouveau}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">En cours</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.en_cours}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Résolus</p>
                    <p className="text-2xl font-bold text-green-600">{stats.resolu}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtres et recherche */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Rechercher par titre, description ou email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="nouveau">Nouveau</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="resolu">Résolu</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    <SelectItem value="phishing">Phishing</SelectItem>
                    <SelectItem value="malware">Malware</SelectItem>
                    <SelectItem value="acces_non_autorise">Accès non autorisé</SelectItem>
                    <SelectItem value="perte_donnees">Perte de données</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Liste des incidents
              <Badge variant="outline" className="ml-2">
                {filteredIncidents.length} / {stats.total}
              </Badge>
            </CardTitle>
            <CardDescription>
              Gérer et traiter les incidents de sécurité déclarés
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
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">
                  {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' 
                    ? 'Aucun incident trouvé avec ces filtres' 
                    : 'Aucun incident trouvé'
                  }
                </p>
                <p className="text-sm">Les incidents déclarés apparaîtront ici</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Incident</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Déclarant</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents.map((incident) => (
                      <TableRow 
                        key={incident.id} 
                        className={`hover:bg-gray-50 ${getPriorityColor(incident.status, incident.created_at)}`}
                      >
                        <TableCell className="font-medium max-w-xs">
                          <div>
                            <div className="truncate font-semibold" title={incident.title}>
                              {incident.title}
                            </div>
                            <div className="text-xs text-gray-500 truncate" title={incident.description}>
                              {incident.description.substring(0, 60)}...
                            </div>
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
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
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
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
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
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openIncidentDetail(incident)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Gérer
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Gestion de l'incident</span>
              </DialogTitle>
              <DialogDescription>
                Consulter les détails et modifier le statut de l'incident
              </DialogDescription>
            </DialogHeader>
            
            {selectedIncident && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Titre</h3>
                      <p className="text-gray-900 font-semibold">{selectedIncident.title}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Catégorie</h3>
                      <Badge variant="outline" className="mt-1">
                        {getCategoryLabel(selectedIncident.category)}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Date de l'incident</h3>
                      <p className="text-gray-900">
                        {new Date(selectedIncident.incident_date).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Déclaré par</h3>
                      <div className="bg-gray-50 p-3 rounded-lg">
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
                      <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Statut actuel</h3>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(selectedIncident.status)}
                        <Badge variant={getStatusBadgeVariant(selectedIncident.status)}>
                          {getStatusLabel(selectedIncident.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Description détaillée</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedIncident.description}</p>
                  </div>
                </div>
                
                <div className="border-t pt-6">
                  <h3 className="font-medium text-lg mb-4">Gestion de l'incident</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Nouveau statut</h4>
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
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Commentaire de traitement</h4>
                    <Textarea
                      value={resolutionComment}
                      onChange={(e) => setResolutionComment(e.target.value)}
                      placeholder="Détaillez les actions entreprises, la résolution appliquée ou les prochaines étapes..."
                      rows={4}
                      className="w-full"
                    />
                  </div>
                  
                  {selectedIncident.resolution_comment && (
                    <div className="mt-4">
                      <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Historique des commentaires</h4>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-blue-900 text-sm whitespace-pre-wrap">{selectedIncident.resolution_comment}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-3 pt-4 border-t">
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
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mettre à jour l'incident
                      </>
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
