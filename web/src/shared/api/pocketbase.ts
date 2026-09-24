import { BACKEND } from '../constants/backend';

export interface PbUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  verified: boolean;
}

interface PbAuthResponse {
  token: string;
  record: PbUser;
}

export interface FavoritesRow {
  id: string;
  user: string;
  mediaIds: string[];
}

export interface WatchRow {
  id: string;
  user: string;
  items: Record<
    string,
    { currentTime: number; duration: number; lastWatched: number; completed: boolean }
  >;
}

// ---------- Socle HTTP (REST PocketBase, sans SDK) ----------

async function pbFetch<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = token;

  const res = await fetch(`${BACKEND.baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PocketBase ${res.status} sur ${path} : ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const encodeFilter = (s: string) => encodeURIComponent(s);

// ---------- Auth ----------

export const pbAuth = {
  createAccount(email: string, password: string, name: string): Promise<PbUser> {
    return pbFetch('/api/collections/users/records', null, {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        password,
        passwordConfirm: password,
        name: name.trim() || email.trim().split('@')[0],
      }),
    });
  },

  login(email: string, password: string): Promise<PbAuthResponse> {
    return pbFetch('/api/collections/users/auth-with-password', null, {
      method: 'POST',
      body: JSON.stringify({ identity: email.trim(), password }),
    });
  },

  refresh(token: string): Promise<PbAuthResponse> {
    return pbFetch('/api/collections/users/auth-refresh', token, { method: 'POST' });
  },
};

// ---------- Lignes user ----------

async function findRow<T>(collection: 'user_favorites' | 'watch_progress', userId: string, token: string): Promise<T | null> {
  const data = await pbFetch<{ items: T[] }>(
    `/api/collections/${collection}/records?perPage=1&filter=${encodeFilter(`user="${userId}"`)}`,
    token
  );
  return data.items[0] ?? null;
}

export const pbSync = {
  async getFavorites(userId: string, token: string): Promise<FavoritesRow | null> {
    return findRow<FavoritesRow>('user_favorites', userId, token);
  },

  async saveFavorites(
    userId: string,
    token: string,
    mediaIds: string[],
    rowId?: string
  ): Promise<FavoritesRow> {
    if (rowId) {
      return pbFetch(`/api/collections/user_favorites/records/${rowId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ mediaIds }),
      });
    }
    return pbFetch('/api/collections/user_favorites/records', token, {
      method: 'POST',
      body: JSON.stringify({ user: userId, mediaIds }),
    });
  },

  async getWatch(userId: string, token: string): Promise<WatchRow | null> {
    return findRow<WatchRow>('watch_progress', userId, token);
  },

  async saveWatch(
    userId: string,
    token: string,
    items: WatchRow['items'],
    rowId?: string
  ): Promise<WatchRow> {
    if (rowId) {
      return pbFetch(`/api/collections/watch_progress/records/${rowId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ items }),
      });
    }
    return pbFetch('/api/collections/watch_progress/records', token, {
      method: 'POST',
      body: JSON.stringify({ user: userId, items }),
    });
  },
};
