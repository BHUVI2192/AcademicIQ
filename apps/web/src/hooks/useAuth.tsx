// ============================================================================
// useAuth — Authentication context + hook
// ============================================================================
// Provides: user, profile, role, college_id, signOut
// Tracks Supabase auth session and the matching profile row.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, Role } from '@shared';
import { supabase } from '@lib/supabaseClient';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  collegeId: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [lastFetchedId, setLastFetchedId] = useState<string | null>(null);
  const activePromiseRef = useRef<Promise<Profile | null> | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    // If a fetch is already in progress, reuse the existing promise to prevent concurrent db requests
    if (activePromiseRef.current) {
      console.log('[Auth] Profile fetch already in progress, reusing promise');
      return activePromiseRef.current;
    }

    // Prevent redundant fetches for the same user if profile is already loaded
    if (lastFetchedId === userId && profile) {
      console.log('[Auth] Profile already loaded for:', userId);
      return profile;
    }
    
    console.log('[Auth] Fetching profile for UID:', userId);
    setLastFetchedId(userId);

    const runFetch = async () => {
      // Add a race against a timeout to prevent infinite hang
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timed out (15s)')), 15000)
      );

      try {
        const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as any;

        if (error) {
          console.error('[Auth] Profile fetch error:', error);
          setProfile(null);
          return null;
        }

        console.log('[Auth] Profile fetched successfully:', data ? 'Found' : 'Not Found');
        const prof = data as Profile | null;
        setProfile(prof);
        return prof;
      } catch (err: any) {
        console.error('[Auth] Profile fetch failed/timed out:', err.message);
        // We don't clear profile here to avoid UI flickering, but we stop loading
        return null;
      } finally {
        activePromiseRef.current = null;
      }
    };

    const promise = runFetch();
    activePromiseRef.current = promise;
    return promise;
  }, [lastFetchedId, profile]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    setLastFetchedId(null); // Force refetch
    await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      console.log('[Auth] Initial getSession completed. Session:', data.session ? 'Found' : 'Not Found');
      try {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          await fetchProfile(data.session.user.id);
        }
      } catch (err) {
        console.error('[Auth] Session init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    });


    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[Auth] onAuthStateChange event:', event, 'Session:', newSession ? 'Present' : 'Absent');
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      collegeId: profile?.college_id ?? null,
      signOut,
      refreshProfile,
    }),
    [loading, session, profile, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
