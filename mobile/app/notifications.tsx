import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppHeader from '@/components/navigation/AppHeader';
import { StateSurface } from '@/components/StateSurface';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { F, useAppTheme } from '@/lib/theme';
import { useAppLocale } from '@/context/LocaleContext';

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsRoute() {
  const { colors: C } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { isRTL } = useAppLocale();
  const [rows, setRows] = React.useState<NotificationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await getSupabase()
        .from('notifications')
        .select('id,title,body,kind,read_at,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setRows((data ?? []) as NotificationRow[]);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('state_error_message'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, t]);

  React.useEffect(() => { void load(); }, [load]);

  const renderItem = ({ item }: { item: NotificationRow }) => {
    const date = new Date(item.created_at).toLocaleString('en-QA', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return (
      <View style={[styles.card, isRTL && styles.rowReverse]}>
        <View style={[styles.icon, { backgroundColor: C.soft }]}>
          <Ionicons name="notifications-outline" size={20} color={C.lime} />
        </View>
        <View style={styles.copy}>
          <View style={[styles.titleRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.title, { color: C.ink, textAlign: isRTL ? 'right' : 'left' }]}>{item.title}</Text>
            {!item.read_at ? <View style={[styles.unreadDot, { backgroundColor: C.lime }]} /> : null}
          </View>
          <Text style={[styles.body, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>{item.body}</Text>
          <Text style={[styles.date, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>{date}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: C.paper }]} edges={['top']}>
      <AppHeader title={t('notifications_title')} onBackPress={() => router.back()} />
      {authLoading || loading ? <StateSurface kind="loading" /> : message && rows.length === 0 ? (
        <StateSurface kind="error" message={message} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={row => row.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, rows.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={C.lime} />}
          ListEmptyComponent={<StateSurface kind="empty" title={t('notifications_empty')} />}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: ReturnType<typeof useAppTheme>['colors']) => StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  card: { flexDirection: 'row', gap: 14, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowReverse: { flexDirection: 'row-reverse' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontFamily: F.bodySemi, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20, fontFamily: F.body },
  date: { fontSize: 12, fontFamily: F.body },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
