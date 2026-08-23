import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import {
  Check,
  ChevronDown,
  Gift,
  Mail,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Camera,
  Moon,
  Sun,
  Monitor,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppHeader, PrimaryButton, Screen } from "@/components/ui";
import type { AccountSection } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { sendFeedback } from "@/lib/backend";
import { useProfile } from "@/lib/profile";
import { C, dynamicStyles, F, shadow, type ThemePreference, useAppTheme } from "@/lib/theme";
const titles: Record<AccountSection, [string, string, string]> = {
  personal: [
    "YOUR ACCOUNT",
    "Personal details",
    "Keep the basics current so offers and applications stay relevant.",
  ],
  savings: [
    "YOUR IMPACT",
    "Savings history",
    "A clear record of every Kouponly saving and redemption.",
  ],
  earnings: [
    "CREATOR WALLET",
    "Your earnings",
    "Track every UGC payment from approved brief to bank transfer.",
  ],
  membership: [
    "YOUR ACCESS",
    "Membership",
    "See your current pass and the benefits you can use.",
  ],
  gifts: [
    "SEND SOME GOOD",
    "Gift Kouponly",
    "Send a plan to a friend or accept one waiting for you.",
  ],
  settings: [
    "MAKE IT YOURS",
    "Settings",
    "Choose your city, language and notification preferences.",
  ],
  help: [
    "WE’RE HERE",
    "Help & support",
    "Get a quick answer or contact the Kouponly team.",
  ],
  feedback: [
    "TELL US STRAIGHT",
    "Share feedback",
    "What should Kouponly improve next?",
  ],
  legal: [
    "THE IMPORTANT STUFF",
    "Terms & privacy",
    "Plain-language information about your account and data.",
  ],
};
export default function AccountPage() {
  const { section } = useLocalSearchParams<{ section: AccountSection }>();
  const { user, updatePassword, deleteAccount } = useAuth();
  const account = useProfile();
  const page = (titles[section] ? section : "personal") as AccountSection;
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: account.profile.full_name,
    email: account.profile.email,
    mobile: account.profile.mobile,
    city: account.profile.city,
  });
  const [alerts, setAlerts] = useState(account.preferences.offer_alerts);
  const [creator, setCreator] = useState(account.preferences.creator_updates);
  const [location, setLocation] = useState(account.preferences.location);
  const [language, setLanguage] = useState(account.preferences.language);
  const [securityPassword,setSecurityPassword]=useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const [giftTo, setGiftTo] = useState("");
  const [giftTab, setGiftTab] = useState<"Received" | "Sent">("Received");
  const [giftComposer, setGiftComposer] = useState(false);
  const { state, notify, acceptGift, sendGift } = useStore();
  const theme = useAppTheme();
  useEffect(()=>{if(!editing)setProfile({name:account.profile.full_name,email:account.profile.email,mobile:account.profile.mobile,city:account.profile.city})},[account.profile,editing]);
  const savePrefs=(next:Partial<typeof account.preferences>)=>void account.savePreferences({...account.preferences,...next}).catch(()=>notify("Preference saved locally; cloud retry needed."));
  const [eye, title, copy] = titles[page];
  return (
    <Screen testID={`account-${page}`} includeTopInset>
      <AppHeader eyebrow={eye} title={title} back />
      <Text style={s.intro}>{copy}</Text>
      <Content
        page={page}
        state={state}
        editing={editing}
        setEditing={setEditing}
        profile={profile}
        setProfile={setProfile}
        alerts={alerts}
        setAlerts={setAlerts}
        creator={creator}
        setCreator={setCreator}
        location={location}
        setLocation={setLocation}
        language={language}
        setLanguage={setLanguage}
        open={open}
        setOpen={setOpen}
        feedback={feedback}
        setFeedback={setFeedback}
        sent={sent}
        setSent={setSent}
        giftTo={giftTo}
        setGiftTo={setGiftTo}
        giftTab={giftTab}
        setGiftTab={setGiftTab}
        giftComposer={giftComposer}
        setGiftComposer={setGiftComposer}
        acceptGift={acceptGift}
        sendGift={sendGift}
        notify={notify}
        signedIn={!!user}
        avatarUrl={account.avatarUrl}
        avatarPath={account.profile.avatar_path}
        avatarUploading={account.uploading}
        chooseAvatar={()=>void account.chooseAvatar().catch(error=>notify(error instanceof Error?error.message:"Photo upload failed"))}
        saveProfile={account.saveProfile}
        savePrefs={savePrefs}
        securityPassword={securityPassword}
        setSecurityPassword={setSecurityPassword}
        updatePassword={updatePassword}
        deleteAccount={deleteAccount}
        themePreference={theme.preference}
        setThemePreference={theme.setPreference}
      />
    </Screen>
  );
}

function Content(p: any) {
  if (p.page === "personal")
    return (
      <View style={s.card}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" disabled={p.avatarUploading} onPress={p.chooseAvatar} style={s.avatarPicker}>{p.avatarUrl?<Image source={{uri:p.avatarUrl}} style={s.avatarImage}/>:<View style={s.avatarFallback}><Camera size={24}/></View>}<Text style={s.avatarAction}>{p.avatarUploading?"Uploading…":"Change profile photo"}</Text></Pressable>
        {Object.entries(p.profile).map(([key, value]) => (
          <View key={key} style={s.field}>
            <Text style={s.label}>{key.toUpperCase()}</Text>
            {p.editing ? (
              <TextInput
                value={value as string}
                onChangeText={(v) => p.setProfile({ ...p.profile, [key]: v })}
                style={s.input}
              />
            ) : (
              <Text style={s.value}>{value as string}</Text>
            )}
          </View>
        ))}
        <PrimaryButton
          label={p.editing ? "Save changes" : "Edit profile"}
          onPress={() => {
            p.setEditing(!p.editing);
            if (p.editing) {
              if (p.signedIn)
                void p.saveProfile({
                  full_name: p.profile.name,
                  email: p.profile.email,
                  city: p.profile.city,
                  mobile:p.profile.mobile,
                  avatar_path:p.avatarPath??null,
                }).catch(() =>
                  p.notify("Saved locally. Cloud sync will retry."),
                );
              p.notify(
                p.signedIn ? "Profile updated" : "Profile updated in demo mode",
              );
            }
          }}
        />
      </View>
    );
  if (p.page === "savings")
    return (
      <>
        <View style={s.metric}>
          <Text style={s.metricValue}>₹2,400</Text>
          <Text style={s.metricLabel}>TOTAL SAVED</Text>
        </View>
        {[
          ["Starbucks", "₹320", "Today"],
          ["Paragon Restaurant", "₹480", "Last week"],
          ["PVR Cinemas", "₹350", "12 Jul"],
        ].map((x) => (
          <Row key={x[0]} title={x[0]} note={x[2]} value={x[1]} />
        ))}
      </>
    );
  if (p.page === "earnings")
    return (
      <>
        <View style={[s.metric, { backgroundColor: C.ink }]}>
          <Text style={[s.metricValue, { color: C.lime }]}>₹12,500</Text>
          <Text style={[s.metricLabel, { color: "white" }]}>
            TOTAL EARNED · NEXT PAYOUT ₹6,000
          </Text>
        </View>
        {[
          ["Paragon dinner reel", "Paid to bank · 28 Jul", "+₹4,500"],
          ["Nykaa beauty unboxing", "Approved · processing", "₹6,000"],
          ["Kochi Marriott pool story", "Paid to bank · 12 Jul", "+₹8,000"],
        ].map((x) => (
          <Row key={x[0]} title={x[0]} note={x[1]} value={x[2]} />
        ))}
      </>
    );
  if (p.page === "membership")
    return (
      <>
        <View style={s.member}>
          <ShieldCheck size={34} />
          <Text style={s.memberTitle}>KOUPONLY MEMBER</Text>
          <Text style={s.memberName}>Neil Jose Pillard</Text>
          <Text style={s.memberId}>KPN · 2026 · 00482</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Your benefits</Text>
          {[
            "Member prices at participating partners",
            "Access to student-only drops",
            "Earn points on completed offers",
            "Creator and campus opportunities",
          ].map((x) => (
            <View style={s.check} key={x}>
              <Check size={16} />
              <Text>{x}</Text>
            </View>
          ))}
        </View>
      </>
    );
  if (p.page === "gifts") {
    const accepted = p.state.acceptedGifts.includes("starbucks-two");
    return (
      <>
        <View style={s.giftTabs}>
          {(["Received", "Sent"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                p.setGiftTab(tab);
                p.setGiftComposer(false);
              }}
              style={[s.giftTab, p.giftTab === tab && s.giftTabActive]}
            >
              <Text style={s.rowTitle}>{tab}</Text>
            </Pressable>
          ))}
        </View>
        {p.giftTab === "Received" ? (
          <View style={s.card}>
            <Gift size={30} />
            <Text style={s.label}>FROM ANU</Text>
            <Text style={s.cardTitle}>Coffee for two at Starbucks</Text>
            <Text style={s.intro}>
              {accepted ? "Saved and ready to use" : "Use before 12 August"}
            </Text>
            <PrimaryButton
              disabled={accepted}
              label={accepted ? "Accepted" : "Accept gift"}
              onPress={() => {
                p.acceptGift("starbucks-two");
                p.notify("Gift added to Saved");
              }}
            />
          </View>
        ) : (
          <>
            {p.state.sentGifts.map((gift: any) => (
              <Row
                key={gift.sentAt}
                title={gift.offer}
                note={`Sent to ${gift.recipient} · just now`}
                value="Sent"
              />
            ))}
            <Row
              title="PVR tickets for two"
              note="Sent to Maya · accepted 30 July"
              value="Accepted"
            />
          </>
        )}
        {p.giftComposer ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Send a gift</Text>
            <Text style={s.label}>SAVED OFFER</Text>
            <Text style={s.value}>Starbucks coffee for two</Text>
            <TextInput
              placeholder="Recipient mobile"
              keyboardType="phone-pad"
              value={p.giftTo}
              onChangeText={p.setGiftTo}
              style={s.input}
            />
            <PrimaryButton
              disabled={!p.giftTo.trim()}
              label="Create & send claim link"
              onPress={() => {
                p.sendGift("Starbucks coffee for two", p.giftTo);
                p.setGiftTo("");
                p.setGiftComposer(false);
                p.setGiftTab("Sent");
                p.notify("Gift claim link sent");
              }}
            />
          </View>
        ) : (
          <PrimaryButton
            label="Send a gift"
            onPress={() => p.setGiftComposer(true)}
          />
        )}
      </>
    );
  }
  if (p.page === "settings")
    return (
      <>
        <View style={s.card}>
          <Setting label="Offer alerts" value={p.alerts} set={(value:boolean)=>{p.setAlerts(value);p.savePrefs({offer_alerts:value})}} />
          <Setting
            label="Creator updates"
            value={p.creator}
            set={(value:boolean)=>{p.setCreator(value);p.savePrefs({creator_updates:value})}}
          />
        </View>
        <Text style={s.subheading}>APPEARANCE</Text>
        <View style={s.options} accessibilityRole="radiogroup">
          {([
            ["system", "System", Monitor],
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
          ] as const).map(([value, label, Icon]) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: p.themePreference === value }}
              onPress={() => p.setThemePreference(value as ThemePreference)}
              style={[s.option, p.themePreference === value && s.optionActive]}
            >
              <Icon size={15} />
              <Text style={s.optionText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.subheading}>LOCATION</Text>
        <View style={s.options}>
          {["Kochi", "Thiruvananthapuram", "Kozhikode"].map((x) => (
            <Pressable
              key={x}
              onPress={() => {p.setLocation(x);p.savePrefs({location:x})}}
              style={[s.option, p.location === x && s.optionActive]}
            >
              <Text style={s.optionText}>{x}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.subheading}>LANGUAGE</Text>
        <View style={s.options}>
          {["English", "Malayalam"].map((x) => (
            <Pressable
              key={x}
              onPress={() => {p.setLanguage(x);p.savePrefs({language:x})}}
              style={[s.option, p.language === x && s.optionActive]}
            >
              <Text style={s.optionText}>{x}</Text>
            </Pressable>
          ))}
        </View>
        {p.signedIn?<View style={s.card}><Text style={s.cardTitle}>Account security</Text><TextInput secureTextEntry autoComplete="new-password" value={p.securityPassword} onChangeText={p.setSecurityPassword} placeholder="New password" style={s.input}/><PrimaryButton disabled={p.securityPassword.length<6} label="Update password" onPress={async()=>{const result=await p.updatePassword(p.securityPassword);p.notify(result.error??"Password updated");if(!result.error)p.setSecurityPassword("")}}/><Pressable accessibilityRole="button" onPress={()=>Alert.alert("Delete Kouponly account?","This permanently removes your cloud profile, uploads and activity. Your guest demo data stays on this device.",[{text:"Cancel",style:"cancel"},{text:"Delete account",style:"destructive",onPress:()=>void p.deleteAccount().then((result:any)=>p.notify(result.error??"Account deleted"))}])} style={s.deleteButton}><Text style={s.deleteText}>Delete account</Text></Pressable></View>:null}
      </>
    );
  if (p.page === "help")
    return (
      <>
        <View style={s.helpRow}>
          <Pressable
            onPress={() => Linking.openURL("tel:+919999999999")}
            style={[s.help, { backgroundColor: C.lime }]}
          >
            <Phone size={23} />
            <Text style={s.helpTitle}>Call support</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL("mailto:hello@kouponly.com")}
            style={[s.help, { backgroundColor: C.ink }]}
          >
            <Mail size={23} color="white" />
            <Text style={[s.helpTitle, { color: "white" }]}>Email us</Text>
          </Pressable>
        </View>
        <Text style={s.subheading}>COMMON QUESTIONS</Text>
        {[
          "How do I redeem an offer?",
          "Why did my code expire?",
          "How do creator payments work?",
        ].map((x) => (
          <Accordion
            key={x}
            id={x}
            open={p.open}
            setOpen={p.setOpen}
            title={x}
            body="Open the relevant offer, follow the redemption instructions and ask support if the partner needs help."
          />
        ))}
      </>
    );
  if (p.page === "feedback")
    return p.sent ? (
      <View style={s.success}>
        <Check size={30} />
        <Text style={s.cardTitle}>Thank you for being honest</Text>
        <Text style={s.intro}>
          {p.signedIn
            ? "Your feedback was sent securely."
            : "Your feedback is stored in this demo session."}
        </Text>
      </View>
    ) : (
      <View style={s.card}>
        <MessageCircle size={30} />
        <Text style={s.cardTitle}>What should we improve?</Text>
        <TextInput
          multiline
          value={p.feedback}
          onChangeText={p.setFeedback}
          placeholder="Tell us what worked and what didn’t…"
          style={[s.input, { height: 140, textAlignVertical: "top" }]}
        />
        <PrimaryButton
          disabled={p.feedback.trim().length < 5}
          label="Send feedback"
          onPress={() => {
            p.setSent(true);
            if (p.signedIn)
              void sendFeedback(p.feedback).catch(() =>
                p.notify("Could not send feedback. Please try again."),
              );
          }}
        />
      </View>
    );
  return (
    <>
      {[
        ["Terms of use", "How Kouponly offers and memberships work."],
        [
          "Privacy policy",
          "What stays on your device and what a future service may collect.",
        ],
        ["Redemption rules", "Partner PIN, expiry and fair-use guidance."],
        [
          "Creator terms",
          "Campaign approval, delivery and payment expectations.",
        ],
      ].map(([title, body]) => (
        <Accordion
          key={title}
          id={title}
          open={p.open}
          setOpen={p.setOpen}
          title={title}
          body={body}
        />
      ))}
    </>
  );
}
function Row({
  title,
  note,
  value,
}: {
  title: string;
  note: string;
  value: string;
}) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowNote}>{note}</Text>
      </View>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}
function Setting({
  label,
  value,
  set,
}: {
  label: string;
  value: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <View style={s.setting}>
      <Text style={s.rowTitle}>{label}</Text>
      <Switch
        value={value}
        onValueChange={set}
        trackColor={{ true: C.lime }}
        thumbColor={C.ink}
      />
    </View>
  );
}
function Accordion({
  id,
  open,
  setOpen,
  title,
  body,
}: {
  id: string;
  open: string | null;
  setOpen: (id: string | null) => void;
  title: string;
  body: string;
}) {
  const active = open === id;
  return (
    <View style={s.accordion}>
      <Pressable
        onPress={() => setOpen(active ? null : id)}
        style={s.accordionHead}
      >
        <Text style={s.rowTitle}>{title}</Text>
        <ChevronDown
          size={18}
          style={{ transform: [{ rotate: active ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {active ? <Text style={s.accordionBody}>{body}</Text> : null}
    </View>
  );
}
const s = dynamicStyles(() => StyleSheet.create({
  intro: {
    fontFamily: F.body,
    fontSize: 11,
    lineHeight: 18,
    color: C.muted,
    marginTop: -8,
    marginBottom: 18,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 23,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 14,
    ...shadow,
  },
  avatarPicker:{minHeight:76,flexDirection:"row",alignItems:"center",gap:12,marginBottom:18},
  avatarImage:{width:64,height:64,borderRadius:22},
  avatarFallback:{width:64,height:64,borderRadius:22,backgroundColor:C.soft,alignItems:"center",justifyContent:"center"},
  avatarAction:{fontFamily:F.bodyBold,fontSize:13,color:C.ink},
  deleteButton:{minHeight:48,alignItems:"center",justifyContent:"center",marginTop:10},
  deleteText:{fontFamily:F.bodyBold,fontSize:13,color:C.danger},
  field: { marginBottom: 15 },
  label: {
    fontFamily: F.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: C.muted,
  },
  value: { fontFamily: F.bodySemi, fontSize: 12, marginTop: 5 },
  input: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    fontFamily: F.body,
    marginTop: 7,
    marginBottom: 12,
  },
  metric: {
    borderRadius: 25,
    backgroundColor: C.lime,
    padding: 23,
    alignItems: "center",
    marginBottom: 16,
  },
  metricValue: { fontFamily: F.heading, fontSize: 37 },
  metricLabel: {
    fontFamily: F.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 3,
  },
  row: {
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: C.card,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  rowTitle: { fontFamily: F.bodyBold, fontSize: 11 },
  rowNote: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 4 },
  rowValue: { fontFamily: F.headingSemi, fontSize: 15 },
  member: {
    minHeight: 230,
    borderRadius: 28,
    backgroundColor: C.lime,
    padding: 22,
    justifyContent: "flex-end",
    ...shadow,
  },
  memberTitle: {
    fontFamily: F.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    marginTop: 35,
  },
  memberName: { fontFamily: F.heading, fontSize: 25, marginTop: 5 },
  memberId: { fontFamily: F.bodyBold, fontSize: 12, marginTop: 8 },
  cardTitle: { fontFamily: F.headingSemi, fontSize: 18, marginVertical: 11 },
  check: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    paddingVertical: 8,
  },
  giftTabs: {
    height: 46,
    borderRadius: 15,
    backgroundColor: C.soft,
    padding: 4,
    flexDirection: "row",
    marginBottom: 14,
  },
  giftTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  giftTabActive: { backgroundColor: C.card },
  setting: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  subheading: {
    fontFamily: F.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 13,
    marginBottom: 9,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 },
  option: {
    minHeight: 38,
    borderRadius: 13,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  optionActive: { backgroundColor: C.lime, borderColor: C.ink },
  optionText: { fontFamily: F.bodyBold, fontSize: 12 },
  helpRow: { flexDirection: "row", gap: 9, marginBottom: 20 },
  help: {
    flex: 1,
    minHeight: 112,
    borderRadius: 21,
    padding: 14,
    justifyContent: "space-between",
  },
  helpTitle: { fontFamily: F.headingSemi, fontSize: 15 },
  accordion: { borderTopWidth: 1, borderTopColor: C.line },
  accordionHead: {
    minHeight: 61,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accordionBody: {
    fontFamily: F.body,
    fontSize: 12,
    lineHeight: 15,
    color: C.muted,
    backgroundColor: C.soft,
    borderRadius: 13,
    padding: 12,
    marginBottom: 10,
  },
  success: {
    alignItems: "center",
    padding: 40,
    backgroundColor: C.lime,
    borderRadius: 25,
  },
}));
