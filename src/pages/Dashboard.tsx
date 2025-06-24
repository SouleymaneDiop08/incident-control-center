
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { FileText, Users, Activity, Shield, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      if (profile?.role === 'employee') {
        const { data: myIncidents } = await supabase
          .from('incidents')
          .select('status')
          .eq('created_by', profile.id);
        
        const total = myIncidents?.length || 0;
        const nouveau = myIncidents?.filter(i => i.status === 'nouveau').length || 0;
        const enCours = myIncidents?.filter(i => i.status === 'en_cours').length || 0;
        const resolu = myIncidents?.filter(i => i.status === 'resolu').length || 0;

        return { total, nouveau, enCours, resolu };
      } else {
        const { data: allIncidents } = await supabase
          .from('incidents')
          .select('status');
        
        const total = allIncidents?.length || 0;
        const nouveau = allIncidents?.filter(i => i.status === 'nouveau').length || 0;
        const enCours = allIncidents?.filter(i => i.status === 'en_cours').length || 0;
        const resolu = allIncidents?.filter(i => i.status === 'resolu').length || 0;

        return { total, nouveau, enCours, resolu };
      }
    },
    enabled: !!profile
  });

  if (!profile) return null;

  // Les employés n'ont pas accès au dashboard
  if (profile.role === 'employee') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Shield className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Bienvenue, {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-gray-600 mb-8">
              Utilisez le menu de navigation pour déclarer un incident de sécurité.
            </p>
            <Button asChild>
              <Link to="/new-incident" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Déclarer un incident</span>
              </Link>
            </Button>
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
          <h1 className="text-2xl font-bold text-gray-900">
            Tableau de bord
          </h1>
          <p className="text-gray-600">
            Bienvenue, {profile.first_name} {profile.last_name}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                Tous les incidents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nouveaux</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.nouveau || 0}</div>
              <p className="text-xs text-muted-foreground">
                À traiter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En cours</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.enCours || 0}</div>
              <p className="text-xs text-muted-foreground">
                En traitement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Résolus</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.resolu || 0}</div>
              <p className="text-xs text-muted-foreground">
                Terminés
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(profile.role === 'manager' || profile.role === 'admin') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Gérer les incidents</span>
                </CardTitle>
                <CardDescription>
                  Consulter et traiter les incidents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to="/incidents">Voir les incidents</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {profile.role === 'admin' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Gestion utilisateurs</span>
                  </CardTitle>
                  <CardDescription>
                    Ajouter, modifier ou supprimer des utilisateurs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/admin/users">Gérer les utilisateurs</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Journaux d'audit</span>
                  </CardTitle>
                  <CardDescription>
                    Consulter l'historique des actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/admin/logs">Voir les logs</Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
