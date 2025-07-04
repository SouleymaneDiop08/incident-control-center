
import { Search, Filter, X, Download, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface IncidentFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  totalIncidents: number;
  filteredCount: number;
  onExport?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function IncidentFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  totalIncidents,
  filteredCount,
  onExport,
  onRefresh,
  isLoading = false
}: IncidentFiltersProps) {
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || categoryFilter !== 'all';

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          {/* Search and action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Rechercher par titre, description ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              )}
              {onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExport}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exporter
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtres :</span>
            </div>
            
            <div className="flex flex-wrap gap-2 flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="nouveau">Nouveaux</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="resolu">Résolus</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  <SelectItem value="phishing">Phishing</SelectItem>
                  <SelectItem value="malware">Malware</SelectItem>
                  <SelectItem value="acces_non_autorise">Accès non autorisé</SelectItem>
                  <SelectItem value="perte_donnees">Perte de données</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Effacer
                </Button>
              )}
            </div>
          </div>

          {/* Results summary */}
          <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
            <div className="flex items-center gap-2">
              <span>
                {filteredCount === totalIncidents 
                  ? `${totalIncidents} incident${totalIncidents > 1 ? 's' : ''} au total`
                  : `${filteredCount} sur ${totalIncidents} incident${totalIncidents > 1 ? 's' : ''}`
                }
              </span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  Filtré
                </Badge>
              )}
            </div>
            
            {hasActiveFilters && (
              <span className="text-xs text-gray-500">
                {filteredCount === 0 ? 'Aucun résultat' : 'Résultats filtrés'}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
