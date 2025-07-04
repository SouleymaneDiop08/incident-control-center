
import { Card, CardContent } from '@/components/ui/card';
import { FileText, AlertTriangle, Clock, CheckCircle, TrendingUp, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface IncidentStatsProps {
  stats: {
    total: number;
    nouveau: number;
    en_cours: number;
    resolu: number;
  };
  trends?: {
    totalChange?: number;
    newChange?: number;
    resolvedToday?: number;
    avgResolutionTime?: string;
  };
}

export function IncidentStats({ stats, trends }: IncidentStatsProps) {
  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    change,
    subtitle 
  }: {
    title: string;
    value: number;
    icon: any;
    color: string;
    change?: number;
    subtitle?: string;
  }) => (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              {change !== undefined && (
                <Badge 
                  variant={change >= 0 ? "destructive" : "default"} 
                  className="text-xs"
                >
                  {change >= 0 ? '+' : ''}{change}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-full bg-opacity-10 ${color.includes('red') ? 'bg-red-100' : color.includes('yellow') ? 'bg-yellow-100' : color.includes('green') ? 'bg-green-100' : 'bg-blue-100'}`}>
            <Icon className={`h-6 w-6 ${color.replace('text-', 'text-').replace('-600', '-500')}`} />
          </div>
        </div>
        
        {/* Progress bar for visual appeal */}
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all duration-500 ${color.replace('text-', 'bg-').replace('-600', '-500')}`}
            style={{ width: `${Math.min((value / (stats.total || 1)) * 100, 100)}%` }}
          ></div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total"
          value={stats.total}
          icon={FileText}
          color="text-blue-600"
          change={trends?.totalChange}
          subtitle="Incidents déclarés"
        />
        
        <StatCard
          title="Nouveaux"
          value={stats.nouveau}
          icon={AlertTriangle}
          color="text-red-600"
          change={trends?.newChange}
          subtitle="À traiter"
        />
        
        <StatCard
          title="En cours"
          value={stats.en_cours}
          icon={Clock}
          color="text-yellow-600"
          subtitle="En traitement"
        />
        
        <StatCard
          title="Résolus"
          value={stats.resolu}
          icon={CheckCircle}
          color="text-green-600"
          subtitle="Terminés"
        />
      </div>

      {/* Additional insights */}
      {trends && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Aperçu rapide :</span>
              </div>
              
              <div className="flex flex-wrap gap-4 text-gray-700">
                {trends.resolvedToday !== undefined && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>{trends.resolvedToday} résolus aujourd'hui</span>
                  </div>
                )}
                
                {trends.avgResolutionTime && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-gray-500" />
                    <span>Temps moyen : {trends.avgResolutionTime}</span>
                  </div>
                )}
                
                {stats.total > 0 && (
                  <div className="flex items-center gap-1">
                    <span>Taux de résolution : </span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round((stats.resolu / stats.total) * 100)}%
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
