/**
 * Downloads — Téléchargements hors-ligne HLS (films + épisodes).
 *
 * - 1 seul téléchargement actif à la fois, les autres attendent en file.
 * - WiFi uniquement : pause auto si on quitte le WiFi, reprise auto au retour.
 * - Quota de 8 Go : refus avant démarrage (estimation) + garde-fou pendant.
 * - Persistance AsyncStorage : les encours repassent en pause au redémarrage,
 *   les terminés sont vérifiés (fichier manquant -> erreur + re-téléchargement).
 * - Reprise : les segments déjà présents sont sautés (pas de gaspillage data).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { Directory, File, Paths } from 'expo-file-system';
import { downloadHlsOffline, downloadCover, probeLocalBundle, OfflineQuality, OFFLINE_QUALITY_LABEL } from '../api/hlsOffline';
import { MediaItem, Episode } from '../types/media';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'done' | 'error';

export interface DownloadRecord {
  key: string;
  mediaId: string;
  episodeId: string | null;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  /** file:// de la cover locale (miniature épisode ou poster), null si absente */
  localCoverUri: string | null;
  remoteUrl: string;
  quality: OfflineQuality;
  qualityLabel: string;
  status: DownloadStatus;
  progress: number;
  bytesDownloaded: number;
  bytesTotal: number | null;
  segmentsDone: number;
  segmentsTotal: number | null;
  localUri: string | null;
  error: string | null;
  autoPaused: boolean;
  createdAt: number;
}

interface DownloadsContextValue {
  downloads: DownloadRecord[];
  /** URI de lecture : http://127.0.0.1 si le serveur local tourne, sinon file:// */
  getLocalUri: (mediaId: string, episodeId?: string) => string | null;
  /** Convertit une file:// URI enregistrée en URL lisible (serveur local si dispo) */
  toServeUrl: (fileUri: string) => string;
  getRecord: (mediaId: string, episodeId?: string) => DownloadRecord | undefined;
  startDownload: (media: MediaItem, episode: Episode | null, quality: OfflineQuality) => Promise<void>;
  pauseDownload: (key: string) => void;
  resumeDownload: (key: string) => void;
  removeDownload: (key: string) => Promise<void>;
  /** Bascule en erreur si le bundle local est incomplet/manquant. Retourne false si KO. */
  verifyLocal: (key: string) => boolean;
  /** true quand le serveur HTTP local répond (lecture hors-ligne possible) */
  serverReady: boolean;
  totalBytes: number;
}

const STORE_KEY = '@streamflow_downloads_v1';
export const OFFLINE_QUOTA_BYTES = 8 * 1024 * 1024 * 1024;
const START_ESTIMATE_BYTES = 1.5 * 1024 * 1024 * 1024;
const MIN_FREE_BYTES = 1 * 1024 * 1024 * 1024;

export const downloadKeyFor = (mediaId: string, episodeId?: string | null): string =>
  episodeId ? `ep:${mediaId}:${episodeId}` : `movie:${mediaId}`;

function offlineDir(key: string): Directory {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return new Directory(Paths.document, 'offline', safe);
}

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const activeRef = useRef<{ key: string; abort: AbortController } | null>(null);
  const downloadsRef = useRef<DownloadRecord[]>([]);
  downloadsRef.current = downloads;

  const persist = useCallback(async (list: DownloadRecord[]) => {
    try {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Downloads persist failed:', e);
    }
  }, []);

  const patch = useCallback(
    (key: string, p: Partial<DownloadRecord>) => {
      setDownloads(prev => {
        const next = prev.map(r => (r.key === key ? { ...r, ...p } : r));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  // ── Chargement initial : vérifie les fichiers, fige les encours en pause ──
  useEffect(() => {
    let alive = true;
    (async () => {
      let list: DownloadRecord[] = [];
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) list = JSON.parse(raw) as DownloadRecord[];
      } catch {
        list = [];
      }
      list = list.map(r => {
        if (r.status === 'done') {
          if (!bundleComplete(r.localUri)) {
            return { ...r, status: 'error' as const, error: 'Fichier incomplet — relancez le téléchargement', localUri: null, progress: 0 };
          }
          return r;
        }
        if (r.status === 'downloading' || r.status === 'queued') {
          return { ...r, status: 'paused' as const, autoPaused: false };
        }
        return r;
      });
      setDownloads(list);
      setLoaded(true);
      await persist(list);
      // Rattrapage des covers manquantes (anciens téléchargements) — silencieux.
      for (const r of list) {
        if (!alive) break;
        if (r.status !== 'done' || r.localCoverUri || !r.posterUrl) continue;
        try {
          const cover = await downloadCover(r.posterUrl, offlineDir(r.key));
          if (cover && alive) {
            setDownloads(prev => {
              const next = prev.map(x => (x.key === r.key ? { ...x, localCoverUri: cover } : x));
              persist(next);
              return next;
            });
          }
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [persist]);

  // Retourne l'URI directe du fichier fMP4 local (lecture native sans serveur HTTP)
  const toServeUrl = useCallback((fileUri: string): string => fileUri, []);

  const usedBytes = useMemo(
    () => downloads.reduce((t, r) => t + (r.status === 'done' ? r.bytesTotal ?? r.bytesDownloaded : r.bytesDownloaded), 0),
    [downloads]
  );

  const isWifi = useCallback(async (): Promise<boolean> => {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.type === Network.NetworkStateType.WIFI;
    } catch {
      return true;
    }
  }, []);

  // ── Pompe : 1 seul actif à la fois ─────────────────────────────────────────
  const pump = useCallback(async () => {
    if (!loaded || activeRef.current) return;
    const next = downloadsRef.current.find(r => r.status === 'queued');
    if (!next) return;

    if (!(await isWifi())) {
      patch(next.key, { status: 'paused', autoPaused: true, error: 'En attente du WiFi' });
      return;
    }
    if (usedBytesOf(downloadsRef.current) + START_ESTIMATE_BYTES > OFFLINE_QUOTA_BYTES) {
      patch(next.key, { status: 'error', error: 'Quota de 8 Go dépassé — supprimez un téléchargement' });
      return;
    }
    try {
      if (Paths.availableDiskSpace < MIN_FREE_BYTES) {
        patch(next.key, { status: 'error', error: 'Espace disque insuffisant' });
        return;
      }
    } catch {
      /* ignore */
    }

    const abort = new AbortController();
    activeRef.current = { key: next.key, abort };
    patch(next.key, { status: 'downloading', error: null, autoPaused: false });

    let lastReport = 0;
    let quotaHit = false;
    try {
      // URL fraîche : re-résout le flux jouable (les liens peuvent expirer).
      const { resolvePlayableStreamUrl } = await import('../api/hls');
      const freshUrl = await resolvePlayableStreamUrl(next.remoteUrl);
      const result = await downloadHlsOffline(freshUrl, next.quality, offlineDir(next.key), {
        signal: abort.signal,
        onProgress: p => {
          const now = Date.now();
          if (now - lastReport < 400 && p.segmentsDone < (p.segmentsTotal || 0)) return;
          lastReport = now;
          patch(next.key, {
            progress: p.segmentsTotal > 0 ? p.segmentsDone / p.segmentsTotal : 0,
            bytesDownloaded: p.bytesDownloaded,
            segmentsDone: p.segmentsDone,
            segmentsTotal: p.segmentsTotal,
          });
          if (usedBytesOf(downloadsRef.current) > OFFLINE_QUOTA_BYTES && !quotaHit) {
            quotaHit = true;
            abort.abort();
          }
        },
      });
      patch(next.key, {
        status: 'done',
        progress: 1,
        bytesDownloaded: result.bytesTotal,
        bytesTotal: result.bytesTotal,
        segmentsDone: result.segments,
        segmentsTotal: result.segments,
        localUri: result.localUri,
        qualityLabel: result.qualityLabel,
        remoteUrl: freshUrl,
        error: null,
      });
      // Cover locale (best-effort, après le marquage done pour ne pas bloquer).
      try {
        const cover = await downloadCover(next.posterUrl, offlineDir(next.key));
        if (cover) patch(next.key, { localCoverUri: cover });
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      const stillActive =
        downloadsRef.current.find(r => r.key === next.key)?.status === 'downloading';
      if (quotaHit) {
        patch(next.key, { status: 'error', error: 'Quota de 8 Go dépassé — supprimez un téléchargement' });
      } else if (abort.signal.aborted && stillActive) {
        patch(next.key, { status: 'paused' });
      } else if (e?.name !== 'AbortError') {
        patch(next.key, { status: 'error', error: friendlyDownloadError(e) });
      }
    } finally {
      activeRef.current = null;
      // Enchaîne le suivant.
      setTimeout(() => pumpRef.current(), 300);
    }
  }, [loaded, isWifi, patch]);

  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  useEffect(() => {
    if (loaded) pump();
  }, [loaded, downloads, pump]);

  // ── WiFi : pause auto en cellulaire, reprise auto au retour ────────────────
  useEffect(() => {
    const sub = Network.addNetworkStateListener(state => {
      const wifi = state.type === Network.NetworkStateType.WIFI;
      if (!wifi && activeRef.current) {
        const rec = downloadsRef.current.find(r => r.key === activeRef.current?.key);
        activeRef.current.abort.abort();
        if (rec) patch(rec.key, { status: 'paused', autoPaused: true, error: 'En attente du WiFi' });
      } else if (wifi) {
        const waiting = downloadsRef.current.find(r => r.status === 'paused' && r.autoPaused);
        if (waiting) {
          patch(waiting.key, { status: 'queued', autoPaused: false, error: null });
        }
      }
    });
    return () => sub.remove();
  }, [patch]);

  // ── API publique ───────────────────────────────────────────────────────────
  const getRecord = useCallback(
    (mediaId: string, episodeId?: string) =>
      downloadsRef.current.find(r => r.key === downloadKeyFor(mediaId, episodeId ?? null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [downloads]
  );

  const getLocalUri = useCallback(
    (mediaId: string, episodeId?: string): string | null => {
      const rec = downloadsRef.current.find(r => r.key === downloadKeyFor(mediaId, episodeId ?? null));
      if (!rec || rec.status !== 'done' || !rec.localUri) return null;
      if (!bundleComplete(rec.localUri)) return null;
      return toServeUrl(rec.localUri);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [downloads, toServeUrl]
  );

  const startDownload = useCallback(
    async (media: MediaItem, episode: Episode | null, quality: OfflineQuality) => {
      const key = downloadKeyFor(media.id, episode?.id ?? null);
      const existing = downloadsRef.current.find(r => r.key === key);
      if (existing && (existing.status === 'downloading' || existing.status === 'queued')) return;
      if (existing && existing.status === 'done') return;
      // Re-téléchargement après erreur : repart de zéro.
      if (existing) {
        try {
          offlineDir(key).delete();
        } catch {
          /* ignore */
        }
      }
      const rec: DownloadRecord = {
        key,
        mediaId: media.id,
        episodeId: episode?.id ?? null,
        title: media.title,
        subtitle: episode ? `S${episode.season} E${episode.episodeNumber} · ${episode.title}` : null,
        posterUrl: episode
          ? episode.thumbnailUrl || media.backdropUrl || media.posterUrl || null
          : media.posterUrl ?? null,
        localCoverUri: existing?.localCoverUri ?? null,
        remoteUrl: episode?.streamUrl ?? media.streamUrl,
        quality,
        qualityLabel: OFFLINE_QUALITY_LABEL[quality],
        status: 'queued',
        progress: 0,
        bytesDownloaded: 0,
        bytesTotal: null,
        segmentsDone: 0,
        segmentsTotal: null,
        localUri: null,
        error: null,
        autoPaused: false,
        createdAt: Date.now(),
      };
      setDownloads(prev => {
        const next = existing ? prev.map(r => (r.key === key ? rec : r)) : [...prev, rec];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const pauseDownload = useCallback(
    (key: string) => {
      if (activeRef.current?.key === key) {
        activeRef.current.abort.abort();
      } else {
        patch(key, { status: 'paused', autoPaused: false });
      }
    },
    [patch]
  );

  const resumeDownload = useCallback(
    (key: string) => {
      patch(key, { status: 'queued', error: null, autoPaused: false });
    },
    [patch]
  );

  const removeDownload = useCallback(
    async (key: string) => {
      if (activeRef.current?.key === key) {
        activeRef.current.abort.abort();
        activeRef.current = null;
      }
      try {
        offlineDir(key).delete();
      } catch {
        /* ignore */
      }
      setDownloads(prev => {
        const next = prev.filter(r => r.key !== key);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const verifyLocal = useCallback(
    (key: string): boolean => {
      const rec = downloadsRef.current.find(r => r.key === key);
      if (!rec) return false;
      if (bundleComplete(rec.localUri)) return true;
      patch(key, {
        status: 'error',
        error: 'Fichier incomplet — relancez le téléchargement',
        localUri: null,
        progress: 0,
      });
      return false;
    },
    [patch]
  );

  const value = useMemo(
    () => ({
      downloads,
      getLocalUri,
      toServeUrl,
      getRecord,
      startDownload,
      pauseDownload,
      resumeDownload,
      removeDownload,
      verifyLocal,
      serverReady: true,
      totalBytes: usedBytes,
    }),
    [downloads, getLocalUri, toServeUrl, getRecord, startDownload, pauseDownload, resumeDownload, removeDownload, verifyLocal, usedBytes]
  );

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

function usedBytesOf(list: DownloadRecord[]): number {
  return list.reduce(
    (t, r) => t + (r.status === 'done' ? r.bytesTotal ?? r.bytesDownloaded : r.bytesDownloaded),
    0
  );
}

/** Bundle local complet et lisible ? (master + 1er segment valide) */
function bundleComplete(localUri: string | null): boolean {
  return probeLocalBundle(localUri);
}

function friendlyDownloadError(e: any): string {
  const msg = e?.message ?? String(e);
  if (/Chiffrement non supporté/i.test(msg)) return 'Flux protégé — téléchargement impossible';
  if (/live non supporté/i.test(msg)) return 'Direct non téléchargeable';
  if (/Playlist vide/i.test(msg)) return 'Flux illisible — réessayez plus tard';
  if (/HTTP (\d+)/.test(msg)) return 'Serveur injoignable — réessayez plus tard';
  if (/Timeout|trop lente/i.test(msg)) return 'Connexion trop lente — réessayez en WiFi stable';
  if (/illisible|invalide/i.test(msg)) return 'Réponse serveur invalide — réessayez plus tard';
  if (/Network|fetch|Failed to fetch/i.test(msg)) return 'Connexion perdue — reprendra en WiFi';
  return 'Échec du téléchargement — réessayez';
}

export function useDownloads(): DownloadsContextValue {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error('useDownloads hors DownloadsProvider');
  return ctx;
}
