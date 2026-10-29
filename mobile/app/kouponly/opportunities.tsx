import { router } from 'expo-router';
import { useEffect } from 'react';

export default function OpportunitiesCompatibilityRoute() {
  useEffect(() => { router.replace('/kouponly/map' as any); }, []);
  return null;
}
