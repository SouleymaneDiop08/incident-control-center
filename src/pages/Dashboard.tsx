
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

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', profile?.id],
    queryFn: async () => {
      console.log('Fetching dashboard stats for profile:', profile);
      
      if (!profile) return null;

      if (profile.role === 'employé') {
        const { data: myIncidents, error } = await supabase
          .from('incidents')
          .select('status')
          .eq('created_by', profile.id);
        
        if (error) {
          console.error('Error fetching employee incidents:', error);
          throw error;
        }
        
        const total = myIncidents?.length || 0;
        const nouveau = myIncidents?.filter(i => i.status === 'nouveau').length || 0;
        const enCours = myIncidents?.filter(i => i.status === 'en_cours').length || 0;
        const resolu = myIncidents?.filter(i => i.status === 'resolu').length || 0;

        return { total, nouveau, enCours, resolu };
      } else {
        const { data: allIncidents, error } = await supabase
          .from('incidents')
          .select('status');
        
        if (error) {
          console.error('Error fetching all incidents:', error);
          throw error;
        }
        
        const total = allIncidents?.length || 0;
        const nouveau = allIncidents?.filter(i => i.status === 'nouveau').length || 0;
        const enCours = allIncidents?.filter(i => i.status === 'en_cours').length || 0;
        const resolu = allIncidents?.filter(i => i.status === 'resolu').length || 0;

        return { total, nouveau, enCours, resolu };
      }
    },
    enabled: !!profile,
    refetchInterval: 30000,
    staleTime: 10000
  });

  const { data: userStats, isLoading: userStatsLoading } = useQuery({
    queryKey: ['user-stats'],
    queryFn: async () => {
      if (profile?.role !== 'admin') return null;
      
      const { data: users, error } = await supabase
        .from('profiles')
        .select('role');
      
      if (error) {
        console.error('Error fetching user stats:', error);
        throw error;
      }
      
      const totalUsers = users?.length || 0;
      const admins = users?.filter(u => u.role === 'admin').length || 0;
      const its = users?.filter(u => u.role === 'IT').length || 0;
      const employees = users?.filter(u => u.role === 'employé').length || 0;
      
      return { totalUsers, admins, its, employees };
    },
    enabled: profile?.role === 'admin',
    refetchInterval: 60000,
    staleTime: 30000
  });

  if (!profile) return null;

  // Les employés voient seulement le message de bienvenue
  if (profile.role === 'employé') {
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
            
            <Button asChild size="lg">
              <Link to="/new-incident" className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
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
              <div className="text-2xl font-bold">
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                ) : (
                  stats?.total || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {profile.role === 'admin' ? 'Tous les incidents' : 'Vos incidents'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nouveaux</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                ) : (
                  stats?.nouveau || 0
                )}
              </div>
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
              <div className="text-2xl font-bold text-yellow-600">
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                ) : (
                  stats?.enCours || 0
                )}
              </div>
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
              <div className="text-2xl font-bold text-green-600">
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                ) : (
                  stats?.resolu || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Terminés
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Statistics for Admin */}
        {profile.role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userStatsLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                  ) : (
                    userStats?.totalUsers || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tous les comptes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Employés</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {userStatsLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                  ) : (
                    userStats?.employees || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comptes employés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">IT</CardTitle>
                <Activity className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {userStatsLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                  ) : (
                    userStats?.its || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comptes IT
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Admins</CardTitle>
                <Shield className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {userStatsLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                  ) : (
                    userStats?.admins || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comptes admin
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(profile.role === 'IT' || profile.role === 'admin') && (
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
