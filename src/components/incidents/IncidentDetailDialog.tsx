
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
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

interface IncidentDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
  isIT: boolean;
  newStatus: IncidentStatus;
  setNewStatus: (status: IncidentStatus) => void;
  resolutionComment: string;
  setResolutionComment: (comment: string) => void;
  onUpdate: () => void;
  isUpdating: boolean;
}

export function IncidentDetailDialog({
  isOpen,
  onClose,
  incident,
  isIT,
  newStatus,
  setNewStatus,
  resolutionComment,
  setResolutionComment,
  onUpdate,
  isUpdating
}: IncidentDetailDialogProps) {
  if (!incident) return null;

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
        return 'destructive' as const;
      case 'en_cours':
        return 'secondary' as const;
      case 'resolu':
        return 'default' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>{isIT ? 'Gestion de l\'incident' : 'Détails de l\'incident'}</span>
          </DialogTitle>
          <DialogDescription>
            {isIT ? 'Consulter les détails et modifier le statut de l\'incident' : 'Consulter les détails de l\'incident'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Titre</h3>
                <p className="text-gray-900 font-semibold">{incident.title}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Catégorie</h3>
                <Badge variant="outline" className="mt-1">
                  {getCategoryLabel(incident.category)}
                </Badge>
              </div>
              
              <div>
                <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Date de l'incident</h3>
                <p className="text-gray-900">
                  {new Date(incident.incident_date).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Déclaré par</h3>
                <div className="bg-gray-50 p-3 rounded-lg">
                  {incident.creator ? (
                    <>
                      <p className="text-gray-900 font-medium">
                        {`${incident.creator.first_name || ''} ${incident.creator.last_name || ''}`.trim() || 'Nom non renseigné'}
                      </p>
                      <p className="text-gray-600 text-sm">{incident.creator.email}</p>
                    </>
                  ) : (
                    <p className="text-gray-400 italic">Utilisateur inexistant</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Statut actuel</h3>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(incident.status)}
                  <Badge variant={getStatusBadgeVariant(incident.status)}>
                    {getStatusLabel(incident.status)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Description détaillée</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-900 whitespace-pre-wrap">{incident.description}</p>
            </div>
          </div>
          
          {/* Gestion de l'incident uniquement pour IT */}
          {isIT && (
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
              
              {incident.resolution_comment && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wide mb-2">Historique des commentaires</h4>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-blue-900 text-sm whitespace-pre-wrap">{incident.resolution_comment}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex space-x-3 pt-4 border-t">
            {isIT && (
              <Button 
                onClick={onUpdate}
                className="flex-1"
                disabled={isUpdating}
              >
                {isUpdating ? (
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
            )}
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isUpdating}
              className={isIT ? '' : 'flex-1'}
            >
              {isIT ? 'Annuler' : 'Fermer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
