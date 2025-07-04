
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole; // Maintenu pour compatibilité
  roles?: UserRole[]; // Nouveau: tableau des rôles
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasRoleOrHigher: (minRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const hasRole = (role: UserRole): boolean => {
    if (!profile?.roles) return profile?.role === role;
    return profile.roles.includes(role);
  };

  const hasRoleOrHigher = (minRole: UserRole): boolean => {
    if (!profile?.roles) {
      // Logique de fallback avec l'ancien système
      if (minRole === 'employé') return true;
      if (minRole === 'IT') return profile?.role === 'IT' || profile?.role === 'admin';
      if (minRole === 'admin') return profile?.role === 'admin';
      return false;
    }
    
    if (minRole === 'employé') return true;
    if (minRole === 'IT') return profile.roles.includes('IT') || profile.roles.includes('admin');
    if (minRole === 'admin') return profile.roles.includes('admin');
    return false;
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Log authentication events
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(async () => {
            try {
              await supabase.rpc('log_action', {
                action_name: 'user_signed_in',
                target_type_name: 'auth',
                target_id_val: session.user.id,
                details_val: { email: session.user.email }
              });
            } catch (error) {
              console.error('Error logging sign in:', error);
            }
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setTimeout(async () => {
            try {
              await supabase.rpc('log_action', {
                action_name: 'user_signed_out',
                target_type_name: 'auth',
                target_id_val: user?.id || null,
                details_val: { email: user?.email }
              });
            } catch (error) {
              console.error('Error logging sign out:', error);
            }
          }, 0);
        }
        
        if (session?.user) {
          // Fetch user profile and roles
          setTimeout(async () => {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (profileError) {
                console.error('Error fetching profile:', profileError);
                setLoading(false);
                return;
              }

              // Fetch user roles
              const { data: userRoles, error: rolesError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id);

              if (rolesError) {
                console.error('Error fetching user roles:', rolesError);
              }

              const roles = userRoles?.map(r => r.role) || [];
              
              setProfile({
                ...profile,
                roles: roles.length > 0 ? roles : [profile.role] // Fallback vers le rôle principal
              });
            } catch (error) {
              console.error('Error in profile fetch:', error);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [user?.id, user?.email]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      signIn,
      signOut,
      hasRole,
      hasRoleOrHigher
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
