
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, CheckCircle, Clock, AlertTriangle, User, Calendar } from 'lucide-react';
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

interface IncidentTableProps {
  incidents: Incident[];
  onIncidentClick: (incident: Incident) => void;
  isIT: boolean;
}

export function IncidentTable({ incidents, onIncidentClick, isIT }: IncidentTableProps) {
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

  const getPriorityColor = (status: IncidentStatus, createdAt: string) => {
    const hoursOld = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (status === 'nouveau' && hoursOld > 24) return 'bg-red-50 border-red-200';
    if (status === 'en_cours' && hoursOld > 72) return 'bg-orange-50 border-orange-200';
    return '';
  };

  return (
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
          {incidents.map((incident) => (
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
                  onClick={() => onIncidentClick(incident)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {isIT ? 'Gérer' : 'Voir'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
