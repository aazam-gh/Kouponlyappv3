import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/navigation/AppHeader';
import { Typography } from '../constants/Typography';
import { useAppTheme } from '../context/AppThemeContext';
import { useAuth } from '../lib/auth';
import { makeMutationId, useBenefits } from '../lib/benefits';
import { useStore } from '../lib/store';

export default function EnterCodeScreen() {
  const router = useRouter(); const { theme } = useAppTheme(); const insets = useSafeAreaInsets();
  const { user } = useAuth(); const { claim } = useBenefits(); const { retrySync } = useStore();
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const request = useRef({ code: '', id: '' }); const inFlight = useRef(false);
  const owner = useRef(user?.id); owner.current = user?.id;
  useEffect(() => { setCode(''); setSuccess(''); setError(''); setBusy(false); inFlight.current = false; request.current = { code: '', id: '' }; }, [user?.id]);
  const submit = async () => {
    if (inFlight.current || !code.trim()) return;
    if (!user) { router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any); return; }
    const normalized = code.trim().toUpperCase();
    if (request.current.code !== normalized) request.current = { code: normalized, id: makeMutationId() };
    inFlight.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const result = await claim(normalized, request.current.id);
      if (owner.current !== user.id) return;
      setSuccess(result.kind === 'voucher' ? 'Your coupons have refreshed for this month.' : result.status === 'attached' ? 'Invite applied. Your friend’s reward is pending account verification.' : result.status === 'rewarded' ? 'Invite applied. Your friend’s coupons have refreshed.' : 'Invite applied. Your friend is not eligible for a refresh in this period.');
      await retrySync().catch(() => {});
    } catch (e) { if (owner.current === user.id) setError(e instanceof Error ? e.message : 'Unable to apply this code. Please try again.'); }
    finally { if (owner.current === user.id) { inFlight.current = false; setBusy(false); } }
  };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: Platform.OS === 'android' ? insets.top : 0, paddingBottom: insets.bottom + 24 }}>
      <AppHeader title="Enter a code" onBackPress={() => router.canGoBack() ? router.back() : router.replace('/realx/profile' as any)} />
      <View style={{ padding: 24, gap: 16 }}>
        <Text style={{ color: theme.mutedText, lineHeight: 23 }}>Enter a friend’s five-character invite code. This refreshes their coupons for this month, up to three times total. Each account can use one friend’s code.</Text>
        <TextInput accessibilityLabel="Friend’s invite code" value={code} editable={!busy} onChangeText={text => { setCode(text.toUpperCase()); setError(''); setSuccess(''); }} placeholder="Friend’s invite code" placeholderTextColor={theme.subtleText} autoCapitalize="characters" autoCorrect={false} maxLength={5} returnKeyType="done" onSubmitEditing={() => void submit()} style={{ minHeight: 56, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 16, color: theme.text, fontFamily: 'Poppins' }} />
        {error ? <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
        {success ? <Text selectable accessibilityLiveRegion="polite" style={{ color: theme.brandText }}>{success}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={busy || !code.trim()} onPress={() => void submit()} style={{ minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.actionSolid, opacity: busy || !code.trim() ? 0.45 : 1 }}>
          <Text style={{ color: theme.buttonText, ...Typography.getTextVariantStyle('bodyStrong') }}>{busy ? 'Applying code…' : user ? 'Apply code' : 'Sign in to apply code'}</Text>
        </TouchableOpacity>
        {success ? <TouchableOpacity accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/realx/profile' as any)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.text }}>Done</Text></TouchableOpacity> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
