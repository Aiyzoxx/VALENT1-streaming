import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { pbAuth, PbUser } from '../api/pocketbase';

const TOKEN_KEY = '@streamflow_pb_token';
const USER_KEY = '@streamflow_pb_user';

interface AuthContextValue {
  user: PbUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('400')) return 'Email ou mot de passe invalide.';
  if (msg.includes('Failed to create record') || msg.includes('validation'))
    return 'Inscription impossible (email déjà utilisé ou mot de passe trop court — 8 caractères min).';
  if (/network|fetch|Failed to fetch|Network request failed/i.test(msg))
    return 'Serveur injoignable. Vérifie ta connexion et que api.tribuneo.xyz répond.';
  return 'Une erreur est survenue. Réessaie.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PbUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUserStr = localStorage.getItem(USER_KEY);
        if (savedToken && savedUserStr) {
          try {
            const fresh = await pbAuth.refresh(savedToken);
            setToken(fresh.token);
            setUser(fresh.record);
            localStorage.setItem(TOKEN_KEY, fresh.token);
            localStorage.setItem(USER_KEY, JSON.stringify(fresh.record));
          } catch {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = (t: string, u: PbUser) => {
    setToken(t);
    setUser(u);
    try {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch (e) {
      console.error(e);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const res = await pbAuth.login(email, password);
      persist(res.token, res.record);
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try {
      await pbAuth.createAccount(email, password, name);
      const res = await pbAuth.login(email, password);
      persist(res.token, res.record);
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    setError(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ user, token, loading, error, login, register, logout, clearError }),
    [user, token, loading, error, login, register, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
