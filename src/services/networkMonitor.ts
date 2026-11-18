import * as Network from 'expo-network';
import { Platform } from 'react-native';

export type NetworkConnectionType = 'WIFI' | 'CELLULAR' | 'NONE' | 'ETHERNET' | 'UNKNOWN';

export interface RealNetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetworkConnectionType;
  ipAddress: string | null;
  isOffline: boolean;
  checkedAt: string;
}

export function mapNetworkStateType(rawType?: Network.NetworkStateType | string): NetworkConnectionType {
  switch (rawType) {
    case Network.NetworkStateType.WIFI:
      return 'WIFI';
    case Network.NetworkStateType.CELLULAR:
      return 'CELLULAR';
    case Network.NetworkStateType.ETHERNET:
      return 'ETHERNET';
    case Network.NetworkStateType.NONE:
      return 'NONE';
    default:
      return 'UNKNOWN';
  }
}

export function normalizeNetworkState(
  state: {
    isConnected?: boolean;
    isInternetReachable?: boolean;
    type?: Network.NetworkStateType | string;
  },
  ipAddress: string | null = null
): RealNetworkStatus {
  const type = mapNetworkStateType(state.type);
  const isConnected = Boolean(state.isConnected) && type !== 'NONE';
  const isInternetReachable =
    typeof state.isInternetReachable === 'boolean' ? state.isInternetReachable : isConnected;
  const isOffline = !isConnected || !isInternetReachable;

  return {
    isConnected,
    isInternetReachable,
    type: isOffline && type === 'UNKNOWN' ? 'NONE' : type,
    ipAddress: isOffline ? null : ipAddress,
    isOffline,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Queries real device connectivity state (Wi-Fi / Cellular / Airplane Mode) and local IPv4 address.
 */
export async function fetchRealNetworkStatus(): Promise<RealNetworkStatus> {
  if (Platform.OS === 'web') {
    const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    return {
      isConnected: online,
      isInternetReachable: online,
      type: online ? 'WIFI' : 'NONE',
      ipAddress: online ? 'web-client' : null,
      isOffline: !online,
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const state = await Network.getNetworkStateAsync();
    let ip: string | null = null;
    if (state.isConnected && state.type !== Network.NetworkStateType.NONE) {
      try {
        const candidateIp = await Network.getIpAddressAsync();
        ip = candidateIp && candidateIp !== '0.0.0.0' ? candidateIp : null;
      } catch {
        ip = null;
      }
    }
    return normalizeNetworkState(state, ip);
  } catch {
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'NONE',
      ipAddress: null,
      isOffline: true,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Subscribes to live OS network state changes (Wi-Fi, Cellular, Airplane Mode).
 */
export function subscribeToNetworkStatus(
  onChange: (status: RealNetworkStatus) => void
): () => void {
  let active = true;

  void fetchRealNetworkStatus().then((initial) => {
    if (active) onChange(initial);
  });

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return () => {
        active = false;
      };
    }

    const handleWebChange = () => {
      void fetchRealNetworkStatus().then((status) => {
        if (active) onChange(status);
      });
    };

    window.addEventListener('online', handleWebChange);
    window.addEventListener('offline', handleWebChange);

    return () => {
      active = false;
      window.removeEventListener('online', handleWebChange);
      window.removeEventListener('offline', handleWebChange);
    };
  }

  const subscription = Network.addNetworkStateListener((event) => {
    if (!active) return;
    void (async () => {
      let ip: string | null = null;
      if (event.isConnected && event.type !== Network.NetworkStateType.NONE) {
        try {
          const candidateIp = await Network.getIpAddressAsync();
          ip = candidateIp && candidateIp !== '0.0.0.0' ? candidateIp : null;
        } catch {
          ip = null;
        }
      }
      if (active) {
        onChange(normalizeNetworkState(event, ip));
      }
    })();
  });

  return () => {
    active = false;
    subscription.remove();
  };
}
