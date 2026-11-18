import { supabase } from './supabase';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isAccessTokenValid(
  token?: string | null,
  expiresAtSec?: number | null,
  bufferSec = 90
): boolean {
  if (!token || typeof token !== 'string' || token === 'undefined' || token === 'null') {
    return false;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof expiresAtSec === 'number' && expiresAtSec > 0) {
    return expiresAtSec > nowSec + bufferSec;
  }
  const payload = decodeJwtPayload(token);
  if (payload && typeof payload.exp === 'number') {
    return payload.exp > nowSec + bufferSec;
  }
  return true;
}

export function getPersistedUserEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    const persistent = window.localStorage.getItem('mt_persistent_user');
    if (persistent) {
      const parsed = JSON.parse(persistent);
      if (parsed?.email) return String(parsed.email).trim();
    }
    const rawAuth = window.localStorage.getItem('maternidade_premium_auth');
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      const email =
        parsed?.user?.email ||
        parsed?.currentSession?.user?.email ||
        parsed?.session?.user?.email;
      if (email) return String(email).trim();
    }
    const prefilled = window.localStorage.getItem('prefilled_email');
    if (prefilled) return prefilled.trim();
  } catch {}
  return '';
}

function collectStoredSessions(): Array<{ access_token?: string; refresh_token?: string }> {
  if (typeof window === 'undefined') return [];
  const candidates: Array<{ access_token?: string; refresh_token?: string }> = [];
  const keysToInspect: string[] = ['maternidade_premium_auth'];

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        key !== 'maternidade_premium_auth' &&
        (key.startsWith('sb-') || key.includes('auth'))
      ) {
        keysToInspect.push(key);
      }
    }

    for (const key of keysToInspect) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const sessionObj = parsed?.currentSession || parsed?.session || parsed;
        if (sessionObj?.access_token || sessionObj?.refresh_token) {
          candidates.push({
            access_token: sessionObj.access_token,
            refresh_token: sessionObj.refresh_token
          });
        }
      } catch {}
    }
  } catch {}

  return candidates;
}

/**
 * Ensures there is a non-expired Supabase session attached to `supabase` client.
 * Recovers via refreshSession or localStorage tokens when possible.
 * Returns null if re-authentication is required.
 */
export async function ensureValidSupabaseSession() {
  try {
    const { data: current } = await supabase.auth.getSession();
    const currentSession = current?.session;

    if (
      currentSession?.access_token &&
      isAccessTokenValid(currentSession.access_token, currentSession.expires_at)
    ) {
      return currentSession;
    }

    // Try refreshing existing or stored session
    const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({
      data: { session: null }
    }));
    const refreshedSession = refreshed?.session;
    if (
      refreshedSession?.access_token &&
      isAccessTokenValid(refreshedSession.access_token, refreshedSession.expires_at, 30)
    ) {
      return refreshedSession;
    }

    // Attempt recovery from any stored session tokens in localStorage
    const storedCandidates = collectStoredSessions();
    for (const cand of storedCandidates) {
      if (cand.access_token && cand.refresh_token) {
        try {
          const { data: restored } = await supabase.auth.setSession({
            access_token: cand.access_token,
            refresh_token: cand.refresh_token
          });
          if (
            restored?.session?.access_token &&
            isAccessTokenValid(restored.session.access_token, restored.session.expires_at, 30)
          ) {
            return restored.session;
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[authSession] Session check note:', err);
  }
  return null;
}

export async function reauthenticateSupabaseSession(email: string, password: string) {
  const cleanEmail = email.trim();
  if (!cleanEmail || !password) {
    return { session: null, error: 'Informe o e-mail e a senha de administrador.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error || !data?.session?.access_token) {
      const msg = error?.message || 'Não foi possível validar suas credenciais.';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        return { session: null, error: 'Senha incorreta. Verifique sua senha e tente novamente.' };
      }
      return { session: null, error: msg };
    }

    if (typeof window !== 'undefined' && data.user) {
      try {
        window.localStorage.setItem('mt_persistent_user', JSON.stringify(data.user));
      } catch {}
    }

    return { session: data.session, error: null };
  } catch (err: any) {
    return {
      session: null,
      error: err?.message || 'Erro de conexão ao validar a sessão.'
    };
  }
}

export function isRlsOrAuthError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('row-level security') ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('permission denied') ||
    msg.includes('not authenticated') ||
    msg.includes('sessão') ||
    msg.includes('unauthorized')
  );
}
