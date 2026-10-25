import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { Btn } from './ui';
const AccountContext = createContext<User | null>(null);
export const useAccount = () => useContext(AccountContext);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient(); const router = useRouter();
  useEffect(() => {
    void supabase.auth.getUser().then(r => setUser(r.data.user));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      setUser(session?.user ?? null); void router.invalidate();
      if (event !== 'SIGNED_OUT') void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);
  return <AccountContext.Provider value={user}>{children}</AccountContext.Provider>;
}
export function SignInActions() {
  const user = useAccount(); const qc = useQueryClient();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function login(provider: 'google' | 'lovable') {
    setBusy(true); setError('');
    try { const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (r.error) setError(r.error.message); }
    catch { setError('Could not sign in. Please try again.'); } finally { setBusy(false); }
  }
  return user ? <Btn variant="ghost" onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); }}>Sign out</Btn> : <div className="space-y-2"><Btn className="w-full" disabled={busy} onClick={() => login('google')}>Continue with Google</Btn><Btn variant="outline" className="w-full" disabled={busy} onClick={() => login('lovable')}>Continue with Lovable</Btn>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}