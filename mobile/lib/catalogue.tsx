import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyCataloguePatch, type CataloguePatch } from '@/lib/data';
import { fetchCloudCatalogue, subscribeToCatalogue } from '@/lib/backend';

type CatalogueStatus = 'bundled' | 'loading' | 'cloud' | 'offline';
type Value = { status: CatalogueStatus; revision: number; refresh: () => Promise<void> };
const Context = createContext<Value>({ status: 'bundled', revision: 0, refresh: async () => {} });

export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CatalogueStatus>('bundled');
  const [revision, setRevision] = useState(0);
  const activeRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++activeRefresh.current;
    setStatus('loading');
    try {
      const catalogue = await fetchCloudCatalogue();
      if (request !== activeRefresh.current) return;
      if (!catalogue) {
        setStatus('bundled');
        return;
      }
      const patch: CataloguePatch = {
        deals: catalogue.deals,
        categories: catalogue.categories,
        heroSlides: catalogue.heroSlides,
        directoryItems: [...catalogue.offers, ...catalogue.partners],
        campaigns: catalogue.campaigns,
        rewards: catalogue.rewards,
      };
      applyCataloguePatch(patch);
      setRevision(value => value + 1);
      setStatus('cloud');
    } catch {
      if (request === activeRefresh.current) setStatus('offline');
    }
  }, []);

  useEffect(() => {
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = subscribeToCatalogue(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 220);
    });
    return () => {
      activeRefresh.current++;
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo(() => ({ status, revision, refresh }), [status, revision, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useCatalogue = () => useContext(Context);
