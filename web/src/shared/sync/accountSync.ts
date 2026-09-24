import { pbSync } from '../api/pocketbase';
import type { WatchProgress } from '../types/media';

const FAVORITES_KEY = '@streamflow_favorites';
const HISTORY_KEY = '@streamflow_watch_progress';

let favRowId: string | undefined;
let watchRowId: string | undefined;

export function resetSyncCache(): void {
  favRowId = undefined;
  watchRowId = undefined;
}

function readLocal(): {
  favIds: string[];
  watch: Record<string, WatchProgress>;
} {
  let favIds: string[] = [];
  let watch: Record<string, WatchProgress> = {};
  try {
    const f = localStorage.getItem(FAVORITES_KEY);
    if (f) {
      const parsed = JSON.parse(f);
      if (Array.isArray(parsed)) favIds = parsed;
    }
  } catch {
    /* stockage corrompu */
  }
  try {
    const w = localStorage.getItem(HISTORY_KEY);
    if (w) {
      const parsed = JSON.parse(w);
      if (parsed && typeof parsed === 'object') watch = parsed;
    }
  } catch {
    /* idem */
  }
  return { favIds, watch };
}

export async function pullAndMerge(userId: string, token: string): Promise<void> {
  const { favIds: localFav, watch: localWatch } = readLocal();
  const [serverFav, serverWatch] = await Promise.all([
    pbSync.getFavorites(userId, token).catch(() => null),
    pbSync.getWatch(userId, token).catch(() => null),
  ]);

  favRowId = serverFav?.id;
  watchRowId = serverWatch?.id;

  const mergedFav = Array.from(new Set([...(serverFav?.mediaIds ?? []), ...localFav]));

  const mergedWatch: Record<string, WatchProgress> = {
    ...((serverWatch?.items ?? {}) as Record<string, WatchProgress>),
  };
  for (const [id, p] of Object.entries(localWatch)) {
    const prev = mergedWatch[id];
    if (!prev || (p.lastWatched ?? 0) >= (prev.lastWatched ?? 0)) {
      mergedWatch[id] = p;
    }
  }

  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(mergedFav));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(mergedWatch));
  } catch {
    /* ignore storage quota */
  }

  const [favRow, watchRow] = await Promise.all([
    pbSync.saveFavorites(userId, token, mergedFav, favRowId).catch(() => null),
    pbSync.saveWatch(userId, token, mergedWatch, watchRowId).catch(() => null),
  ]);
  if (favRow) favRowId = favRow.id;
  if (watchRow) watchRowId = watchRow.id;
}

export async function pushFavorites(
  userId: string,
  token: string,
  ids: string[]
): Promise<void> {
  try {
    const row = await pbSync.saveFavorites(userId, token, ids, favRowId);
    favRowId = row.id;
  } catch {
    /* offline */
  }
}

export async function pushWatch(
  userId: string,
  token: string,
  items: Record<string, WatchProgress>
): Promise<void> {
  try {
    const row = await pbSync.saveWatch(userId, token, items, watchRowId);
    watchRowId = row.id;
  } catch {
    /* offline */
  }
}
