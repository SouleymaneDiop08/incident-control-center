
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, CheckCircle, Clock, AlertTriangle, User, Calendar, ArrowUpDown, MoreVertical, MessageSquare } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';
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
  onQuickUpdate?: (incidentId: string, status: IncidentStatus) => void;
}

type SortField = 'title' | 'status' | 'category' | 'incident_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

export function IncidentTable({ incidents, onIncidentClick, isIT, onQuickUpdate }: IncidentTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
    if (status === 'nouveau' && hoursOld > 24) return 'bg-red-50 border-l-4 border-red-400';
    if (status === 'en_cours' && hoursOld > 72) return 'bg-orange-50 border-l-4 border-orange-400';
    return '';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedIncidents = [...incidents].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'incident_date' || sortField === 'created_at') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'À l\'instant';
    if (diffInHours < 24) return `Il y a ${Math.floor(diffInHours)}h`;
    if (diffInHours < 48) return 'Hier';
    return `Il y a ${Math.floor(diffInHours / 24)} jours`;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-gray-50 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown 
          className={`h-3 w-3 transition-colors ${
            sortField === field ? 'text-blue-600' : 'text-gray-400'
          }`} 
        />
      </div>
    </TableHead>
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50">
            <SortableHeader field="title">Incident</SortableHeader>
            <SortableHeader field="category">Catégorie</SortableHeader>
            <SortableHeader field="status">Statut</SortableHeader>
            <TableHead>Déclarant</TableHead>
            <SortableHeader field="incident_date">Date</SortableHeader>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIncidents.map((incident) => (
            <TableRow 
              key={incident.id} 
              className={`hover:bg-gray-50 transition-colors cursor-pointer ${getPriorityColor(incident.status, incident.created_at)}`}
              onClick={() => onIncidentClick(incident)}
            >
              <TableCell className="font-medium max-w-xs">
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                        {incident.title}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{incident.title}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-xs text-gray-500 truncate">
                        {incident.description.substring(0, 80)}
                        {incident.description.length > 80 && '...'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-sm whitespace-pre-wrap">{incident.description}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>#{incident.id.slice(-8)}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(incident.created_at)}</span>
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <Badge variant="outline" className="font-medium">
                  {getCategoryLabel(incident.category)}
                </Badge>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(incident.status)}
                  <Badge variant={getStatusBadgeVariant(incident.status)} className="font-medium">
                    {getStatusLabel(incident.status)}
                  </Badge>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="text-sm min-w-0">
                    {incident.creator ? (
                      <>
                        <div className="font-medium text-gray-900 truncate">
                          {`${incident.creator.first_name || ''} ${incident.creator.last_name || ''}`.trim() || 'Nom non renseigné'}
                        </div>
                        <div className="text-gray-500 text-xs truncate">
                          {incident.creator.email}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400 italic text-xs">Utilisateur inconnu</span>
                    )}
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div className="text-sm">
                    <div className="font-medium">
                      {new Date(incident.incident_date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(incident.incident_date).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </TableCell>
              
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onIncidentClick(incident)}
                    className="flex items-center gap-1 hover:bg-blue-50 hover:border-blue-300"
                  >
                    <Eye className="h-4 w-4" />
                    {isIT ? 'Gérer' : 'Voir'}
                  </Button>
                  
                  {isIT && onQuickUpdate && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-2">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {incident.status !== 'en_cours' && (
                          <DropdownMenuItem 
                            onClick={() => onQuickUpdate(incident.id, 'en_cours')}
                            className="flex items-center gap-2"
                          >
                            <Clock className="h-4 w-4 text-yellow-500" />
                            Marquer "En cours"
                          </DropdownMenuItem>
                        )}
                        {incident.status !== 'resolu' && (
                          <DropdownMenuItem 
                            onClick={() => onQuickUpdate(incident.id, 'resolu')}
                            className="flex items-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Marquer "Résolu"
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => onIncidentClick(incident)}
                          className="flex items-center gap-2"
                        >
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                          Ajouter commentaire
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
