import { router } from "expo-router";
import {
  BadgePercent,
  Bell,
  BriefcaseBusiness,
  CakeSlice,
  CalendarDays,
  ChefHat,
  ChevronRight,
  Clapperboard,
  Compass,
  CookingPot,
  CupSoda,
  Dumbbell,
  EggFried,
  Gift,
  GraduationCap,
  Heart,
  HelpCircle,
  Laptop,
  Map,
  Menu,
  Phone,
  Plane,
  Popcorn,
  Rocket,
  Salad,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  WalletCards,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AccessiblePressable,
  DealCard,
  GlassSurface,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { categories, deals, heroSlides } from "@/lib/data";
import { useStore } from "@/lib/store";
import { F, shadow, type ThemeColors, useAppTheme } from "@/lib/theme";

type Mode = "save" | "play" | "grow";
const categoryIcons: any = {
  CookingPot,
  Popcorn,
  CupSoda,
  CakeSlice,
  ChefHat,
  Salad,
  EggFried,
  UtensilsCrossed,
  Sparkles,
  Dumbbell,
  Compass,
  CalendarDays,
  Store,
  Clapperboard,
  Plane,
  GraduationCap,
  Laptop,
  BriefcaseBusiness,
  ShoppingBag,
};
const growPaths = [
  {
    label: "UGC Creator",
    note: "Paid brand campaigns",
    track: "creator",
    Icon: Clapperboard,
  },
  {
    label: "BD & Sales",
    note: "Paid internship",
    track: "bd",
    Icon: BriefcaseBusiness,
  },
  {
    label: "Marketing",
    note: "Paid internship",
    track: "marketing",
    Icon: Sparkles,
  },
  {
    label: "Campus",
    note: "Ambassador + Gold Card",
    track: "campus",
    Icon: GraduationCap,
  },
] as const;
const growOpportunities = [
  {
    type: "LEARN",
    title: "Build your first portfolio",
    note: "Free · 35 min",
    Icon: GraduationCap,
  },
  {
    type: "INTERNSHIP",
    title: "Junior product design intern",
    note: "Kochi · Paid · 3 months",
    Icon: BriefcaseBusiness,
  },
  {
    type: "FREELANCE",
    title: "Shoot 5 social videos",
    note: "Remote · ₹6,000",
    Icon: Clapperboard,
  },
  {
    type: "PART-TIME",
    title: "Weekend community host",
    note: "Marine Drive · ₹350/hr",
    Icon: Rocket,
  },
] as const;
export default function HomeScreen() {
  const theme = useAppTheme();
  const { colors: C } = theme;
  const s = useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const [mode, setMode] = useState<Mode>("save");
  const [hero, setHero] = useState(0);
  const [menu, setMenu] = useState(false);
  const [paths, setPaths] = useState(false);
  const { notify } = useStore();
  useEffect(() => {
    const timer = setInterval(
      () => setHero((i) => (i + 1) % heroSlides.length),
      5000,
    );
    return () => clearInterval(timer);
  }, []);
  const shown = useMemo(
    () =>
      mode === "save"
        ? categories.slice(0, 8)
        : mode === "play"
          ? [categories[10], categories[11], categories[13], categories[14]]
          : [
              ...categories.slice(15),
              { name: "Jobs", search: "job", icon: "BriefcaseBusiness" },
            ],
    [mode],
  );
  const active = heroSlides[hero];
  return (
    <>
      <Screen testID="home-screen">
        <GlassSurface style={s.header} intensity={70}>
          <View style={s.identity}>
            <AccessiblePressable
              testID="account-menu"
              accessibilityLabel="Open account menu"
              onPress={() => setMenu(true)}
              style={s.menu}
            >
              <Menu size={21} color={C.ink} />
            </AccessiblePressable>
            <View>
              <Text style={s.micro}>Hey Neil</Text>
              <Text accessibilityRole="header" style={s.title}>
                What’s the plan?
              </Text>
            </View>
          </View>
          <AccessiblePressable
            accessibilityLabel="Notifications"
            onPress={() => notify("You’re all caught up")}
            style={s.menu}
          >
            <Bell size={20} color={C.ink} />
            <View style={s.notification} />
          </AccessiblePressable>
        </GlassSurface>
        <AccessiblePressable
          testID="home-search"
          accessibilityLabel="Search deals, events, skills or jobs"
          onPress={() => router.push("/(tabs)/search")}
          style={s.search}
        >
          <Search size={20} color={C.ink} />
          <Text style={s.searchText}>Search deals, events, skills or jobs</Text>
          <Settings size={18} color={C.ink} />
        </AccessiblePressable>
        <Text style={s.pickerLabel}>Today I want to…</Text>
        <View style={s.modeRow}>
          {[
            ["save", "Save", "Deals & offers", WalletCards],
            ["play", "Go out", "Book & explore", Sparkles],
            ["grow", "Grow", "Learn & earn", Rocket],
          ].map(([id, label, note, Icon]) => (
            <Pressable
              key={id as string}
              testID={`${id}-mode`}
              onPress={() => {
                setMode(id as Mode);
                setPaths(false);
              }}
              style={[s.modeButton, mode === id && s.modeActive]}
            >
              <Icon color={mode === id ? C.inkOnAccent : C.ink} size={18} />
              <View>
                <Text style={[s.modeTitle, mode === id && s.onAccent]}>
                  {label as string}
                </Text>
                <Text style={[s.modeNote, mode === id && s.onAccentMuted]}>
                  {note as string}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        {mode === "save" ? (
          <View style={s.hero}>
            <View style={s.heroCopy}>
              <Text style={s.heroKicker}>{active.kicker}</Text>
              <Text style={s.heroTitle}>{active.title}</Text>
              <Text style={s.heroBody}>{active.copy}</Text>
              <Pressable
                testID="hero-cta"
                onPress={() => router.push(`/deal/${active.dealId}`)}
                style={s.heroButton}
              >
                <Text style={s.heroButtonText}>{active.cta}</Text>
                <ChevronRight color={C.inkOnAccent} size={16} />
              </Pressable>
            </View>
            <Image source={{ uri: active.image }} style={s.heroImage} />
            <View style={s.dots}>
              {heroSlides.map((_, i) => (
                <Pressable
                  accessibilityLabel={`Show slide ${i + 1}`}
                  key={i}
                  onPress={() => setHero(i)}
                  style={[s.dot, i === hero && s.dotActive]}
                />
              ))}
            </View>
          </View>
        ) : mode === "play" ? (
          <View style={[s.modeHero, { backgroundColor: "#161616" }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroKicker}>WEEKEND MODE</Text>
              <Text style={s.heroTitle}>Your next story starts outside.</Text>
              <Text style={s.heroBody}>
                Book something fun in under a minute.
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/search",
                    params: { q: "experience" },
                  })
                }
                style={s.heroButton}
              >
                <Text style={s.heroButtonText}>Find an experience</Text>
                <ChevronRight color={C.inkOnAccent} size={16} />
              </Pressable>
            </View>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=600&q=88",
              }}
              style={s.modeHeroImage}
            />
          </View>
        ) : (
          <>
            <View style={[s.modeHero, s.growHero, { backgroundColor: C.ink }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroKicker}>WORK WITH KOUPONLY</Text>
                <Text style={s.heroTitle}>
                  Your talent. Real briefs. Real experience.
                </Text>
                <Text style={s.heroBody}>
                  Join paid creator campaigns, internships or lead Kouponly on
                  your campus.
                </Text>
                <Pressable
                  testID="grow-open-paths"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: paths }}
                  onPress={() => setPaths(!paths)}
                  style={s.heroButton}
                >
                  <Text style={s.heroButtonText}>
                    {paths ? "Hide paths" : "See open paths"}
                  </Text>
                  <ChevronRight color={C.inkOnAccent} size={16} />
                </Pressable>
              </View>
              <View accessibilityElementsHidden style={s.growOrbit}>
                <Clapperboard size={29} color={C.ink} />
                <BriefcaseBusiness size={24} color={C.ink} />
                <GraduationCap size={21} color={C.ink} />
              </View>
            </View>
            {paths ? (
              <View
                testID="grow-paths"
                accessibilityLabel="Kouponly career paths"
                style={s.pathReveal}
              >
                <View style={s.pathRevealHead}>
                  <View>
                    <Text style={s.pathEyebrow}>START WITH US</Text>
                    <Text style={s.pathHeading}>Pick your Kouponly path</Text>
                    <Text style={s.pathCopy}>
                      Built for students and early-career talent in Kerala.
                    </Text>
                  </View>
                  <Pressable
                    testID="grow-close-paths"
                    accessibilityLabel="Close Kouponly paths"
                    onPress={() => setPaths(false)}
                    style={s.pathClose}
                  >
                    <X size={18} color={C.ink} />
                  </Pressable>
                </View>
                <View style={s.pathGrid}>
                  {growPaths.map(({ label, note, track, Icon }) => (
                    <Pressable
                      testID={`grow-path-${track}`}
                      key={track}
                      accessibilityLabel={`${label}. ${note}`}
                      onPress={() =>
                        router.push({ pathname: "/work", params: { track } })
                      }
                      style={s.path}
                    >
                      <View style={s.pathIcon}>
                        <Icon size={18} color={C.lime} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.pathText}>{label}</Text>
                        <Text style={s.pathNote}>{note}</Text>
                      </View>
                      <ChevronRight size={15} color={C.muted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
        <SectionTitle
          eyebrow={
            mode === "save"
              ? "SAVE YOUR WAY"
              : mode === "play"
                ? "MAKE A PLAN"
                : "BUILD YOUR FUTURE"
          }
          title={
            mode === "save"
              ? "Browse categories"
              : mode === "play"
                ? "What feels fun?"
                : "Choose your next step"
          }
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categories}
        >
          {shown.map((c) => {
            const Icon = categoryIcons[c.icon] ?? ShoppingBag;
            return (
              <Pressable
                testID={`category-${c.search}`}
                key={c.name}
                onPress={() =>
                  router.push(
                    `/category/${c.name.toLowerCase().replace(/\s+/g, "-")}`,
                  )
                }
              >
                <View style={s.categoryIcon}>
                  <Icon size={31} />
                  <Text style={s.categoryInIcon}>{c.name}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {mode === "save" ? (
          <>
            <SectionTitle
              eyebrow="BRANDS YOU KNOW"
              title="Popular partners"
              action="All partners"
              onAction={() =>
                router.push({
                  pathname: "/(tabs)/search",
                  params: { q: "partner" },
                })
              }
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.vendors}
            >
              {deals.slice(0, 12).map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => router.push(`/deal/${d.id}`)}
                  style={s.vendor}
                >
                  <View style={s.vendorLogo}>
                    {d.logo ? (
                      <Image source={{ uri: d.logo }} style={s.logo} />
                    ) : (
                      <Text style={s.logoLetter}>{d.name[0]}</Text>
                    )}
                  </View>
                  <Text style={s.vendorName} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text style={s.vendorSave}>{d.saving}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <SectionTitle
              eyebrow="GOOD STUFF, CLOSE BY"
              title="Top picks near you"
              action="See all"
              onAction={() => router.push("/(tabs)/search")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.cards}
            >
              {deals.map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </ScrollView>
            <SectionTitle
              eyebrow="READY WHEN YOU ARE"
              title="Use it again"
              action="My offers"
              onAction={() => router.push("/(tabs)/saved")}
            />
            <Pressable onPress={() => router.push("/deal/2")} style={s.repeat}>
              <View style={s.repeatLogo}>
                <Text>S</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>STARBUCKS · PANAMPILLY NAGAR</Text>
                <Text style={s.repeatTitle}>Buy 1 coffee, get 1 free</Text>
                <Text style={s.vendorSave}>Save ₹320</Text>
              </View>
              <View style={s.gift}>
                <Gift size={20} />
              </View>
            </Pressable>
            <SectionTitle
              eyebrow="FOR STUDENT LIFE"
              title="Exclusive student deals"
              action="See all"
              onAction={() =>
                router.push({
                  pathname: "/(tabs)/search",
                  params: { q: "student" },
                })
              }
            />
            <View style={s.miniDeals}>
              {[deals[1], deals[11], deals[8]].map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => router.push(`/deal/${d.id}`)}
                  style={s.miniDeal}
                >
                  <Image source={{ uri: d.image }} style={s.miniImage} />
                  <Text style={s.miniTitle}>{d.name}</Text>
                  <Text style={s.vendorSave}>{d.saving}</Text>
                </Pressable>
              ))}
            </View>
            <SectionTitle
              eyebrow="QUICK BITES, TINY PRICES"
              title="Meals under ₹100"
              action="See all"
              onAction={() =>
                router.push({
                  pathname: "/(tabs)/search",
                  params: { q: "meals under 100" },
                })
              }
            />
            <View style={s.miniDeals}>
              {[
                [deals[0], "Mini Kerala meals", "₹99"],
                [deals[14], "Crispy snack box", "₹89"],
                [deals[3], "Burger & lime", "₹99"],
              ].map(([d, n, p]: any) => (
                <Pressable
                  key={n}
                  onPress={() => router.push(`/deal/${d.id}`)}
                  style={s.miniDeal}
                >
                  <Image source={{ uri: d.image }} style={s.miniImage} />
                  <Text style={s.miniTitle}>{n}</Text>
                  <Text style={s.vendorSave}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <SectionTitle eyebrow="THE CROWD KNOWS" title="Popular this week" />
            {deals.slice(1, 4).map((d) => (
              <DealCard key={d.id} deal={d} compact />
            ))}
          </>
        ) : mode === "play" ? (
          <>
            <SectionTitle
              eyebrow="KERALA, THIS WEEK"
              title="Go do something fun"
            />
            {deals
              .filter((d) =>
                ["Staycations", "Entertainment", "Things to do"].includes(
                  d.category,
                ),
              )
              .map((d) => (
                <DealCard key={d.id} deal={d} compact />
              ))}
            <Pressable onPress={() => router.push("/rewards")} style={s.win}>
              <Gift size={25} />
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>REDEEM POINTS</Text>
                <Text style={s.repeatTitle}>Turn points into good stuff</Text>
              </View>
              <ChevronRight size={18} />
            </Pressable>
          </>
        ) : (
          <>
            <SectionTitle
              eyebrow="MORE WAYS TO GROW"
              title="Learn, freelance or find work"
              action="See all"
              onAction={() =>
                router.push({
                  pathname: "/(tabs)/search",
                  params: { q: "opportunity" },
                })
              }
            />
            {growOpportunities.map(({ type, title, note, Icon }) => (
              <Pressable
                testID={`grow-opportunity-${type.toLowerCase()}`}
                key={title}
                accessibilityLabel={`${type}. ${title}. ${note}`}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/search",
                    params: { q: title },
                  })
                }
                style={s.opportunity}
              >
                <View style={s.opportunityIcon}>
                  <Icon size={20} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opportunityType}>{type}</Text>
                  <Text style={s.repeatTitle}>{title}</Text>
                  <Text style={s.modeNote}>{note}</Text>
                </View>
                <ChevronRight size={17} color={C.muted} />
              </Pressable>
            ))}
            <Pressable
              testID="grow-profile-cta"
              accessibilityLabel="Finish your opportunity profile"
              onPress={() => router.push("/(tabs)/me")}
              style={s.progress}
            >
              <Text style={s.progressRing}>62%</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>YOUR OPPORTUNITY PROFILE</Text>
                <Text style={s.repeatTitle}>Two steps from standing out</Text>
                <Text style={s.modeNote}>
                  Add your skills and availability to get better matches.
                </Text>
              </View>
              <ChevronRight size={17} color={C.ink} />
            </Pressable>
          </>
        )}
      </Screen>
      <AccountDrawer open={menu} close={() => setMenu(false)} />
    </>
  );
}

function AccountDrawer({ open, close }: { open: boolean; close: () => void }) {
  const theme = useAppTheme();
  const { colors: C } = theme;
  const s = useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const links = [
    { label: "Savings history", to: "/account/savings", Icon: BadgePercent },
    { label: "Creator earnings", to: "/account/earnings", Icon: WalletCards },
    { label: "Saved offers", to: { pathname: "/(tabs)/saved", params: { segment: "Offers" } }, Icon: Heart },
    { label: "Explore partners", to: "/(tabs)/search", Icon: Store },
    { label: "Map near me", to: "/(tabs)/map", Icon: Map },
    { label: "Work with Kouponly", to: "/work", Icon: Rocket },
    { label: "Help & support", to: "/account/help", Icon: HelpCircle },
    { label: "Settings", to: "/account/settings", Icon: Settings },
  ] as const;
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityLabel="Close account menu"
        onPress={close}
        style={s.backdrop}
      />
      <View style={s.drawer}>
        <View style={s.drawerProfile}>
          <View style={s.avatar}>
            <Text style={{ color: C.ink }}>N</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.repeatTitle}>Neil Jose Pillard</Text>
            <Text style={s.modeNote}>Kochi, Kerala</Text>
          </View>
          <AccessiblePressable
            accessibilityLabel="Close account menu"
            onPress={close}
          >
            <X size={20} color={C.ink} />
          </AccessiblePressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            close();
            router.push("/account/savings");
          }}
          style={s.drawerStats}
        >
          <View>
            <Text style={s.drawerEyebrow}>TOTAL SAVED</Text>
            <Text style={s.stat}>₹2,400</Text>
          </View>
          <View>
            <Text style={s.drawerEyebrow}>EARNED</Text>
            <Text style={s.stat}>₹8,750</Text>
          </View>
          <View>
            <Text style={s.drawerEyebrow}>REWARDS</Text>
            <Text style={s.stat}>680</Text>
          </View>
        </Pressable>
        {links.map(({ label, to, Icon }) => (
          <AccessiblePressable
            accessibilityLabel={label}
            key={label}
            onPress={() => {
              close();
              router.push(to as any);
            }}
            style={s.drawerLink}
          >
            <Icon size={19} color={C.ink} />
            <Text style={s.drawerLinkText}>{label}</Text>
            <ChevronRight size={17} color={C.muted} />
          </AccessiblePressable>
        ))}
        <View style={s.drawerFooterLinks}>
          {[
            ["Feedback", "/account/feedback"],
            ["FAQ", "/account/help"],
            ["Terms & privacy", "/account/legal"],
          ].map(([label, to]) => (
            <AccessiblePressable
              accessibilityLabel={label}
              key={label}
              onPress={() => {
                close();
                router.push(to as any);
              }}
            >
              <Text style={s.drawerFooter}>{label}</Text>
            </AccessiblePressable>
          ))}
        </View>
        <AccessiblePressable
          accessibilityLabel="Call support"
          onPress={() => notifySupport(close)}
          style={s.support}
        >
          <Phone size={18} color={C.ink} />
          <Text style={s.drawerLinkText}>Call support</Text>
        </AccessiblePressable>
      </View>
    </Modal>
  );
}
const notifySupport = (close: () => void) => {
  close();
  router.push("/account/help");
};

const makeStyles = (C: ThemeColors) =>
  StyleSheet.create({
    header: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
      borderRadius: 24,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: C.line,
      overflow: "hidden",
    },
    identity: { flexDirection: "row", alignItems: "center", gap: 11 },
    menu: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: C.glass,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: C.line,
      ...shadow,
    },
    notification: {
      position: "absolute",
      right: 7,
      top: 7,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: C.lime,
      borderWidth: 1,
      borderColor: C.ink,
    },
    micro: { fontFamily: F.bodyBold, fontSize: 12, color: C.muted },
    title: {
      fontFamily: F.heading,
      fontSize: 30,
      letterSpacing: -1.2,
      color: C.ink,
    },
    search: {
      minHeight: 54,
      borderWidth: 2,
      borderColor: C.ink,
      borderRadius: 18,
      backgroundColor: C.input,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 10,
      ...shadow,
    },
    searchText: { fontFamily: F.bodySemi, fontSize: 13, color: C.ink, flex: 1 },
    pickerLabel: {
      fontFamily: F.bodyBold,
      fontSize: 13,
      color: C.ink,
      marginTop: 19,
      marginBottom: 9,
    },
    modeRow: { flexDirection: "row", gap: 7 },
    modeButton: {
      flex: 1,
      minHeight: 68,
      borderRadius: 18,
      backgroundColor: C.soft,
      padding: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: "transparent",
    },
    modeActive: { backgroundColor: C.lime, borderColor: C.ink },
    onAccent: { color: C.inkOnAccent },
    onAccentMuted: { color: "#3A3A3C" },
    modeTitle: { fontFamily: F.bodyBold, fontSize: 12, color: C.ink },
    modeNote: {
      fontFamily: F.body,
      fontSize: 11,
      color: C.muted,
      marginTop: 2,
    },
    hero: {
      minHeight: 250,
      backgroundColor: "#101010",
      borderRadius: 28,
      marginTop: 18,
      overflow: "hidden",
      flexDirection: "row",
      ...shadow,
    },
    heroCopy: { width: "66%", padding: 20, zIndex: 2 },
    heroKicker: {
      alignSelf: "flex-start",
      fontFamily: F.bodyBold,
      color: C.onDark,
      fontSize: 11,
      letterSpacing: 1,
      backgroundColor: "rgba(255,255,255,.13)",
      padding: 7,
      borderRadius: 13,
    },
    heroTitle: {
      fontFamily: F.heading,
      color: C.onDark,
      fontSize: 25,
      lineHeight: 27,
      letterSpacing: -0.8,
      marginTop: 13,
    },
    heroBody: {
      fontFamily: F.body,
      color: C.onDarkMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 7,
    },
    heroButtonText: {
      fontFamily: F.bodySemi,
      fontSize: 13,
      color: C.inkOnAccent,
    },
    heroButton: {
      alignSelf: "flex-start",
      minHeight: 44,
      backgroundColor: C.lime,
      borderRadius: 14,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 11,
    },
    heroImage: {
      position: "absolute",
      right: -25,
      bottom: -12,
      width: 170,
      height: 215,
      borderRadius: 80,
    },
    dots: {
      position: "absolute",
      bottom: 5,
      left: 16,
      flexDirection: "row",
      gap: 1,
    },
    dot: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "transparent",
      borderWidth: 0,
    },
    dotActive: {
      borderBottomWidth: 5,
      borderBottomColor: C.lime,
      borderRadius: 0,
    },
    modeHero: {
      minHeight: 230,
      borderRadius: 28,
      marginTop: 18,
      padding: 20,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      ...shadow,
    },
    modeHeroImage: {
      width: 120,
      height: 180,
      borderRadius: 50,
      marginRight: -45,
    },
    growHero: { minHeight: 250 },
    growOrbit: { width: 76, height: 160, alignItems: "center", justifyContent: "space-between", transform: [{ rotate: "8deg" }] },
    pathReveal: { marginTop: 10, backgroundColor: C.card, borderRadius: 23, borderWidth: 1, borderColor: C.line, padding: 14, ...shadow },
    pathRevealHead: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
    pathEyebrow: { alignSelf: "flex-start", fontFamily: F.bodyBold, fontSize: 10, color: C.ink, backgroundColor: C.lime, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, overflow: "hidden" },
    pathHeading: { fontFamily: F.headingSemi, fontSize: 20, color: C.ink, marginTop: 8 },
    pathCopy: { fontFamily: F.body, fontSize: 12, lineHeight: 16, color: C.muted, marginTop: 4 },
    pathClose: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" },
    pathGrid: { marginTop: 12, gap: 7 },
    path: {
      minHeight: 64,
      borderRadius: 16,
      backgroundColor: C.soft,
      borderWidth: 1,
      borderColor: C.line,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    pathIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
    pathText: { fontFamily: F.bodyBold, fontSize: 13, color: C.ink },
    pathNote: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 2 },
    categories: { gap: 12, paddingRight: 18 },
    categoryIcon: {
      width: 100,
      height: 100,
      borderRadius: 25,
      backgroundColor: C.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryInIcon: {
      fontFamily: F.bodyBold,
      fontSize: 12,
      color: C.ink,
      marginTop: 8,
      textAlign: "center",
    },
    vendors: { gap: 12, paddingRight: 18 },
    vendor: { width: 92, minHeight: 112, alignItems: "center" },
    vendorLogo: {
      width: 70,
      height: 70,
      borderRadius: 23,
      backgroundColor: C.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: C.line,
      ...shadow,
    },
    logo: { width: 40, height: 40, resizeMode: "contain" },
    logoLetter: { fontFamily: F.heading, fontSize: 24, color: C.ink },
    vendorName: {
      fontFamily: F.bodyBold,
      fontSize: 12,
      color: C.ink,
      marginTop: 7,
      width: 90,
      textAlign: "center",
    },
    vendorSave: {
      fontFamily: F.bodyBold,
      fontSize: 11,
      color: C.ink,
      marginTop: 3,
    },
    cards: { gap: 13, paddingRight: 18, paddingBottom: 9 },
    repeat: {
      minHeight: 116,
      borderRadius: 23,
      backgroundColor: C.card,
      borderWidth: 2,
      borderColor: C.line,
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      gap: 12,
      ...shadow,
    },
    repeatLogo: {
      width: 68,
      height: 68,
      borderRadius: 22,
      backgroundColor: C.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    repeatTitle: {
      fontFamily: F.headingSemi,
      fontSize: 16,
      color: C.ink,
      marginVertical: 4,
    },
    eyebrow: {
      fontFamily: F.bodyBold,
      fontSize: 11,
      color: C.ink,
      letterSpacing: 0.7,
    },
    drawerEyebrow: {
      fontFamily: F.bodyBold,
      fontSize: 11,
      color: C.onDarkMuted,
      letterSpacing: 0.7,
    },
    gift: {
      width: 44,
      height: 44,
      borderRadius: 18,
      backgroundColor: C.lime,
      alignItems: "center",
      justifyContent: "center",
    },
    miniDeals: { flexDirection: "row", gap: 8 },
    miniDeal: {
      flex: 1,
      minHeight: 144,
      backgroundColor: C.card,
      borderRadius: 18,
      padding: 7,
      borderWidth: 1,
      borderColor: C.line,
    },
    miniImage: { width: "100%", height: 76, borderRadius: 13 },
    miniTitle: {
      fontFamily: F.headingSemi,
      fontSize: 12,
      color: C.ink,
      marginTop: 7,
    },
    win: {
      minHeight: 96,
      backgroundColor: C.lime,
      borderRadius: 22,
      padding: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 20,
    },
    opportunity: {
      minHeight: 82,
      backgroundColor: C.card,
      borderRadius: 19,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 9,
      borderWidth: 1,
      borderColor: C.line,
    },
    opportunityIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" },
    opportunityType: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 0.8, color: C.muted },
    progress: {
      minHeight: 96,
      borderRadius: 24,
      backgroundColor: C.lime,
      padding: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      marginTop: 18,
    },
    progressRing: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 5,
      borderColor: C.ink,
      color: C.ink,
      textAlign: "center",
      textAlignVertical: "center",
      fontFamily: F.bodyBold,
    },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: C.backdrop },
    drawer: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "88%",
      backgroundColor: C.paper,
      paddingTop: 62,
      paddingHorizontal: 18,
      paddingBottom: 20,
    },
    drawerProfile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 17,
      backgroundColor: C.lime,
      alignItems: "center",
      justifyContent: "center",
    },
    drawerStats: {
      backgroundColor: "#101010",
      borderRadius: 20,
      padding: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    stat: {
      fontFamily: F.headingSemi,
      color: C.lime,
      fontSize: 17,
      marginTop: 4,
    },
    drawerLink: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.line,
    },
    drawerLinkText: {
      fontFamily: F.bodyBold,
      fontSize: 13,
      color: C.ink,
      flex: 1,
    },
    drawerFooterLinks: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    drawerFooter: {
      fontFamily: F.bodyBold,
      fontSize: 11,
      color: C.muted,
      textAlign: "center",
    },
    support: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: C.lime,
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
  });
