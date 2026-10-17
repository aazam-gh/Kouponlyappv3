import { DEFAULT_HOME_SECTION_ORDER, normalizeHomeSectionOrder, type HomeSectionId } from './home-layout';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyCataloguePatch, type CataloguePatch } from '@/lib/data';
import { ActivityIndicator, Text, View } from 'react-native';
import { Empty, PrimaryButton } from '@/components/ui';
import { useAppTheme } from '@/lib/theme';
import { deals } from '@/lib/data';
import { fetchCloudCatalogue, subscribeToCatalogue } from '@/lib/backend';
import { queryClient, queryKeys } from '@/utils/queryClient';

type CatalogueStatus = 'loading' | 'cloud' | 'offline';
type Value = { homeSectionOrder: HomeSectionId[]; error: string; status: CatalogueStatus; revision: number; refresh: () => Promise<void> };
const Context = createContext<Value>({ homeSectionOrder: DEFAULT_HOME_SECTION_ORDER, error: '', status: 'loading', revision: 0, refresh: async () => {} });

export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CatalogueStatus>('loading');
  const [error, setError] = useState('');
  const [homeSectionOrder, setHomeSectionOrder] = useState(DEFAULT_HOME_SECTION_ORDER);
  const [revision, setRevision] = useState(0);
  const activeRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++activeRefresh.current;
    setStatus('loading');
    setError('');
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
      setHomeSectionOrder(normalizeHomeSectionOrder(catalogue.homeSectionOrder));
      setRevision(value => value + 1);
      setStatus('cloud');
    } catch (error) {
      if (request === activeRefresh.current) {
        setError(error instanceof Error ? error.message : 'Offers could not be loaded.');
        setStatus('offline');
      }
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

  const value = useMemo(() => ({ status, error, revision, refresh, homeSectionOrder }), [status, error, revision, refresh, homeSectionOrder]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useCatalogue = () => useContext(Context);

export function CatalogueNotice({ empty = false }: { empty?: boolean }) {
  const { status, error, refresh } = useCatalogue();
  const { colors } = useAppTheme();
  if (status === 'loading' && !deals.length) return <View accessibilityRole="progressbar" style={{ padding: 24, alignItems: 'center', gap: 10 }}><ActivityIndicator color={colors.ink} /><Text style={{color:colors.ink}}>Loading offers…</Text></View>;
  if (status === 'offline') return <View accessibilityRole="alert"><Text style={{color:colors.ink, paddingVertical:12}}>{deals.length ? 'Could not refresh offers. Showing the last loaded data.' : error || 'Offers could not be loaded.'}</Text><PrimaryButton label="Retry offers" onPress={() => void refresh()} /></View>;
  if (empty && status === 'cloud') return <Empty title="No offers available yet" body="Published vendor offers will appear here." />;
  return null;
}
