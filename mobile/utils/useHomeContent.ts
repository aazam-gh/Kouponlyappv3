import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { normalizeHomeSectionOrder } from '@/lib/home-layout';
import { homeQueryOptions, readHomeBanners, type HomeCategoryItem } from './homeQueries';
import { queryClient } from './queryClient';

const categories = homeQueryOptions.categories('en');
const editorial = homeQueryOptions.editorial();
const CATEGORY_KEY = 'kouponly.home.categories.v1';
const EDITORIAL_KEY = 'kouponly.home.editorial.v1';
const MAX_AGE = 24 * 60 * 60 * 1000;

function readSnapshot(raw: string | null) {
  try {
    const saved = raw ? JSON.parse(raw) : null;
    if (typeof saved?.savedAt !== 'number') return undefined;
    const age = Date.now() - saved?.savedAt;
    return age >= 0 && age < MAX_AGE ? saved : undefined;
  } catch {
    return undefined;
  }
}

export function useHomeContent() {
  const [restored, setRestored] = useState(false);
  const categoryQuery = useQuery({ ...categories, enabled: restored, staleTime: 0 });
  const editorialQuery = useQuery({ ...editorial, enabled: restored, staleTime: 0 });

  useEffect(() => {
    let active = true;
    void AsyncStorage.multiGet([CATEGORY_KEY, EDITORIAL_KEY]).then(entries => {
      if (!active) return;
      const savedCategories = readSnapshot(entries[0]?.[1] ?? null);
      const savedEditorial = readSnapshot(entries[1]?.[1] ?? null);
      if (!queryClient.getQueryState(categories.queryKey)?.data && Array.isArray(savedCategories?.data)
        && savedCategories.data.every((row: HomeCategoryItem) => typeof row?.id === 'string' && typeof row.name === 'string')) {
        queryClient.setQueryData(categories.queryKey, savedCategories.data, { updatedAt: savedCategories.savedAt });
      }
      if (!queryClient.getQueryState(editorial.queryKey)?.data && Array.isArray(savedEditorial?.data?.order)
        && Array.isArray(savedEditorial.data.banners)) {
        queryClient.setQueryData(editorial.queryKey, {
          order: normalizeHomeSectionOrder(savedEditorial.data.order),
          banners: readHomeBanners(savedEditorial.data.banners),
        }, { updatedAt: savedEditorial.savedAt });
      }
    }).catch(() => {}).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, []);

  const { data: categoryData, dataUpdatedAt: categoriesUpdatedAt } = categoryQuery;
  const { data: editorialData, dataUpdatedAt: editorialUpdatedAt } = editorialQuery;
  useEffect(() => {
    if (restored && categoryData) void AsyncStorage.setItem(CATEGORY_KEY, JSON.stringify({ data: categoryData, savedAt: categoriesUpdatedAt })).catch(() => {});
  }, [restored, categoryData, categoriesUpdatedAt]);
  useEffect(() => {
    if (restored && editorialData) void AsyncStorage.setItem(EDITORIAL_KEY, JSON.stringify({ data: editorialData, savedAt: editorialUpdatedAt })).catch(() => {});
  }, [restored, editorialData, editorialUpdatedAt]);

  useEffect(() => {
    if (!restored) return;
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void queryClient.invalidateQueries({ queryKey: categories.queryKey });
      void queryClient.invalidateQueries({ queryKey: editorial.queryKey });
      void queryClient.invalidateQueries({ queryKey: homeQueryOptions.previews().queryKey });
    });
    return () => listener.remove();
  }, [restored]);

  return { categories: categoryQuery, editorial: editorialQuery };
}
