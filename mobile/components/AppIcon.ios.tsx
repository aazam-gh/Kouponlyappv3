import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { ReactNode } from 'react';
import { useAppTheme } from '@/lib/theme';

type Props = { sf: SFSymbol; fallback: ReactNode; size?: number; color?: string };

export default function AppIcon({ sf, fallback, size = 22, color }: Props) {
  const { colors } = useAppTheme();
  return <SymbolView name={sf} size={size} tintColor={color ?? colors.ink} weight="semibold" fallback={fallback} />;
}
