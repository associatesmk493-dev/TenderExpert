import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile } from '@/types/crm';
import { LeadsCache } from '@/lib/leadsCache';
import { DashboardCache } from '@/lib/dashboardCache';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isAdmin: boolean;
  isViewOnly: boolean;
  canImport: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase.from('user_roles').select('*').eq('user_id', userId).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as unknown as Profile);
    if (roleRes.data) setRole((roleRes.data as unknown as { role: AppRole }).role);

    // TenderExpert is currently a single-owner CRM. An authenticated account
    // receives owner access even when the legacy user_roles table has no row.
    const admin = true;
    // Background prefetch so lead pages load instantly
    prefetchLeadsCache(userId, admin);
    DashboardCache.prefetch(userId, admin).catch(() => {});
  };

  const prefetchLeadsCache = async (userId: string, isAdmin: boolean) => {
    // Run in background — don't await, never block UI
    Promise.all([
      // Stage counts (1 RPC instead of 11 queries)
      supabase.rpc('get_lead_stage_counts', { p_user_id: userId, p_is_admin: isAdmin })
        .then(({ data }) => { if (data) LeadsCache.saveCounts(userId, data as Record<string, number>); }),

      // First page of leads
      (() => {
        let q = supabase.from('leads')
          .select('*, showrooms(name)', { count: 'exact' })
          .or('last_call_outcome.neq.not_interested,last_call_outcome.is.null')
          .order('created_at', { ascending: false })
          .range(0, 49);
        if (!isAdmin) q = q.eq('assigned_to', userId);
        return q.then(({ data, count }) => {
          if (data) LeadsCache.saveLeads(userId, data as any, count ?? 0);
        });
      })(),

      // Meta (profiles + showrooms) — admin only
      isAdmin ? Promise.all([
        supabase.from('showrooms').select('id, name'),
        supabase.from('profiles').select('*'),
      ]).then(([s, p]) => {
        if (s.data && p.data) LeadsCache.saveMeta(userId, { showrooms: s.data, profiles: p.data });
      }) : Promise.resolve(),
    ]).catch(() => { /* prefetch failure is silent */ });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (user) LeadsCache.clear(user.id);
    DashboardCache.clear();
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
  };

  const effectiveRole: AppRole | null = user ? (role ?? 'ceo') : null;
  const isAdmin = Boolean(user);
  const isViewOnly = false;
  const canImport = Boolean(user);

  return (
    <AuthContext.Provider value={{ user, session, profile, role: effectiveRole, isAdmin, isViewOnly, canImport, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
