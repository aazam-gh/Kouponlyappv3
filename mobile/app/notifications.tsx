import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import React from 'react';
import { AppState, Linking, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  const [clearingIds, setClearingIds] = React.useState<string[]>([]);
  const [clearingAll, setClearingAll] = React.useState(false);

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

  useFocusEffect(React.useCallback(() => { void load(); }, [load]));
  React.useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => { void load(); });
    const resumed = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { received.remove(); resumed.remove(); };
  }, [load]);

  const clearNotification = async (id: string) => {
    if (!user || clearingAll || clearingIds.includes(id)) return;
    setClearingIds(current => [...current, id]);
    try {
      const { error } = await getSupabase().from('notifications').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setRows(current => current.filter(row => row.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('state_error_message'));
    } finally {
      setClearingIds(current => current.filter(clearingId => clearingId !== id));
    }
  };

  const clearAllNotifications = async () => {
    if (!user || clearingAll || rows.length === 0) return;
    setClearingAll(true);
    try {
      const { error } = await getSupabase().from('notifications').delete().eq('user_id', user.id);
      if (error) throw error;
      setRows([]);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('state_error_message'));
    } finally {
      setClearingAll(false);
    }
  };

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
          <>{item.kind === 'prelaunch_welcome' ? <ScalePressable accessibilityRole="link" onPress={() => void Linking.openURL('https://kouponly.in').catch(() => setMessage('Unable to open the website.'))}><Text style={{ color: C.lime }}>Visit Kouponly</Text></ScalePressable> : null}</>
          <View style={[styles.footer, isRTL && styles.rowReverse]}>
            <Text style={[styles.date, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>{date}</Text>
            <ScalePressable accessibilityRole="button" accessibilityLabel={t('clear')} disabled={clearingIds.includes(item.id)} onPress={() => void clearNotification(item.id)}>
              <Text style={[styles.clear, { color: C.muted }]}>{t('clear')}</Text>
            </ScalePressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: C.paper }]} edges={['top']}>
      <AppHeader title={t('notifications_title')} onBackPress={() => router.back()} trailing={rows.length > 0 ? (
        <ScalePressable accessibilityRole="button" accessibilityLabel={t('clear')} disabled={clearingAll} onPress={() => void clearAllNotifications()}>
          <Text style={[styles.clearAll, { color: C.lime }]}>{t('clear')}</Text>
        </ScalePressable>
      ) : null} />
      {authLoading || loading ? <StateSurface kind="loading" /> : message && rows.length === 0 ? (
        <StateSurface kind="error" message={message} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={row => row.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, rows.length === 0 && { flexGrow: 1 }]}
          ListHeaderComponent={message ? <Text style={[styles.error, { color: C.muted }]}>{message}</Text> : null}
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
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clear: { fontSize: 12, fontFamily: F.bodySemi, fontWeight: '700', paddingVertical: 4 },
  clearAll: { fontSize: 14, fontFamily: F.bodySemi, fontWeight: '700', paddingVertical: 8 },
  error: { fontSize: 13, fontFamily: F.body, paddingBottom: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
