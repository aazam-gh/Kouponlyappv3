import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Typography } from '../../constants/Typography';
import AppText from '../../components/AppText';
import ResponsiveText from '../../components/ResponsiveText';
import InviteCodePill from '../../components/InviteCodePill';
import { useBenefits } from '../../lib/benefits';
import UserAvatar from '../../components/UserAvatar';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAuth } from '../../lib/auth';
import { useProfile } from '../../lib/profile';
import { getSupabase } from '../../lib/supabase';
import { useAppLocale } from '../../context/LocaleContext';
import { useTabBarScrollVisibility } from '../../components/TabBarScrollVisibility';

export default function ProfileScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  const { user, signOut } = useAuth();
  const isGuest = !user;
  const endGuestSession = signOut;
  const { profile, avatarUrl } = useProfile();
  const { isAdmin } = useBenefits();
  const [savings, setSavings] = useState(0);
  const userData = user ? {
    firstName: profile.full_name.split(' ')[0],
    lastName: profile.full_name.split(' ').slice(1).join(' '),
    email: profile.email || user.email,
    photoURL: avatarUrl,
    role: 'student',
    savings,
  } : null;
  useEffect(() => {
    let active = true;
    if (user) void getSupabase().from('realx_students').select('savings').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (active) setSavings(Number(data?.savings) || 0); });
    return () => { active = false; };
  }, [user?.id]);
  const tabBarScrollVisibility = useTabBarScrollVisibility();
  const savedAmount = userData?.savings ?? 0;
  const savingsAmount = Number.isInteger(savedAmount) ? savedAmount.toFixed(0) : savedAmount.toFixed(2);
  const formattedSavingsAmount = savingsAmount;
  const androidTopInset = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 24 : 0;
  const handleLogout = () => {
    Alert.alert(
      t('logout_title'),
      t('logout_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('log_out'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(t('error'), t('logout_failed'));
            }
          },
        },
      ]
    );
  };

  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {isFocused ? <StatusBar style={isDark ? 'light' : 'dark'} animated /> : null}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 14 + androidTopInset }]}
          {...tabBarScrollVisibility}
        >
          <View style={[styles.topPill, { backgroundColor: theme.cardMuted }]}>
            <View style={styles.profileTopRow}>
              <UserAvatar
                firstName={t('guest_home_name')}
                email={t('guest_profile_email')}
                size={80}
              />
              <View style={[styles.badge, { backgroundColor: theme.brand }]}>
                <AppText style={[{ color: theme.onActionSolid, textAlign: isRTL ? 'right' : 'left' }, styles.badgeText]}>{t('guest_badge')}</AppText>
              </View>
            </View>
          </View>

          <View style={[styles.bottomPill, { backgroundColor: theme.cardMuted }]}>
            <View style={[styles.guestProfileContent, isRTL && styles.guestProfileContentRTL]}>
              <Text style={[{ color: theme.text, ...Typography.getTextVariantStyle('body'), textAlign: isRTL ? 'right' : 'left' }, styles.userName]}>
                {t('guest_profile_title')}
              </Text>
              <Text style={[styles.guestProfileBody, { color: theme.mutedText, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('guest_profile_body')}
              </Text>
              <View style={[styles.guestProfileActions, isRTL && styles.guestProfileActionsRTL]}>
                <TouchableOpacity
                  style={[styles.guestPrimaryAction, { backgroundColor: theme.actionSolid }]}
                  onPress={() => { void endGuestSession().finally(() => router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any)); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.guestPrimaryActionText, { color: theme.onActionSolid }]}>{t('onboarding_login_action')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.guestSecondaryAction, { borderColor: theme.border }]}
                  onPress={() => { void endGuestSession().finally(() => router.push('/realx/welcome' as any)); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.guestSecondaryActionText, { color: theme.text }]}>{t('onboarding_sign_up')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.menuContainer}>
            <MenuItem
              icon="mail-outline"
              label={t('contact_us')}
              onPress={() => Linking.openURL('mailto:hello@kouponly.com')}
              isRTL={isRTL}
            />
            <MenuItem
              icon="document-text-outline"
              label={t('terms_and_conditions')}
              onPress={() => router.push('/terms')}
              isRTL={isRTL}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label={t('privacy_policy')}
              onPress={() => router.push('/privacy')}
              isRTL={isRTL}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isFocused ? <StatusBar style={isDark ? 'light' : 'dark'} animated /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 14 + androidTopInset }]}
        {...tabBarScrollVisibility}
      >
        <View style={[styles.savingsCard, { backgroundColor: theme.surfaceElevated }]}>
          <View style={[styles.profileSavingsRow, isRTL && styles.profileSavingsRowRTL]}>
              <View style={[styles.savingsDetails, { borderColor: theme.border }, isRTL && styles.savingsDetailsRTL]}>
                <View style={[styles.savingsInline, isRTL && styles.savingsInlineRTL]}>
                  <ResponsiveText style={[styles.savingsValueText, { color: theme.brandText }]} minimumFontScale={0.7}>
                    {formattedSavingsAmount}
                  </ResponsiveText>
                  <ResponsiveText style={[styles.savingsValueText, { color: theme.text }]} minimumFontScale={0.7}>
                    {t('savings_saved_label')}
                  </ResponsiveText>
                </View>
            </View>
            <TouchableOpacity
              style={styles.profileAvatarButton}
              onPress={() => router.push('/profile-details')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('profile')}
            >
              <UserAvatar
                firstName={userData?.firstName}
                lastName={userData?.lastName}
                email={userData?.email || user?.email}
                photoURL={userData?.photoURL || avatarUrl}
                role={userData?.role}
                seed={user?.id}
                size={60}
              />
            </TouchableOpacity>
          </View>
        </View>

        <InviteCodePill />
        <View style={styles.menuContainer}>
          {isAdmin ? <MenuItem icon="settings-outline" label="MVP activity" onPress={() => router.push('/subscription/admin' as any)} isRTL={isRTL} /> : null}
          <MenuItem
            icon="bookmark-outline"
            label={t('saved_offers')}
            onPress={() => router.push('/realx/saved' as any)}
            isRTL={isRTL}
          />
          <MenuItem
            icon="time-outline"
            label={t('redemption_history')}
            onPress={() => router.push('/realx/history' as any)}
            isRTL={isRTL}
          />
          <MenuItem
            icon="mail-outline"
            label={t('contact_us')}
            onPress={() => Linking.openURL('mailto:hello@kouponly.com')}
            isRTL={isRTL}
          />
          <MenuItem
            icon="document-text-outline"
            label={t('terms_and_conditions')}
            onPress={() => router.push('/terms')}
            isRTL={isRTL}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            label={t('privacy_policy')}
            onPress={() => router.push('/privacy')}
            isRTL={isRTL}
          />
          <TouchableOpacity
            style={[styles.logoutPill, { backgroundColor: isDark ? 'rgba(255,107,95,0.12)' : '#FFF1F0', borderColor: theme.danger }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.logoutContent}>
              <Ionicons name="log-out-outline" size={20} color={theme.danger} />
              <AppText style={[styles.logoutText, { color: theme.danger, textAlign: isRTL ? 'right' : 'left' }]}>{t('log_out').toUpperCase()}</AppText>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  color,
  bgColor,
  isRTL,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  color?: string;
  bgColor?: string;
  isRTL: boolean;
  disabled?: boolean;
}) {
  const { theme } = useAppTheme();

  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        { backgroundColor: bgColor || theme.cardMuted },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={24} color={color || theme.icon} />
        <Text
          style={[
            { color: color || theme.text, ...Typography.getTextVariantStyle('body') },
            styles.menuItemLabel,
            { textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 100,
  },
  topPill: {
    borderRadius: 30,
    padding: 16,
    marginBottom: 16,
  },
  bottomPill: {
    borderRadius: 30,
    paddingVertical: 24,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  profileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSavingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileSavingsRowRTL: {
    flexDirection: 'row-reverse',
  },
  savingsDetails: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  savingsDetailsRTL: {
    direction: 'rtl',
    justifyContent: 'center',
  },
  profileAvatarButton: {
    borderRadius: 30,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  userName: {
    fontSize: 20,
    ...Typography.getTextVariantStyle('bodyStrong'),
    paddingHorizontal: 4,
  },
  guestProfileContent: {
    gap: 12,
    paddingHorizontal: 8,
  },
  guestProfileContentRTL: {
    alignItems: 'flex-start',
  },
  guestProfileBody: {
    fontSize: 14,
    lineHeight: 20,
    ...Typography.getTextVariantStyle('body'),
  },
  guestProfileActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  guestProfileActionsRTL: {
    flexDirection: 'row-reverse',
  },
  guestPrimaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestSecondaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestPrimaryActionText: {
    fontSize: 14,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  guestSecondaryActionText: {
    fontSize: 14,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  savingsCard: {
    borderRadius: 32,
    padding: 0,
    marginBottom: 16,
  },
  savingsInline: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    lineHeight: 30,
  },
  savingsInlineRTL: {
    flexDirection: 'row-reverse',
  },
  savingsValueText: {
    flexShrink: 1,
    fontSize: 24,
    lineHeight: 32,
  },
  menuContainer: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemLabel: {
    fontSize: 16,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  logoutPill: {
    borderRadius: 30,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
  },
});
