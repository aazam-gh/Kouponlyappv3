import { router } from 'expo-router';
import { GraduationCap, Save } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

type Profile = { first_name: string; last_name: string; email: string; phone: string; verification_status: string; account_role: string; university_id: string | null };
export default function RealXProfileScreen() {
  const theme = useAppTheme(); const { colors: C } = theme; const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]); const { user } = useAuth();
  const [profile, setProfile] = React.useState<Profile | null>(null); const [universities, setUniversities] = React.useState<any[]>([]); const [loading, setLoading] = React.useState(true); const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const client = getSupabase(); const [student, schools] = await Promise.all([
          client.from('realx_students').select('first_name,last_name,email,phone,verification_status,account_role,university_id').eq('id', user.id).maybeSingle(),
          client.from('realx_universities').select('id,name').eq('active', true).order('sort_order').limit(100),
        ]);
        if (student.error) throw student.error; if (schools.error) throw schools.error;
        if (active) { setProfile(student.data as Profile | null); setUniversities(schools.data || []); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load your profile.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user?.id]);
  const update = (key: keyof Profile, value: string) => setProfile((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    if (!user || !profile) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await getSupabase().from('realx_students').update({ first_name: profile.first_name.trim(), last_name: profile.last_name.trim(), phone: profile.phone.trim() || null, university_id: profile.university_id || null, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error; setMessage('Profile saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save your profile.'); }
    finally { setBusy(false); }
  };
  return <Screen testID="realx-profile-screen"><AppHeader eyebrow="REALX · ACCOUNT" title="Student profile" back />
    {!user ? <><Empty title="Sign in to view your profile" body="Use your account to manage your RealX student details." /><AccessiblePressable onPress={() => router.push('/auth' as any)} style={styles.button}><Text style={styles.buttonText}>Sign in</Text></AccessiblePressable></> : loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : profile ? <>
      <View style={styles.status}><GraduationCap size={18} color={C.ink} /><View style={{ flex: 1 }}><Text style={styles.statusTitle}>{profile.account_role === 'creator' ? 'Creator account' : 'Student account'}</Text><Text style={styles.statusBody}>Verification: {String(profile.verification_status || 'unverified').replace(/_/g, ' ')}</Text></View></View>
      <Field label="FIRST NAME" value={profile.first_name} onChangeText={(value: string) => update('first_name', value)} />
      <Field label="LAST NAME" value={profile.last_name} onChangeText={(value: string) => update('last_name', value)} />
      <Field label="EMAIL" value={profile.email || user.email || ''} editable={false} />
      <Field label="PHONE" value={profile.phone || ''} onChangeText={(value: string) => update('phone', value)} keyboardType="phone-pad" />
      <Text style={styles.label}>UNIVERSITY</Text><View style={styles.schools}>{universities.map((school) => <AccessiblePressable key={school.id} onPress={() => update('university_id', school.id)} style={[styles.school, profile.university_id === school.id && styles.schoolSelected]}><Text style={[styles.schoolText, profile.university_id === school.id && styles.schoolTextSelected]}>{school.name}</Text></AccessiblePressable>)}</View>
      {message ? <Text accessibilityRole="alert" style={[styles.message, message === 'Profile saved.' && { color: C.success }]}>{message}</Text> : null}
      <AccessiblePressable disabled={busy} onPress={() => void save()} style={styles.button}><Save size={16} color={C.onDark} /><Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save profile'}</Text></AccessiblePressable>
    </> : <Empty title="Student profile not found" body={message || 'Finish setting up your RealX account first.'} />}
  </Screen>;
}
function Field({ label, ...props }: any) { const { colors: C } = useAppTheme(); const styles = React.useMemo(() => makeStyles(C), [C]); return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor={C.muted} style={styles.input} /></View>; }
const makeStyles = (C: ThemeColors) => StyleSheet.create({ status: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 13, borderRadius: 16, backgroundColor: C.soft, marginBottom: 15 }, statusTitle: { fontFamily: F.bodyBold, color: C.ink, fontSize: 12, textTransform: 'capitalize' }, statusBody: { fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 3, textTransform: 'capitalize' }, field: { marginBottom: 12 }, label: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 6 }, input: { minHeight: 49, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 13, fontFamily: F.body, color: C.ink, fontSize: 14 }, schools: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 }, school: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: C.soft }, schoolSelected: { backgroundColor: C.ink }, schoolText: { fontFamily: F.bodySemi, fontSize: 11, color: C.ink }, schoolTextSelected: { color: C.onDark }, message: { fontFamily: F.bodySemi, fontSize: 12, color: C.danger, marginBottom: 10 }, button: { minHeight: 46, borderRadius: 14, backgroundColor: C.ink, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }, buttonText: { fontFamily: F.bodyBold, fontSize: 13, color: C.onDark } });
