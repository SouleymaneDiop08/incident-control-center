
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export default function AdminLogs() {
  const { profile } = useAuth();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: profile?.role === 'admin'
  });

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 px-4">
          <p className="text-red-600">Accès refusé. Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Activity className="h-6 w-6" />
            <span>Journaux d'audit</span>
          </h1>
          <p className="text-gray-600">Historique des actions effectuées dans l'application</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activités récentes</CardTitle>
            <CardDescription>
              Les 100 dernières actions enregistrées dans le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Heure</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Type de cible</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        {log.profiles ? 
                          `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() || log.profiles.email
                          : 'Utilisateur inconnu'
                        }
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>{log.target_type}</TableCell>
                      <TableCell>
                        {log.details ? (
                          <pre className="text-xs max-w-xs overflow-hidden">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : (
                          'Aucun détail'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
