import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

/**
 * useIsOffline — true uniquement quand l'absence de connexion est confirmée
 * (pas de réseau, ou internet injoignable). État inconnu = en ligne.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const apply = (s: Network.NetworkState) => {
      if (alive) setOffline(!s.isConnected || s.isInternetReachable === false);
    };
    Network.getNetworkStateAsync().then(apply).catch(() => {});
    const sub = Network.addNetworkStateListener(apply);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return offline;
}
