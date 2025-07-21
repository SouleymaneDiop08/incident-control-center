
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, Trash2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  created_at: string;
}

export default function AdminUsers() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employé' as UserRole
  });

  // Fetch all users
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      console.log('Fetching users...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
      console.log('Users fetched:', data);
      return data as Profile[];
    },
    enabled: profile?.role === 'admin'
  });

  // Add user mutation - Fixed for multi-role system
  const addUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      console.log('Creating user with data:', userData);
      
      // Validate required fields
      if (!userData.email || !userData.password || !userData.first_name || !userData.last_name) {
        throw new Error('Tous les champs sont requis');
      }
      
      // Create user using standard signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Erreur lors de la création de l\'utilisateur');
      }

      // Wait a bit for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add the role to the user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: userData.role
        });

      if (roleError) {
        console.error('Role assignment error:', roleError);
        // Don't throw here as the user is created, just log the error
        console.warn('User created but role assignment failed:', roleError);
      }

      console.log('User created successfully:', authData);

      // Log the action
      try {
        await supabase.rpc('log_action', {
          action_name: 'user_created',
          target_type_name: 'user',
          target_id_val: authData.user.id,
          details_val: { 
            email: userData.email, 
            role: userData.role,
            first_name: userData.first_name,
            last_name: userData.last_name
          }
        });
      } catch (logError) {
        console.error('Error logging user creation:', logError);
      }

      return authData;
    },
    onSuccess: () => {
      toast.success('Utilisateur ajouté avec succès');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsAddDialogOpen(false);
      setNewUser({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'employé'
      });
    },
    onError: (error: any) => {
      console.error('Add user error:', error);
      toast.error('Erreur lors de l\'ajout de l\'utilisateur', {
        description: error.message || 'Une erreur est survenue'
      });
    }
  });

  // Delete user mutation - Updated for multi-role system
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Log the action before deletion
      const userToDelete = users?.find(u => u.id === userId);
      
      try {
        await supabase.rpc('log_action', {
          action_name: 'user_deleted',
          target_type_name: 'user',
          target_id_val: userId,
          details_val: { 
            email: userToDelete?.email,
            role: userToDelete?.role,
            first_name: userToDelete?.first_name,
            last_name: userToDelete?.last_name
          }
        });
      } catch (logError) {
        console.error('Error logging user deletion:', logError);
      }

      // Delete user roles first
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error deleting user roles:', rolesError);
      }

      // Delete profile (this will cascade to auth.users if properly configured)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Utilisateur supprimé avec succès');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      console.error('Delete user error:', error);
      toast.error('Erreur lors de la suppression', {
        description: error.message || 'Une erreur est survenue'
      });
    }
  });

  const handleAddUser = () => {
    if (!newUser.email || !newUser.password || !newUser.first_name || !newUser.last_name) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }
    addUserMutation.mutate(newUser);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      deleteUserMutation.mutate(userId);
    }
  };

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
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
            <p className="text-gray-600">Gérer les comptes utilisateurs de l'application</p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <UserPlus className="h-4 w-4" />
                <span>Ajouter un utilisateur</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un nouvel utilisateur</DialogTitle>
                <DialogDescription>
                  Créer un nouveau compte utilisateur dans le système
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="utilisateur@exemple.com"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Mot de passe *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Mot de passe (min. 6 caractères)"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                    placeholder="Prénom"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                    placeholder="Nom"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="role">Rôle</Label>
                  <Select value={newUser.role} onValueChange={(value: UserRole) => setNewUser({...newUser, role: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employé">Employé</SelectItem>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={handleAddUser} 
                  className="w-full"
                  disabled={addUserMutation.isPending}
                >
                  {addUserMutation.isPending ? 'Création...' : 'Créer l\'utilisateur'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
            <CardDescription>
              Tous les utilisateurs enregistrés dans le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                Erreur lors du chargement des utilisateurs: {error.message}
              </div>
            ) : users && users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom complet</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}`
                          : 'Non renseigné'
                        }
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'IT' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role === 'admin' ? 'Administrateur' :
                           user.role === 'IT' ? 'IT' : 'Employé'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deleteUserMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucun utilisateur trouvé
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
