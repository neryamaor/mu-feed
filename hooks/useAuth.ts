import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load the existing session on mount, then subscribe to changes.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchAdminStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchAdminStatus(userId: string): Promise<void> {
    const { data } = await supabase
      .from('admin_permissions')
      .select('can_upload')
      .eq('user_id', userId)
      .maybeSingle();
    setIsAdmin(data?.can_upload === true);
    setLoading(false);
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user) {
      // Insert the app-level user row that extends Supabase's auth.users.
      // Ignore duplicate key errors (23505) — can happen if email confirmation
      // triggers a second sign-up attempt for the same user.
      const { error: dbError } = await supabase
        .from('users')
        .insert({ id: data.user.id, email });
      if (dbError && dbError.code !== '23505') throw dbError;
    }
  }

  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return {
    user: session?.user ?? null,
    session,
    isAdmin,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
