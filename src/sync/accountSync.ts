import AsyncStorage from '@react-native-async-storage/async-storage';
import { pbSync } from '../api/pocketbase';
import type { WatchProgress } from '../types/media';

// Mêmes clés que useFavorites / useWatchHistory (source locale).
const FAVORITES_KEY = '@streamflow_favorites';
const HISTORY_KEY = '@streamflow_watch_progress';

// IDs des lignes serveur (1 par compte), résolus au login.
let favRowId: string | undefined;
let watchRowId: string | undefined;

export function resetSyncCache(): void {
  favRowId = undefined;
  watchRowId = undefined;
}

async function readLocal(): Promise<{
  favIds: string[];
  watch: Record<string, WatchProgress>;
}> {
  const [f, w] = await Promise.all([
    AsyncStorage.getItem(FAVORITES_KEY),
    AsyncStorage.getItem(HISTORY_KEY),
  ]);
  let favIds: string[] = [];
  let watch: Record<string, WatchProgress> = {};
  try {
    if (f) {
      const parsed = JSON.parse(f);
      if (Array.isArray(parsed)) favIds = parsed;
    }
  } catch {
    /* stockage corrompu : on repart vide */
  }
  try {
    if (w) {
      const parsed = JSON.parse(w);
      if (parsed && typeof parsed === 'object') watch = parsed;
    }
  } catch {
    /* idem */
  }
  return { favIds, watch };
}

/**
 * Au login : fusionne serveur + local, écrit le résultat des deux côtés.
 * - Favoris : union des IDs.
 * - Historique : par média, garde l'entrée la plus récente (lastWatched).
 * À exécuter AVANT le montage des hooks (ils chargent au mount).
 */
export async function pullAndMerge(userId: string, token: string): Promise<void> {
  const [{ favIds: localFav, watch: localWatch }, serverFav, serverWatch] =
    await Promise.all([
      readLocal(),
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

  await Promise.all([
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(mergedFav)),
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(mergedWatch)),
  ]);

  // Fait converger le serveur (crée les lignes si 1er login).
  const [favRow, watchRow] = await Promise.all([
    pbSync.saveFavorites(userId, token, mergedFav, favRowId).catch(() => null),
    pbSync.saveWatch(userId, token, mergedWatch, watchRowId).catch(() => null),
  ]);
  if (favRow) favRowId = favRow.id;
  if (watchRow) watchRowId = watchRow.id;
}

/** Push favoris (appelé en debounce depuis l'app). Échec silencieux. */
export async function pushFavorites(
  userId: string,
  token: string,
  ids: string[]
): Promise<void> {
  try {
    const row = await pbSync.saveFavorites(userId, token, ids, favRowId);
    favRowId = row.id;
  } catch {
    /* offline : sera repoussé au prochain changement / login */
  }
}

/** Push historique. Échec silencieux. */
export async function pushWatch(
  userId: string,
  token: string,
  items: Record<string, WatchProgress>
): Promise<void> {
  try {
    const row = await pbSync.saveWatch(userId, token, items, watchRowId);
    watchRowId = row.id;
  } catch {
    /* idem */
  }
}
