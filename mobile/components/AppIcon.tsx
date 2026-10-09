import type { ReactNode } from 'react';

type Props = { sf: string; fallback: ReactNode; size?: number; color?: string };

export default function AppIcon({ fallback }: Props) {
  return <>{fallback}</>;
}
