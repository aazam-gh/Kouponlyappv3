import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyCataloguePatch, type CataloguePatch } from '@/lib/data';
import { ActivityIndicator, Text, View } from 'react-native';
import { Empty, PrimaryButton } from '@/components/ui';
import { useAppTheme } from '@/lib/theme';
import { deals } from '@/lib/data';
import { fetchCloudCatalogue, subscribeToCatalogue } from '@/lib/backend';
import { queryClient, queryKeys } from '@/utils/queryClient';

type CatalogueStatus = 'loading' | 'cloud' | 'offline';
type Value = { error: string; status: CatalogueStatus; revision: number; refresh: () => Promise<void>; start: () => void };
const Context = createContext<Value>({ error: '', status: 'loading', revision: 0, refresh: async () => {}, start: () => {} });

export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CatalogueStatus>('loading');
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const start = useCallback(() => setStarted(true), []);
  const [nextValidityChangeAt, setNextValidityChangeAt] = useState<number>();
  const [revision, setRevision] = useState(0);
  const activeRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++activeRefresh.current;
    setStatus('loading');
    setError('');
    setNextValidityChangeAt(undefined);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalogueHome(), exact: true, refetchType: 'none' });
      const catalogue = await queryClient.fetchQuery({ queryKey: queryKeys.catalogueHome(), queryFn: fetchCloudCatalogue });
      if (request !== activeRefresh.current) return;
      const patch: CataloguePatch = {
        deals: catalogue.deals,
        categories: catalogue.categories,
        heroSlides: catalogue.heroSlides,
        directoryItems: [...catalogue.offers, ...catalogue.partners].filter(item => item.destination !== 'rewards'),
        rewards: catalogue.rewards,
      };
      applyCataloguePatch(patch);
      setNextValidityChangeAt(catalogue.nextValidityChangeAt);
      setRevision(value => value + 1);
      setStatus('cloud');
      for (const key of [queryKeys.trendingOffers(), queryKeys.cmsDocument('brand')]) {
        if (queryClient.getQueryData(key) !== undefined) void queryClient.invalidateQueries({ queryKey: key });
      }
    } catch (error) {
      if (request === activeRefresh.current) {
        setError(error instanceof Error ? error.message : 'Offers could not be loaded.');
        setStatus('offline');
      }
    }
  }, []);

  useEffect(() => {
    if (!nextValidityChangeAt) return;
    const timer = setTimeout(() => { void refresh(); }, Math.max(0, nextValidityChangeAt - Date.now() + 50));
    return () => clearTimeout(timer);
  }, [nextValidityChangeAt, refresh]);

  useEffect(() => {
    if (!started) return;
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = subscribeToCatalogue(table => {
      if (table === 'couponly_cms_documents') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.homeEditorial() });
        void queryClient.invalidateQueries({ queryKey: ['cmsDocument'] });
        return;
      }
      if (table === 'couponly_categories') void queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 220);
    });
    return () => {
      activeRefresh.current++;
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [refresh, started]);

  const value = useMemo(() => ({ status, error, revision, refresh, start }), [status, error, revision, refresh, start]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCatalogue(enabled = true) {
  const state = useContext(Context);
  const { start } = state;
  useEffect(() => { if (enabled) start(); }, [enabled, start]);
  return state;
}

export function CatalogueNotice({ empty = false }: { empty?: boolean }) {
  const { status, error, refresh } = useCatalogue();
  const { colors } = useAppTheme();
  if (status === 'loading' && !deals.length) return <View accessibilityRole="progressbar" style={{ padding: 24, alignItems: 'center', gap: 10 }}><ActivityIndicator color={colors.ink} /><Text style={{color:colors.ink}}>Loading offers…</Text></View>;
  if (status === 'offline') return <View accessibilityRole="alert"><Text style={{color:colors.ink, paddingVertical:12}}>{deals.length ? 'Could not refresh offers. Showing the last loaded data.' : error || 'Offers could not be loaded.'}</Text><PrimaryButton label="Retry offers" onPress={() => void refresh()} /></View>;
  if (empty && status === 'cloud') return <Empty title="No offers available yet" body="Published vendor offers will appear here." />;
  return null;
}
