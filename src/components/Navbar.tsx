
import { useAuth } from '@/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, LogOut, Users, FileText, Activity } from 'lucide-react';
import { toast } from 'sonner';

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      console.log('Attempting to sign out...');
      await signOut();
      toast.success('Déconnexion réussie');
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Erreur lors de la déconnexion');
      // Still navigate to auth page even if there's an error
      navigate('/auth');
    }
  };

  if (!user || !profile) return null;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to={profile.role === 'employé' ? '/new-incident' : '/dashboard'} className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">SecureIncident</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {/* Dashboard link only for IT and admin */}
            {(profile.role === 'IT' || profile.role === 'admin') && (
              <Link to="/dashboard" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Dashboard
              </Link>
            )}
            
            {profile.role === 'employé' && (
              <Link to="/new-incident" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>Nouvel Incident</span>
              </Link>
            )}

            {(profile.role === 'IT' || profile.role === 'admin') && (
              <Link to="/incidents" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>Incidents</span>
              </Link>
            )}

            {profile.role === 'admin' && (
              <>
                <Link to="/admin/users" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>Utilisateurs</span>
                </Link>
                <Link to="/admin/logs" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1">
                  <Activity className="h-4 w-4" />
                  <span>Logs</span>
                </Link>
              </>
            )}

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{profile.first_name} {profile.last_name}</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                {profile.role}
              </span>
            </div>

            <Button onClick={handleSignOut} variant="outline" size="sm" className="flex items-center space-x-1">
              <LogOut className="h-4 w-4" />
              <span>Déconnexion</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
