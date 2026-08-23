import { router, useLocalSearchParams } from "expo-router";
import {
  BriefcaseBusiness,
  Check,
  Clapperboard,
  GraduationCap,
  Rocket,
  Sparkles,
  WalletCards,
  ChevronRight,
  ImagePlus,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AccessiblePressable, AppHeader, PrimaryButton, Screen } from "@/components/ui";
import { campaigns, deals } from "@/lib/data";
import { useStore } from "@/lib/store";
import { C, dynamicStyles, F, shadow } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { pickCampaignMedia } from "@/lib/media";
import { removeCampaignAttachment, uploadStorageAsset } from "@/lib/backend";
import type { StorageAsset } from "@/lib/cloud.types";
const tracks = [
  {
    id: "creator",
    label: "UGC Creator",
    note: "Paid brand campaigns",
    Icon: Clapperboard,
  },
  {
    id: "bd",
    label: "BD & Sales",
    note: "Paid internship",
    Icon: BriefcaseBusiness,
  },
  {
    id: "marketing",
    label: "Marketing",
    note: "Paid internship",
    Icon: Sparkles,
  },
  {
    id: "campus",
    label: "Campus",
    note: "Ambassador + Gold Card",
    Icon: GraduationCap,
  },
] as const;
const roles: any = {
  bd: {
    eyebrow: "PAID INTERNSHIP",
    title: "BD & Sales Internship",
    copy: "Help find strong local partners, start conversations and learn how partnerships move from lead to launch.",
    image: deals[5].image,
    points: [
      "Paid, 3-month internship",
      "Field visits plus office days",
      "Training, scripts and weekly coaching",
    ],
  },
  marketing: {
    eyebrow: "PAID INTERNSHIP",
    title: "Marketing Internship",
    copy: "Help plan campaigns, create community content and learn how a fast consumer brand grows.",
    image: deals[7].image,
    points: [
      "Paid, 3-month internship",
      "Hybrid schedule in Kochi",
      "Real campaigns for your portfolio",
    ],
  },
  campus: {
    eyebrow: "STUDENT COMMUNITY",
    title: "Campus Ambassador",
    copy: "Represent Kouponly at your university, invite us into student events and help your campus discover better local perks.",
    image: deals[4].image,
    points: [
      "Get Kouponly involved in university activities",
      "Build a student community and share feedback",
      "Earn Gold Card access after selection",
    ],
  },
};
const creatorSteps = ["Pick & apply", "Receive or visit", "Create & submit", "Post & get paid"];
export default function WorkScreen() {
  const params = useLocalSearchParams<{ track?: string }>();
  const [track, setTrack] = useState(params.track ?? "creator");
  const [selected, setSelected] = useState<string | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<StorageAsset[]>([]);
  const [attachmentCampaign,setAttachmentCampaign]=useState<string|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const uploads = useRef<Array<() => void>>([]);
  const { state, toggleCampaign, toggleInterest, notify } = useStore();
  const { user } = useAuth();
  useEffect(() => {
    if (params.track && tracks.some((item) => item.id === params.track)) setTrack(params.track as typeof track);
  }, [params.track]);
  const addMedia = async (campaignId: string) => {
    if (!user) {
      notify(
        "Sign in to attach campaign media. Demo applications can continue without uploads.",
      );
      return;
    }
    try {
      const picked = await pickCampaignMedia(
        user.id,
        campaignId,
        5 - attachments.length,
      );
      setAttachmentCampaign(campaignId);
      setAttachments((value) => [...value, ...picked]);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not select media");
    }
  };
  const openCampaign=(campaignId:string)=>{if(attachmentCampaign&&attachmentCampaign!==campaignId){for(const asset of attachments)if(asset.status==="uploaded")void removeCampaignAttachment(asset).catch(()=>{});setAttachments([])}setAttachmentCampaign(campaignId);setSelected(campaignId)};
  const removeMedia = async (asset: StorageAsset) => {
    uploads.current = [];
    setAttachments((value) => value.filter((item) => item.id !== asset.id));
    if (asset.status === "uploaded")
      void removeCampaignAttachment(asset).catch(() =>
        notify("Attachment removal will retry later."),
      );
  };
  const apply = async (campaignId: string, applied: boolean, brand: string) => {
    if (applied) {
      if (await toggleCampaign(campaignId)) {
        setAttachments([]);
        setAttachmentCampaign(null);
        setSelected(null);
        notify("Campaign application withdrawn");
      }
      return;
    }
    if (!user) {
      if (await toggleCampaign(campaignId)) {
        setSelected(null);
        notify(`Applied to ${brand} in demo mode`);
      }
      return;
    }
    setSubmitting(true);
    uploads.current = [];
    try {
      const uploaded: StorageAsset[] = [];
      for (const source of attachments) {
        if (source.status === "uploaded") {
          uploaded.push(source);
          continue;
        }
        const current = { ...source, status: "uploading" as const };
        setAttachments((value) =>
          value.map((item) => (item.id === source.id ? current : item)),
        );
        const task = uploadStorageAsset(
          current,
          user.id,
          campaignId,
          (progress) =>
            setAttachments((value) =>
              value.map((item) =>
                item.id === source.id ? { ...item, progress } : item,
              ),
            ),
        );
        uploads.current.push(task.cancel);
        const result = (await task.promise) as StorageAsset;
        uploaded.push({ ...result, status: "uploaded", progress: 1 });
        setAttachments((value) =>
          value.map((item) =>
            item.id === source.id
              ? { ...result, status: "uploaded", progress: 1 }
              : item,
          ),
        );
      }
      if (
        await toggleCampaign(
          campaignId,
          undefined,
          uploaded.map((item) => item.id),
        )
      ) {
        setAttachments([]);
        setAttachmentCampaign(null);
        setSelected(null);
        notify(`Applied to ${brand}`);
      }
    } catch (error) {
      setAttachments((value) =>
        value.map((item) =>
          item.status === "uploading"
            ? {
                ...item,
                status: "failed",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : item,
        ),
      );
      notify(
        error instanceof Error
          ? error.message
          : "Upload failed. Retry when connected.",
      );
    } finally {
      uploads.current = [];
      setSubmitting(false);
    }
  };
  const role = roles[track];
  const interested = state.interests.includes(track);
  return (
    <>
      <Screen testID="work-screen" includeTopInset>
        <AppHeader
          eyebrow="WORK WITH KOUPONLY"
          title="Make your next move."
          back
        />
        <Text style={s.intro}>
          Create for brands, learn sales, grow campaigns or represent your
          campus.
        </Text>
        <View style={s.trackGrid}>
          {tracks.map(({ id, label, note: copy, Icon }) => (
            <AccessiblePressable
              testID={`track-${id}`}
              key={id}
              accessibilityLabel={`${label}. ${copy}`}
              accessibilityState={{ selected: track === id }}
              haptic="selection"
              onPress={() => setTrack(id)}
              style={[s.track, track === id && s.trackActive]}
            >
              <Icon size={21} color={track === id ? C.inkOnAccent : C.ink} />
              <Text
                style={[s.trackTitle, track === id && { color: C.inkOnAccent }]}
              >
                {label}
              </Text>
              <Text style={[s.trackNote, track === id && { color: C.inkOnAccent }]}>
                {copy}
              </Text>
            </AccessiblePressable>
          ))}
        </View>
        {track === "creator" ? (
          <>
            <View style={s.accepted}>
              <View style={s.acceptedIcon}>
                <Check size={19} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.micro, s.acceptedEyebrow]}>YOU’RE AN APPROVED CREATOR</Text>
                <Text style={s.acceptedTitle}>
                  Choose campaigns that fit your style
                </Text>
                <Text style={s.body}>
                  Apply only to the briefs you genuinely want to make.
                </Text>
              </View>
            </View>
            <AccessiblePressable
              testID="creator-earnings"
              accessibilityLabel={user ? "View your creator earnings" : "Sign in to view creator earnings"}
              accessibilityHint="Opens your creator earnings"
              onPress={() => router.push("/account/earnings")}
              style={s.earnings}
            >
              <View style={s.earningsIcon}><WalletCards size={21} color={C.inkOnAccent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.earningsEyebrow}>CREATOR EARNINGS</Text>
                <Text style={s.earningsTitle}>{user ? "View your earnings" : "Sign in to view earnings"}</Text>
                <Text style={s.earningsCopy}>{user ? "Track approved work and payouts" : "Your applications can continue in demo mode"}</Text>
              </View>
              <ChevronRight size={18} color={C.inkOnAccent} />
            </AccessiblePressable>
            <View testID="creator-process" style={s.process} accessibilityLabel="How creator work gets paid">
              <Text accessibilityRole="header" style={s.processTitle}>How creator work gets paid</Text>
              <View style={s.stepRow}>
                {creatorSteps.map((step, index) => <React.Fragment key={step}>
                  <View style={s.step}><Text style={s.stepNumber}>{index + 1}</Text><Text style={s.stepLabel}>{step}</Text></View>
                  {index < creatorSteps.length - 1 ? <View style={s.stepLine} /> : null}
                </React.Fragment>)}
              </View>
              <Text style={s.processCopy}>After approval, the brand sends a package or schedules a store visit. You make the video, send it for approval, post it and give Kouponly the final file. Payment is then released.</Text>
            </View>
            <View style={s.heading}>
              <View>
                <Text style={s.micro}>AVAILABLE NOW</Text>
                <Text style={s.headingTitle}>Pick a campaign</Text>
              </View>
              <Text style={s.badge}>{campaigns.length}</Text>
            </View>
            {campaigns.map((c) => {
              const applied = state.appliedCampaigns.includes(c.id);
              return (
                <AccessiblePressable
                  testID={`campaign-${c.id}`}
                  key={c.id}
                  onPress={() => openCampaign(c.id)}
                  accessibilityLabel={`${c.brand}. ${c.title}. ${c.due}. ${c.payment}. ${applied ? "View application" : "View brief and apply"}`}
                  accessibilityState={{ selected: applied }}
                  style={s.campaign}
                >
                  <Image source={{ uri: c.image }} style={s.campaignImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.micro}>
                      {c.brand.toUpperCase()} · {c.method}
                    </Text>
                    <Text style={s.campaignTitle}>{c.title}</Text>
                    <Text style={s.campaignMeta}>
                      {c.due} · {c.payment}
                    </Text>
                    <Text style={[s.appliedText, applied && { color: C.ink }]}>
                      {applied ? "✓ View application" : "View brief & apply"}
                    </Text>
                  </View>
                </AccessiblePressable>
              );
            })}
          </>
        ) : role ? (
          <View style={s.role}>
            <Image source={{ uri: role.image }} style={s.roleImage} />
            <Text style={s.micro}>{role.eyebrow}</Text>
            <Text style={s.roleTitle}>{role.title}</Text>
            <Text style={s.roleCopy}>{role.copy}</Text>
            {track === "campus" ? (
              <View style={s.gold}>
                <Text style={s.goldBrand}>KOUPONLY</Text>
                <Text style={s.goldTitle}>GOLD</Text>
                <Text style={s.goldCopy}>
                  Free food · Free experiences · Member extras
                </Text>
              </View>
            ) : null}
            <View style={s.points}>
              {role.points.map((p: string) => (
                <View key={p} style={s.point}>
                  <Check size={16} color={C.ink} />
                  <Text style={s.pointText}>{p}</Text>
                </View>
              ))}
            </View>
            <PrimaryButton
              testID={`interest-${track}`}
              label={
                interested
                  ? "Withdraw interest"
                  : track === "campus"
                    ? "Apply to represent campus"
                    : "Show interest"
              }
              onPress={() =>
                interested ? toggleInterest(track) : setRoleOpen(true)
              }
            />
          </View>
        ) : null}
      </Screen>
      <Modal
        accessibilityViewIsModal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable accessibilityLabel="Close campaign brief" style={s.backdrop} onPress={() => setSelected(null)} />
        {selected
          ? (() => {
              const c = campaigns.find((x) => x.id === selected)!;
              const applied = state.appliedCampaigns.includes(c.id);
              return (
                <View style={s.sheet}>
                  <AccessiblePressable accessibilityLabel="Close campaign brief" haptic="none" style={s.close} onPress={() => setSelected(null)}>
                    <X size={18} color={C.ink} />
                  </AccessiblePressable>
                  <Image source={{ uri: c.image }} style={s.sheetImage} />
                  <Text style={s.micro}>
                    {c.brand.toUpperCase()} · CREATOR BRIEF
                  </Text>
                  <Text style={s.sheetTitle}>{c.title}</Text>
                  <Text style={s.roleCopy}>{c.brief}</Text>
                  <View style={s.payment}>
                    {(c.deliverables ?? [c.method, `Pay: ${c.payment}`, c.due]).map((item) => <View key={item} style={s.briefRow}><Check size={15} color={C.success}/><Text style={s.paymentText}>{item}</Text></View>)}
                  </View>
                  {!applied ? (
                    <View style={s.mediaBox}>
                      <View style={s.mediaHead}>
                        <View>
                          <Text style={s.noteLabel}>
                            PORTFOLIO MEDIA · OPTIONAL
                          </Text>
                          <Text style={s.mediaNote}>
                            Up to 5 photos or short videos · 25 MB each
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={user ? "Add portfolio media" : "Sign in to add portfolio media"}
                          disabled={attachments.length >= 5 || submitting}
                          onPress={() => void addMedia(c.id)}
                          style={s.addMedia}
                        >
                          <ImagePlus size={18} />
                          <Text style={s.addMediaText}>{user ? "Add" : "Sign in"}</Text>
                        </Pressable>
                      </View>
                      {!user ? <Text style={s.mediaHint}>Sign in to attach photos or videos. You can still apply without media.</Text> : null}
                      {attachments.map((asset) => (
                        <View key={asset.id} style={s.attachment}>
                          <Image
                            source={{ uri: asset.uri }}
                            style={s.attachmentPreview}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={s.paymentText}>
                              {asset.mediaType === "video" ? "Video" : "Photo"}
                            </Text>
                            <Text style={s.mediaNote}>
                              {asset.status === "uploading"
                                ? `Uploading ${Math.round(asset.progress * 100)}%`
                                : asset.status === "failed"
                                  ? "Upload failed · retry available"
                                  : asset.status === "uploaded"
                                    ? "Uploaded securely"
                                    : "Ready to upload"}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityLabel="Remove attachment"
                            disabled={submitting}
                            onPress={() => void removeMedia(asset)}
                            style={s.removeMedia}
                          >
                            <Trash2 size={17} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <PrimaryButton
                    testID="apply-campaign"
                    label={
                      applied
                        ? "Withdraw application"
                        : "Apply for this campaign"
                    }
                    loading={submitting}
                    onPress={() => void apply(c.id, applied, c.brand)}
                  />
                  {submitting ? (
                    <Pressable
                      onPress={() =>
                        uploads.current.forEach((cancel) => cancel())
                      }
                      style={s.cancelUpload}
                    >
                      <Text style={s.mediaNote}>Cancel uploads</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })()
          : null}
      </Modal>
      <Modal
        accessibilityViewIsModal
        visible={roleOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRoleOpen(false)}
      >
        <Pressable accessibilityLabel="Close quick application" style={s.backdrop} onPress={() => setRoleOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.keyboardSheet}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.roleSheetContent}>
            <AccessiblePressable accessibilityLabel="Close quick application" haptic="none" style={s.close} onPress={() => setRoleOpen(false)}>
              <X size={18} color={C.ink} />
            </AccessiblePressable>
            <View style={s.roleSymbol}>
              <BriefcaseBusiness size={25} color={C.ink} />
            </View>
            <Text style={s.micro}>QUICK APPLICATION</Text>
            <Text style={s.sheetTitle}>{role?.title}</Text>
            <Text style={s.roleCopy}>
              Tell the team why this path fits you. Your profile details will be
              attached automatically.
            </Text>
            <Text style={s.noteLabel}>WHY ARE YOU INTERESTED?</Text>
            <Text style={s.noteHint}>20 characters minimum · {note.trim().length}/20</Text>
            <TextInput
              testID="role-note"
              value={note}
              onChangeText={setNote}
              placeholder="A short note about you, your college or relevant experience"
              placeholderTextColor={C.muted}
              selectionColor={C.lime}
              multiline
              accessibilityLabel="Why are you interested?"
              accessibilityHint="Enter at least 20 characters"
              style={s.note}
            />
            <PrimaryButton
              testID="submit-interest"
              disabled={note.trim().length < 20}
              label="Send interest"
              onPress={() => {
                Keyboard.dismiss();
                toggleInterest(track);
                notify("Interest sent");
                setRoleOpen(false);
                setNote("");
              }}
            />
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
const s = dynamicStyles(() => StyleSheet.create({
  intro: {
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 16,
    color: C.muted,
    marginTop: -10,
    marginBottom: 16,
  },
  trackGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  track: {
    width: "48%",
    minHeight: 105,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    ...shadow,
  },
  trackActive: { backgroundColor: C.lime, borderColor: C.ink },
  trackTitle: { fontFamily: F.headingSemi, fontSize: 14, marginTop: 9, color: C.ink },
  trackNote: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 4 },
  accepted: {
    borderRadius: 21,
    backgroundColor: "#101010",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 20,
  },
  acceptedIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  micro: { fontFamily: F.bodyBold, fontSize: 11, letterSpacing: 0.8, color: C.ink },
  acceptedTitle: {
    fontFamily: F.headingSemi,
    color: C.onDark,
    fontSize: 14,
    marginTop: 4,
  },
  acceptedEyebrow: { color: C.lime },
  body: { fontFamily: F.body, color: C.onDarkMuted, fontSize: 11, marginTop: 4 },
  earnings: {
    minHeight: 92,
    marginTop: 10,
    borderRadius: 21,
    backgroundColor: C.lime,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    ...shadow,
  },
  earningsIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: "rgba(255,255,255,.58)", alignItems: "center", justifyContent: "center" },
  earningsEyebrow: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: .8, color: C.inkOnAccent },
  earningsTitle: { fontFamily: F.headingSemi, fontSize: 18, color: C.inkOnAccent, marginTop: 2 },
  earningsCopy: { fontFamily: F.body, fontSize: 11, color: C.inkOnAccent, marginTop: 2 },
  process: { marginTop: 24, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 15, ...shadow },
  processTitle: { fontFamily: F.headingSemi, fontSize: 18, color: C.ink },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 16 },
  step: { width: 57, alignItems: "center" },
  stepNumber: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: "#101010", color: C.lime, textAlign: "center", textAlignVertical: "center", fontFamily: F.bodyBold, fontSize: 12 },
  stepLabel: { marginTop: 6, fontFamily: F.bodyBold, fontSize: 9, lineHeight: 12, color: C.ink, textAlign: "center" },
  stepLine: { flex: 1, minWidth: 7, height: 1, backgroundColor: C.line, marginTop: 14 },
  processCopy: { marginTop: 15, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.muted },
  heading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 25,
    marginBottom: 12,
  },
  headingTitle: { fontFamily: F.headingSemi, fontSize: 21, marginTop: 3, color: C.ink },
  badge: {
    fontFamily: F.bodyBold,
    color: C.inkOnAccent,
    backgroundColor: C.lime,
    width: 31,
    height: 31,
    borderRadius: 11,
    textAlign: "center",
    textAlignVertical: "center",
  },
  campaign: {
    minHeight: 110,
    borderRadius: 21,
    backgroundColor: C.card,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 9,
    ...shadow,
  },
  campaignImage: { width: 86, height: 92, borderRadius: 16 },
  campaignTitle: { fontFamily: F.headingSemi, fontSize: 14, marginTop: 4, color: C.ink },
  campaignMeta: { fontFamily: F.bodyBold, fontSize: 11, marginTop: 5, color: C.ink },
  appliedText: {
    fontFamily: F.bodyBold,
    fontSize: 11,
    color: C.muted,
    marginTop: 7,
  },
  role: { marginTop: 20 },
  roleImage: { width: "100%", height: 210, borderRadius: 27, marginBottom: 17 },
  roleTitle: { fontFamily: F.heading, fontSize: 26, marginTop: 6, color: C.ink },
  roleCopy: {
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 17,
    color: C.muted,
    marginTop: 8,
    marginBottom: 14,
  },
  gold: {
    height: 145,
    borderRadius: 24,
    backgroundColor: "#101010",
    padding: 18,
    marginVertical: 12,
    justifyContent: "flex-end",
  },
  goldBrand: {
    fontFamily: F.bodyBold,
    color: C.lime,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  goldTitle: { fontFamily: F.heading, color: C.onDark, fontSize: 35 },
  goldCopy: { fontFamily: F.body, color: C.onDarkMuted, fontSize: 11 },
  points: { marginBottom: 15 },
  point: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  pointText: { fontFamily: F.bodySemi, fontSize: 13, color: C.ink, flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.backdrop,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
    paddingBottom: 36,
  },
  roleSheetContent: { paddingBottom: 4 },
  keyboardSheet: { flex: 1, justifyContent: "flex-end" },
  close: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  sheetImage: {
    width: "100%",
    height: 155,
    borderRadius: 22,
    marginBottom: 17,
  },
  sheetTitle: {
    fontFamily: F.heading,
    fontSize: 25,
    color: C.ink,
    marginTop: 6,
    maxWidth: "88%",
  },
  payment: {
    backgroundColor: C.card,
    borderRadius: 17,
    padding: 13,
    gap: 7,
    marginBottom: 15,
  },
  briefRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  paymentText: { fontFamily: F.bodyBold, fontSize: 12, color: C.ink, flexShrink: 1 },
  mediaBox: {
    backgroundColor: C.card,
    borderRadius: 17,
    padding: 12,
    marginBottom: 14,
  },
  mediaHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mediaNote: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 3 },
  mediaHint: { fontFamily: F.body, fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 9 },
  addMedia: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: C.lime,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  addMediaText: { fontFamily: F.bodyBold, fontSize: 12 },
  attachment: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginTop: 9,
    paddingTop: 9,
  },
  attachmentPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.soft,
  },
  removeMedia: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelUpload: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  roleSymbol: {
    width: 57,
    height: 57,
    borderRadius: 20,
    backgroundColor: C.soft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  noteLabel: { fontFamily: F.bodyBold, fontSize: 11, letterSpacing: 0.8, color: C.ink },
  noteHint: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 4 },
  note: {
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    padding: 13,
    fontFamily: F.body,
    color: C.ink,
    textAlignVertical: "top",
    marginTop: 7,
    marginBottom: 14,
  },
}));
