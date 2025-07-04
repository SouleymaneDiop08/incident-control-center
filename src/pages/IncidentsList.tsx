
import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIncidents } from '@/hooks/useIncidents';
import { useIncidentMutation } from '@/hooks/useIncidentMutation';
import { IncidentStats } from '@/components/incidents/IncidentStats';
import { IncidentFilters } from '@/components/incidents/IncidentFilters';
import { IncidentTable } from '@/components/incidents/IncidentTable';
import { IncidentDetailDialog } from '@/components/incidents/IncidentDetailDialog';
import { RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type IncidentStatus = Database['public']['Enums']['incident_status'];

interface Incident {
  id: string;
  title: string;
  description: string;
  category: Database['public']['Enums']['incident_category'];
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
  const { profile, hasRole } = useAuth();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<IncidentStatus>('nouveau');
  const [resolutionComment, setResolutionComment] = useState('');
  
  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const isIT = hasRole('IT');
  const isAdmin = hasRole('admin');
  const isEmployee = hasRole('employé');

  const { data: incidents, isLoading, error, refetch } = useIncidents(profile, isIT, isAdmin, isEmployee);
  const updateIncidentMutation = useIncidentMutation();

  // Memoized filtered incidents for better performance
  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    
    return incidents.filter(incident => {
      const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           incident.creator?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           `${incident.creator?.first_name || ''} ${incident.creator?.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || incident.category === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [incidents, searchTerm, statusFilter, categoryFilter]);

  // Memoized stats calculation
  const stats = useMemo(() => ({
    total: incidents?.length || 0,
    nouveau: incidents?.filter(i => i.status === 'nouveau').length || 0,
    en_cours: incidents?.filter(i => i.status === 'en_cours').length || 0,
    resolu: incidents?.filter(i => i.status === 'resolu').length || 0
  }), [incidents]);

  // Enhanced stats with trends (you could calculate these from historical data)
  const enhancedStats = useMemo(() => ({
    ...stats,
    trends: {
      resolvedToday: incidents?.filter(i => 
        i.status === 'resolu' && 
        new Date(i.created_at || i.incident_date).toDateString() === new Date().toDateString()
      ).length || 0,
      avgResolutionTime: '2.3 jours', // This could be calculated from actual data
    }
  }), [stats, incidents]);

  const openIncidentDetail = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
    setNewStatus(incident.status);
    setResolutionComment(incident.resolution_comment || '');
    setIsDetailDialogOpen(true);
  }, []);

  const handleUpdateIncident = useCallback(() => {
    if (!selectedIncident) return;
    
    updateIncidentMutation.mutate({
      incidentId: selectedIncident.id,
      status: newStatus,
      comment: resolutionComment || undefined,
      assignedTo: profile?.id
    });
    
    setIsDetailDialogOpen(false);
    setResolutionComment('');
  }, [selectedIncident, newStatus, resolutionComment, profile?.id, updateIncidentMutation]);

  const handleQuickUpdate = useCallback((incidentId: string, status: IncidentStatus) => {
    updateIncidentMutation.mutate({
      incidentId,
      status,
      assignedTo: profile?.id
    });
  }, [profile?.id, updateIncidentMutation]);

  const handleExport = useCallback(() => {
    if (!filteredIncidents.length) {
      toast.error('Aucun incident à exporter');
      return;
    }

    try {
      const csvContent = [
        'ID,Titre,Description,Catégorie,Statut,Date incident,Déclarant,Date création',
        ...filteredIncidents.map(incident => [
          incident.id,
          `"${incident.title.replace(/"/g, '""')}"`,
          `"${incident.description.replace(/"/g, '""')}"`,
          incident.category,
          incident.status,
          new Date(incident.incident_date).toLocaleDateString('fr-FR'),
          incident.creator?.email || 'Inconnu',
          new Date(incident.created_at).toLocaleDateString('fr-FR')
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `incidents_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${filteredIncidents.length} incidents exportés avec succès`);
    } catch (error) {
      console.error('Error exporting incidents:', error);
      toast.error('Erreur lors de l\'export');
    }
  }, [filteredIncidents]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement du profil utilisateur...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isIT && !isAdmin && !isEmployee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 px-4">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 text-lg font-semibold">Accès refusé</p>
            <p className="text-gray-600 mt-2">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
          </div>
        </div>
      </div>
    );
  }

  const pageTitle = isEmployee && !isIT && !isAdmin ? 'Mes incidents' : 'Gestion des incidents';
  const pageDescription = isEmployee && !isIT && !isAdmin 
    ? 'Consulter vos incidents de sécurité déclarés'
    : 'Consulter et traiter les incidents de sécurité déclarés';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-gray-600 mt-1">{pageDescription}</p>
            </div>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>

          <IncidentStats stats={enhancedStats.trends ? enhancedStats : stats} trends={enhancedStats.trends} />
          <IncidentFilters 
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            totalIncidents={stats.total}
            filteredCount={filteredIncidents.length}
            onExport={handleExport}
            onRefresh={() => refetch()}
            isLoading={isLoading}
          />
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Liste des incidents</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="ml-2">
                  {filteredIncidents.length} / {stats.total}
                </Badge>
                {filteredIncidents.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Export
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              {pageDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Chargement des incidents...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 px-4">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-500 font-semibold mb-2">Erreur lors du chargement</p>
                <p className="text-sm text-gray-600 mb-4">{error.message}</p>
                <Button 
                  onClick={() => refetch()}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </Button>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-16 px-4 text-gray-500">
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-xl font-medium mb-2">
                  {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' 
                    ? 'Aucun incident trouvé avec ces filtres' 
                    : 'Aucun incident trouvé'
                  }
                </p>
                <p className="text-sm">Les incidents déclarés apparaîtront ici</p>
                {(searchTerm || statusFilter !== 'all' || categoryFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setCategoryFilter('all');
                    }}
                    className="mt-4"
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
            ) : (
              <IncidentTable 
                incidents={filteredIncidents}
                onIncidentClick={openIncidentDetail}
                onQuickUpdate={isIT ? handleQuickUpdate : undefined}
                isIT={isIT}
              />
            )}
          </CardContent>
        </Card>

        <IncidentDetailDialog
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          incident={selectedIncident}
          isIT={isIT}
          newStatus={newStatus}
          setNewStatus={setNewStatus}
          resolutionComment={resolutionComment}
          setResolutionComment={setResolutionComment}
          onUpdate={handleUpdateIncident}
          isUpdating={updateIncidentMutation.isPending}
        />
      </div>
    </div>
  );
}
