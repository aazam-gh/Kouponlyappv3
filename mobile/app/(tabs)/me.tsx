import { router } from "expo-router";
import {
  BadgePercent,
  ChevronRight,
  Gift,
  HelpCircle,
  LogOut,
  MessageCircle,
  Rocket,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react-native";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AccessiblePressable, Screen } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { dynamicStyles, F, shadow, type ThemeColors, useAppTheme } from "@/lib/theme";
import { useProfile } from "@/lib/profile";

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { colors: C } = theme;
  const s = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { state, notify, cloudStatus, retrySync } = useStore();
  const { user, isGuest, signOut } = useAuth();
  const account = useProfile();
  const displayName = user ? account.profile.full_name : "Neil Jose Pillard";
  const displayEmail = user?.email ?? "Demo profile · stored on this device";
  const initials = displayName
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const activeApplications = state.appliedCampaigns.length;
  const availableCampaigns = Math.max(0, 3 - activeApplications);
  const links = [
    {
      id: "personal",
      label: "Personal details",
      note: "Name, email and city",
      Icon: UserRound,
    },
    {
      id: "savings",
      label: "Savings history",
      note: `${state.used.length} redemptions`,
      Icon: BadgePercent,
    },
    {
      id: "earnings",
      label: "Creator earnings",
      note: "₹12,500 earned",
      Icon: WalletCards,
    },
    {
      id: "membership",
      label: "Membership",
      note: "Kouponly member",
      Icon: ShieldCheck,
    },
    {
      id: "gifts",
      label: "Gift Kouponly",
      note: "Send or accept a plan",
      Icon: Gift,
    },
    {
      id: "settings",
      label: "Settings",
      note: "Language and preferences",
      Icon: Settings,
    },
    {
      id: "help",
      label: "Help & support",
      note: "FAQ, chat and call",
      Icon: HelpCircle,
    },
    {
      id: "feedback",
      label: "Share feedback",
      note: "Tell us what to improve",
      Icon: MessageCircle,
    },
    {
      id: "legal",
      label: "Terms & privacy",
      note: "The important stuff",
      Icon: BadgePercent,
    },
  ] as const;
  return (
    <Screen testID="profile-screen">
      <View style={s.hero}>
        <View style={s.avatar}>
          {account.avatarUrl ? <Image source={{ uri: account.avatarUrl }} style={s.avatarPhoto} /> : <Text style={s.avatarText}>{initials}</Text>}
          <View style={s.online} />
        </View>
        <Text style={s.name}>{displayName}</Text>
        <Text style={s.location}>{displayEmail}</Text>
        {!isGuest&&cloudStatus!=="synced"?<AccessiblePressable accessibilityLabel={`Cloud status ${cloudStatus}. Tap to retry.`} onPress={()=>void retrySync()} style={s.syncPill}><Text style={s.syncText}>{cloudStatus==="loading-cloud"?"Loading account…":cloudStatus==="syncing"?"Syncing…":cloudStatus==="offline"?"Offline · tap to retry":"Sync needs attention"}</Text></AccessiblePressable>:null}
        {isGuest ? (
          <AccessiblePressable
            testID="profile-sign-in"
            accessibilityLabel="Sign in to sync your account"
            onPress={() => router.push("/auth" as any)}
            style={s.signIn}
          >
            <Text style={s.signInText}>Sign in to sync</Text>
          </AccessiblePressable>
        ) : null}
        <View style={s.stats}>
          <View>
            <Text style={s.stat}>₹2,400</Text>
            <Text style={s.statLabel}>SAVED THIS MONTH</Text>
          </View>
          <View>
            <Text style={s.stat}>{state.used.length}</Text>
            <Text style={s.statLabel}>OFFERS ENJOYED</Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => router.push("/account/savings")}
        style={s.streak}
      >
        <View style={s.streakNumber}>
          <Text style={s.streakNumberText}>6</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>MONTHLY STREAK</Text>
          <Text style={s.streakTitle}>You’re on a roll</Text>
          <Text style={s.linkNote}>One more saving to beat July.</Text>
        </View>
        <ChevronRight size={18} />
      </Pressable>
      <Pressable
        testID="rewards-card"
        onPress={() => router.push("/rewards")}
        style={s.streak}
      >
        <View style={s.streakIcon}>
          <Gift size={23} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>REWARDS READY</Text>
          <Text style={s.streakTitle}>
            Turn your {state.points} points into a plan
          </Text>
        </View>
        <ChevronRight size={18} />
      </Pressable>
      <View style={s.creatorDashboard}>
        <View style={s.creatorHeading}>
          <View style={s.creatorIcon}><Rocket size={21} color={C.ink} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>CREATOR DASHBOARD</Text>
            <Text style={s.creatorTitle}>Your creator momentum</Text>
          </View>
          <TrendingUp size={21} color={C.ink} />
        </View>
        <View style={s.creatorMetrics}>
          <Metric value="₹12.5K" label="EARNED" />
          <Metric value={String(activeApplications)} label="ACTIVE" />
          <Metric value="₹6K" label="NEXT PAYOUT" />
        </View>
        <Text style={s.creatorNote}>
          {activeApplications
            ? `${activeApplications} application${activeApplications === 1 ? "" : "s"} in progress · keep creating.`
            : availableCampaigns ? `${availableCampaigns} paid campaigns ready for you.` : "Your campaign calendar is full."}
        </Text>
        <View style={s.creatorActions}>
          <AccessiblePressable
            testID="creator-dashboard-earnings"
            accessibilityLabel="View creator earnings"
            accessibilityHint="Opens your earnings and payout history"
            onPress={() => router.push("/account/earnings")}
            style={s.creatorPrimaryAction}
          >
            <WalletCards size={17} color={C.inkOnAccent} />
            <Text style={s.creatorPrimaryText}>Earnings</Text>
          </AccessiblePressable>
          <AccessiblePressable
            testID="creator-dashboard-campaigns"
            accessibilityLabel="Browse creator campaigns"
            accessibilityHint="Opens paid creator opportunities"
            onPress={() => router.push("/work")}
            style={s.creatorSecondaryAction}
          >
            <Text style={s.creatorSecondaryText}>Campaigns</Text>
            <ChevronRight size={17} color={C.ink} />
          </AccessiblePressable>
        </View>
      </View>
      <View style={s.menu}>
        {links.map(({ id, label, note, Icon }) => (
          <AccessiblePressable
            accessibilityLabel={`${label}. ${note}`}
            accessibilityHint="Opens account section"
            key={id}
            onPress={() => router.push(`/account/${id}`)}
            style={s.link}
          >
            <View style={s.linkIcon}>
              <Icon size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.linkTitle}>{label}</Text>
              <Text style={s.linkNote}>{note}</Text>
            </View>
            <ChevronRight size={18} color={C.muted} />
          </AccessiblePressable>
        ))}
      </View>
      <AccessiblePressable
        accessibilityLabel={isGuest ? "Sign in" : "Sign out"}
        haptic="warning"
        onPress={() =>
          isGuest
            ? router.push("/auth" as any)
            : void signOut().then(() =>
                notify("Signed out. Demo data remains on this device."),
              )
        }
        style={s.signout}
      >
        <LogOut size={18} color={C.danger} />
        <Text style={s.signoutText}>{isGuest ? "Sign in" : "Sign out"}</Text>
      </AccessiblePressable>
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  const { colors: C } = useAppTheme();
  return <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontFamily: F.headingSemi, fontSize: 18, color: C.inkOnAccent }}>{value}</Text><Text style={{ fontFamily: F.bodyBold, fontSize: 9, letterSpacing: .7, color: C.inkOnAccent, marginTop: 3 }}>{label}</Text></View>;
}

const makeStyles = (C: ThemeColors) =>
  StyleSheet.create({
    hero: {
      backgroundColor: "#101010",
      borderRadius: 29,
      padding: 22,
      alignItems: "center",
      ...shadow,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 28,
      backgroundColor: C.onDark,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontFamily: F.heading, fontSize: 28, color: C.inkOnAccent },
    avatarPhoto: { width: 80, height: 80, borderRadius: 28 },
    online: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.lime,
      borderWidth: 4,
      borderColor: "#101010",
    },
    name: {
      fontFamily: F.heading,
      color: C.onDark,
      fontSize: 26,
      marginTop: 13,
      textAlign: "center",
    },
    location: {
      fontFamily: F.body,
      color: C.onDarkMuted,
      fontSize: 13,
      marginTop: 4,
    },
    syncPill:{minHeight:44,paddingHorizontal:12,borderRadius:14,backgroundColor:"#2C2C2E",alignItems:"center",justifyContent:"center",marginTop:8},
    syncText:{fontFamily:F.bodyBold,fontSize:11,color:C.lime},
    signIn: {
      minHeight: 44,
      borderRadius: 15,
      backgroundColor: C.lime,
      paddingHorizontal: 18,
      justifyContent: "center",
      marginTop: 14,
    },
    signInText: { fontFamily: F.bodyBold, fontSize: 13, color: C.inkOnAccent },
    stats: {
      alignSelf: "stretch",
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: "#3A3A3C",
    },
    stat: {
      fontFamily: F.headingSemi,
      color: C.lime,
      fontSize: 20,
      textAlign: "center",
    },
    statLabel: {
      fontFamily: F.bodyBold,
      color: C.onDarkMuted,
      fontSize: 11,
      letterSpacing: 0.8,
      marginTop: 4,
      textAlign: "center",
    },
    streak: {
      marginHorizontal: 20,
      marginTop: -1,
      minHeight: 94,
      borderRadius: 21,
      backgroundColor: C.card,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      ...shadow,
    },
    streakNumber: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor: C.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    streakNumberText: { fontFamily: F.heading, color: C.lime, fontSize: 24 },
    streakIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor: C.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrow: {
      fontFamily: F.bodyBold,
      fontSize: 11,
      color: C.ink,
      letterSpacing: 0.8,
    },
    streakTitle: {
      fontFamily: F.headingSemi,
      fontSize: 17,
      color: C.ink,
      marginTop: 4,
    },
    creatorDashboard: {
      borderRadius: 22,
      backgroundColor: C.lime,
      padding: 16,
      marginTop: 18,
    },
    creatorHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
    creatorIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.48)" },
    creatorTitle: { fontFamily: F.headingSemi, fontSize: 18, color: C.ink, marginTop: 3 },
    creatorMetrics: { flexDirection: "row", marginTop: 18, paddingVertical: 13, gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(16,16,16,.16)" },
    creatorNote: { fontFamily: F.body, color: C.ink, fontSize: 12, lineHeight: 17, marginTop: 12 },
    creatorActions: { flexDirection: "row", gap: 9, marginTop: 14 },
    creatorPrimaryAction: { flex: 1, minHeight: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: C.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    creatorPrimaryText: { fontFamily: F.bodyBold, fontSize: 13, color: C.inkOnAccent },
    creatorSecondaryAction: { flex: 1, minHeight: 44, borderRadius: 14, paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,.48)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
    creatorSecondaryText: { fontFamily: F.bodyBold, fontSize: 13, color: C.ink },
    menu: {
      backgroundColor: C.card,
      borderRadius: 23,
      paddingHorizontal: 13,
      marginTop: 18,
      borderWidth: 1,
      borderColor: C.line,
    },
    link: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: C.line,
    },
    linkIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: C.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    linkTitle: { fontFamily: F.bodyBold, fontSize: 14, color: C.ink },
    linkNote: {
      fontFamily: F.body,
      fontSize: 12,
      color: C.muted,
      marginTop: 3,
    },
    signout: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
    },
    signoutText: { fontFamily: F.bodyBold, fontSize: 14, color: C.danger },
  });
