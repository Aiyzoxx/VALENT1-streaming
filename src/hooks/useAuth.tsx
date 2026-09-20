import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // Restauration de session au démarrage (refresh du token).
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (savedToken && savedUser) {
          try {
            const fresh = await pbAuth.refresh(savedToken);
            setToken(fresh.token);
            setUser(fresh.record);
            await Promise.all([
              AsyncStorage.setItem(TOKEN_KEY, fresh.token),
              AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh.record)),
            ]);
          } catch {
            // Token expiré/invalide : on repart déconnecté.
            await Promise.all([
              AsyncStorage.removeItem(TOKEN_KEY),
              AsyncStorage.removeItem(USER_KEY),
            ]);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (t: string, u: PbUser) => {
    setToken(t);
    setUser(u);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, t),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(u)),
    ]);
  };

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const res = await pbAuth.login(email, password);
      await persist(res.token, res.record);
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
      await persist(res.token, res.record);
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    setError(null);
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
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
