import { router } from 'expo-router';
import { ArrowUpRight, BadgePercent, BusFront, GraduationCap, Handshake, MapPin, Search, UserRound, WalletCards, Zap } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

const features = [
  { title: 'Student account', note: 'Join with your school email or submit an ID for review.', path: '/realx/onboarding', Icon: GraduationCap },
  { title: 'Student profile', note: 'Review and update your student details.', path: '/realx/profile', Icon: UserRound },
  { title: 'Campus offers', note: 'Browse student deals and redeem securely with a vendor PIN.', path: '/realx/offers', Icon: BadgePercent },
  { title: 'Search partners', note: 'Find vendors, deals, and campus categories.', path: '/realx/search', Icon: Search },
  { title: 'Partner map', note: 'Browse active partner locations around Qatar.', path: '/realx/map', Icon: MapPin },
  { title: 'Wallet', note: 'Review cashback, savings, and your redemption history.', path: '/realx/wallet', Icon: WalletCards },
  { title: 'Saved offers', note: 'Return to vendors and offers you bookmarked.', path: '/realx/saved', Icon: BadgePercent },
  { title: 'Redemption history', note: 'Review your RealX transactions.', path: '/realx/history', Icon: WalletCards },
  { title: 'Opportunities', note: 'Find student and creator opportunities.', path: '/realx/opportunities', Icon: Handshake },
  { title: 'Wakti', note: 'Check your student eligibility for Wakti.', path: '/realx/wakti', Icon: Zap },
  { title: 'Badrgo rides', note: 'See the current voucher program and claim a weekly code.', path: '/realx/badrgo', Icon: BusFront },
] as const;

export default function RealXHomeScreen() {
  const theme = useAppTheme();
  const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [student, setStudent] = React.useState<{ first_name: string; last_name: string; verification_status: string } | null>(null);
  const [loading, setLoading] = React.useState(Boolean(user));
  const [message, setMessage] = React.useState('');
  const [categories, setCategories] = React.useState<Array<{id:string;name:string}>>([]);

  React.useEffect(() => {
    let active = true;
    if (!user) { setStudent(null); setLoading(false); return; }
    void (async () => {
      try {
        const { data, error } = await getSupabase().from('realx_students').select('first_name,last_name,verification_status').eq('id', user.id).maybeSingle();
        if (error) throw error;
        if (active) { setStudent(data as any); setMessage(''); }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load your student account.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  React.useEffect(() => {
    let active = true;
    void getSupabase().from('realx_categories').select('id,name').eq('active', true).order('sort_order').limit(12)
      .then(({data,error}) => { if (active && !error) setCategories((data || []) as Array<{id:string;name:string}>); });
    return () => { active = false; };
  }, []);

  const name = student ? [student.first_name, student.last_name].filter(Boolean).join(' ') : '';
  return <Screen testID="realx-home-screen">
    <AppHeader eyebrow="REALX · CAMPUS" title="Student life, connected" back />
    <View style={styles.hero}>
      <View style={styles.heroIcon}><GraduationCap size={25} color={C.ink} /></View>
      <Text style={styles.heroEyebrow}>YOUR REALX ACCOUNT</Text>
      <Text style={styles.heroTitle}>{name ? `Welcome, ${name.split(' ')[0]}` : 'One account for campus perks'}</Text>
      <Text style={styles.heroBody}>{loading ? 'Loading your student profile…' : message || (student?.verification_status === 'verified' ? 'Your student profile is ready. Explore offers, rewards, and opportunities.' : 'Set up a student profile to unlock verified offers and campus features.')}</Text>
      <View style={styles.heroActions}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/realx/onboarding' as any)} style={styles.primary}><Text style={styles.primaryText}>{student ? 'View student account' : 'Set up account'}</Text><ArrowUpRight size={16} color={C.onDark} /></Pressable>
      </View>
    </View>
    <Text style={styles.section}>REALX FEATURES</Text>
    {categories.length ? <><Text style={styles.section}>CAMPUS CATEGORIES</Text><View style={styles.categories}>{categories.map((category) => <Pressable key={category.id} accessibilityRole="button" onPress={() => router.push({pathname:'/realx/category/[id]',params:{id:category.id}} as any)} style={styles.category}><Text style={styles.categoryText}>{category.name}</Text></Pressable>)}</View></> : null}
    <View style={styles.featureList}>
      {features.map(({ title, note, path, Icon }) => <Pressable key={path} accessibilityRole="button" accessibilityLabel={`${title}. ${note}`} onPress={() => router.push(path as any)} style={({ pressed }) => [styles.feature, pressed && styles.pressed]}>
        <View style={styles.featureIcon}><Icon size={20} color={C.ink} /></View>
        <View style={{ flex: 1 }}><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureNote}>{note}</Text></View>
        <ArrowUpRight size={17} color={C.muted} />
      </Pressable>)}
    </View>
  </Screen>;
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  hero: { backgroundColor: C.ink, borderRadius: 28, padding: 21, marginBottom: 27 },
  heroIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroEyebrow: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1.3, color: C.lime },
  heroTitle: { fontFamily: F.heading, fontSize: 24, lineHeight: 29, color: C.onDark, marginTop: 6 },
  heroBody: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: '#E0E0E0', marginTop: 8 },
  heroActions: { marginTop: 17, flexDirection: 'row' },
  primary: { minHeight: 43, borderRadius: 14, backgroundColor: C.inkOnAccent, paddingHorizontal: 14, flexDirection: 'row', gap: 8, alignItems: 'center' },
  primaryText: { fontFamily: F.bodyBold, fontSize: 13, color: C.ink },
  section: { fontFamily: F.bodyBold, color: C.muted, fontSize: 10, letterSpacing: 1.2, marginBottom: 12 },
  featureList: { gap: 9 },
  feature: { minHeight: 78, borderWidth: 1, borderColor: C.line, borderRadius: 19, backgroundColor: C.card, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', gap: 12, alignItems: 'center' },
  featureIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontFamily: F.headingSemi, color: C.ink, fontSize: 15 },
  featureNote: { fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: -5, marginBottom: 20 },
  category: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: C.soft },
  categoryText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 11 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
