import React from 'react';
import { useFocusEffect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Keyboard, Switch, TextInput, View } from 'react-native';
import { AppHeader, AppText, AccessiblePressable, PrimaryButton, Screen } from '@/components/ui';
import { StateSurface } from '@/components/StateSurface';
import { useAppTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { useBenefits } from '@/lib/benefits';
import { getSupabase } from '@/lib/supabase';
import { communityRpc, type FriendsSnapshot } from '@/lib/student-community';

export default function FriendsScreen() {
  const { user } = useAuth(); const { benefits } = useBenefits(); const { colors: C } = useAppTheme();
  const client = useQueryClient();
  const [code, setCode] = React.useState(''); const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState('');
  const owner = React.useRef(user?.id); owner.current = user?.id;
  const inFlight = React.useRef(false);
  const key = ['friends', user?.id];
  const snapshot = useQuery({ queryKey: key, queryFn: () => communityRpc<FriendsSnapshot>('kouponly_friends_snapshot'), enabled: !!user, staleTime: 15000 });
  useFocusEffect(React.useCallback(() => { if (user) void snapshot.refetch(); }, [user?.id]));
  React.useEffect(() => { setCode(''); setMessage(''); }, [user?.id]);
  const mutate = async (work: () => Promise<unknown>, success = '') => {
    if (inFlight.current) return;
    const uid = user?.id; inFlight.current = true; setBusy(true); setMessage(''); Keyboard.dismiss();
    try { await work(); await client.invalidateQueries({ queryKey: key }); if (owner.current === uid) { setMessage(success); setCode(''); } }
    catch (e) { if (owner.current === uid) setMessage(e instanceof Error ? e.message : 'Unable to update. Try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const respond = (id: string, action: string) => void mutate(() => communityRpc('kouponly_respond_friend', { p_id: id, p_action: action }));
  const toggleSharing = (value: boolean) => void mutate(async () => {
    const { error } = await getSupabase().from('kouponly_social_preferences').upsert({ user_id: user!.id, share_activity: value });
    if (error) throw new Error(error.message);
  });
  const button = (label: string, onPress: () => void) => <AccessiblePressable disabled={busy} onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.line }}><AppText variant="caption">{label}</AppText></AccessiblePressable>;
  if (!user) return <Screen><AppHeader title="Friends" back /><AppText color="muted">Sign in to add friends and see their shared activity.</AppText><PrimaryButton label="Sign in" onPress={() => router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } })} /></Screen>;
  return <Screen testID="friends-screen"><AppHeader title="Friends and activity" back />
    <View style={{ gap: 20 }}>
      <AppText color="muted">Add a friend using their five-character invite code. They must accept before you can see each other’s shared activity.</AppText>
      {benefits?.inviteCode ? <AppText selectable variant="headline">Your code: {benefits.inviteCode}</AppText> : null}
      <TextInput accessibilityLabel="Friend’s code" value={code} onChangeText={text => setCode(text.toUpperCase())} maxLength={5} autoCapitalize="characters" autoCorrect={false} editable={!busy} placeholder="Friend’s code" placeholderTextColor={C.muted} style={{ color: C.ink, padding: 16, borderWidth: 1, borderColor: C.line, borderRadius: 16, fontFamily: 'Outfit_400Regular', fontSize: 16 }} />
      <PrimaryButton label="Send friend request" loading={busy} disabled={code.trim().length !== 5} onPress={() => void mutate(() => communityRpc('kouponly_request_friend', { p_code: code }), 'Request sent. Your friend can accept it in Friends.')} />
      {message ? <AppText accessibilityLiveRegion="polite">{message}</AppText> : null}
      {snapshot.isLoading ? <StateSurface kind="loading" /> : snapshot.error && !snapshot.data ? <StateSurface kind="error" message={snapshot.error.message} onRetry={() => void snapshot.refetch()} /> : snapshot.data ? <>
        {snapshot.error ? <AppText color="danger">Unable to refresh. Showing your last loaded friends.</AppText> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 6 }}><AppText variant="headline">Share my activity</AppText><AppText variant="caption" color="muted">Let accepted friends see offers you saved and vendors you redeemed at in the last 30 days. Turn off to hide your activity.</AppText></View><Switch accessibilityLabel="Share my activity with friends" value={snapshot.data.shareActivity} disabled={busy} onValueChange={toggleSharing} /></View>
        <AppText variant="title">Your friends</AppText>
        {snapshot.data.friends.length === 0 ? <AppText color="muted">No friends yet. Ask a friend for their invite code.</AppText> : snapshot.data.friends.map(friend => <View key={friend.id} style={{ padding: 16, gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 20, backgroundColor: C.card }}><AppText variant="headline">{friend.name}</AppText><AppText variant="caption" color="muted">{friend.status === 'accepted' ? 'Friends' : friend.incoming ? 'Wants to be your friend' : 'Request pending'}</AppText><View style={{ flexDirection: 'row', gap: 10 }}>{friend.status === 'pending' && friend.incoming ? button('Accept', () => respond(friend.id, 'accept')) : null}{button(friend.status === 'accepted' ? 'Remove friend' : friend.incoming ? 'Decline' : 'Cancel request', () => respond(friend.id, 'remove'))}</View></View>)}
        <AppText variant="title">Friends’ activity</AppText>
        {snapshot.data.activity.length === 0 ? <AppText color="muted">No shared activity yet. Activity appears when friends choose to share it.</AppText> : snapshot.data.activity.map(event => <AccessiblePressable key={`${event.action}-${event.id}`} onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: event.vendorId } })} style={{ alignItems: 'flex-start', padding: 16, gap: 6, backgroundColor: C.card, borderRadius: 20 }}><AppText>{event.name} {event.action === 'saved' ? 'saved an offer at' : 'redeemed at'} {event.vendorName}</AppText><AppText variant="caption" color="muted">{event.title} · {new Date(event.createdAt).toLocaleDateString()}</AppText></AccessiblePressable>)}
        {button('Refresh friends and activity', () => void snapshot.refetch())}
      </> : null}
    </View>
  </Screen>;
}
