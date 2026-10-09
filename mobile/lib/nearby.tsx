import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { fetchVendorMapLocations, type VendorMapLocation } from '@/lib/nearby-vendors';
import { getCurrentPosition } from '@/lib/location';

type NearbyStatus = 'idle' | 'loading' | 'ready' | 'permission' | 'error';
type LoadOptions = { askForPermission?: boolean; force?: boolean };
type NearbyValue = {
  locations: VendorMapLocation[];
  position: { latitude: number; longitude: number } | null;
  status: NearbyStatus;
  error: string;
  canAskAgain: boolean;
  load: (options?: LoadOptions) => Promise<void>;
};

const Context = createContext<NearbyValue | null>(null);

export function NearbyProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<VendorMapLocation[]>([]);
  const [position, setPosition] = useState<NearbyValue['position']>(null);
  const [status, setStatus] = useState<NearbyStatus>('idle');
  const [error, setError] = useState('');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const request = useRef<Promise<void> | null>(null);
  const attempted = useRef(false);
  const hasData = useRef(false);

  const load = useCallback(({ askForPermission = false, force = false }: LoadOptions = {}) => {
    if (request.current) return request.current;
    if (!force && attempted.current) return Promise.resolve();
    attempted.current = true;
    setError('');
    setStatus(current => current === 'ready' ? current : 'loading');

    const task = (async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted' && (askForPermission || (permission.status === 'undetermined' && permission.canAskAgain))) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        setCanAskAgain(permission.canAskAgain);
        if (permission.status !== 'granted') {
          if (hasData.current) {
            setError('Allow location access to refresh nearby offers.');
            setStatus('ready');
          } else setStatus('permission');
          return;
        }
        if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on location services to find nearby offers.');

        const current = await getCurrentPosition();
        const nextPosition = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        const nextLocations = await fetchVendorMapLocations();
        setPosition(nextPosition);
        setLocations(nextLocations);
        hasData.current = true;
        setStatus('ready');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Nearby offers could not be loaded.');
        setStatus(hasData.current ? 'ready' : 'error');
      }
    })().finally(() => { request.current = null; });
    request.current = task;
    return task;
  }, []);

  const value = useMemo(() => ({ locations, position, status, error, canAskAgain, load }), [locations, position, status, error, canAskAgain, load]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useNearby = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useNearby must be inside NearbyProvider');
  return value;
};
