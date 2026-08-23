import {
  Check,
  Compass,
  Gift,
  Lock,
  Share2,
  Star,
  TicketPercent,
  Trophy,
  UserRound,
  X,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppHeader, PrimaryButton, Screen } from "@/components/ui";
import { Reward, rewards } from "@/lib/data";
import { useStore } from "@/lib/store";
import { C, dynamicStyles, F, shadow } from "@/lib/theme";
export default function RewardsScreen() {
  const { state, redeemReward, notify } = useStore();
  const [reward, setReward] = useState<Reward | null>(null);
  const [step, setStep] = useState<"confirm" | "pin" | "success">("confirm");
  const [pin, setPin] = useState("");
  const close = () => {
    setReward(null);
    setStep("confirm");
    setPin("");
  };
  const proceed = async () => {
    if (step === "confirm") setStep("pin");
    else if (
      pin.length === 4 &&
      reward &&
      (await redeemReward(reward.id, reward.points))
    ) {
      setStep("success");
      notify("Reward redeemed");
    }
  };
  const challenges = [
    [TicketPercent, "Use 3 discounts", "2 of 3 complete", "+150"],
    [Share2, "Invite 10 friends", "4 of 10 joined", "+500"],
    [UserRound, "Complete your profile", "62% complete", "+100"],
    [Compass, "Try 3 categories", "1 of 3 complete", "+120"],
  ] as const;
  return (
    <>
      <Screen testID="rewards-screen" includeTopInset>
        <AppHeader
          eyebrow="KOUPONLY REWARDS"
          title="Complete. Earn. Redeem."
          back
        />
        <Text style={s.lead}>
          Finish useful challenges, collect points and exchange them for real
          perks.
        </Text>
        <View style={s.overview}>
          <View>
            <Text style={s.overValue}>{state.points}</Text>
            <Text style={s.overLabel}>AVAILABLE</Text>
          </View>
          <View>
            <Text style={s.overValue}>250</Text>
            <Text style={s.overLabel}>EARNED THIS MONTH</Text>
          </View>
          <View>
            <Text style={s.overValue}>{Math.max(0, 1000 - state.points)}</Text>
            <Text style={s.overLabel}>TO GOLD</Text>
          </View>
        </View>
        <View style={s.spotlight}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>NEXT CHALLENGE</Text>
            <Text style={s.spotTitle}>Use 3 Kouponly discounts</Text>
            <Text style={s.copy}>
              Use one more eligible offer to earn 150 points.
            </Text>
            <View style={s.track}>
              <View style={s.progress} />
            </View>
            <Text style={s.progressText}>2 of 3 complete</Text>
          </View>
          <Text style={s.bonus}>
            +150{`\n`}
            <Text style={s.overLabel}>POINTS</Text>
          </Text>
        </View>
        <Text style={s.heading}>Redeem something good</Text>
        {rewards.map((r) => {
          const used = state.redeemedRewards.includes(r.id);
          const available = r.points <= state.points && !used;
          return (
            <Pressable
              testID={`reward-${r.id}`}
              disabled={!available}
              key={r.id}
              onPress={() => setReward(r)}
              style={[s.card, !available && { opacity: 0.55 }]}
            >
              <Image source={{ uri: r.image }} style={s.image} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{r.name}</Text>
                <Text style={s.cardBody}>{r.detail}</Text>
                <Text style={s.cost}>
                  {used
                    ? "REDEEMED"
                    : available
                      ? `${r.points} POINTS`
                      : `${r.points - state.points} POINTS SHORT`}
                </Text>
              </View>
              <Text style={s.arrow}>›</Text>
            </Pressable>
          );
        })}
        <Text style={s.heading}>More ways to earn points</Text>
        {challenges.map(([Icon, title, note, value]) => (
          <Pressable
            key={title}
            onPress={() => notify(`${title} opened`)}
            style={s.mission}
          >
            <View style={s.missionIcon}>
              <Icon size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.missionTitle}>{title}</Text>
              <Text style={s.cardBody}>{note}</Text>
            </View>
            <Text style={s.missionValue}>{value}</Text>
          </Pressable>
        ))}
      </Screen>
      <Modal
        accessibilityViewIsModal
        visible={!!reward}
        transparent
        animationType="slide"
      >
        <Pressable style={s.backdrop} onPress={close} />
        <View style={s.sheet}>
          <Pressable onPress={close} style={s.close}>
            <X size={19} />
          </Pressable>
          {step === "success" ? (
            <>
              <View style={[s.symbol, { backgroundColor: C.lime }]}>
                <Check size={28} />
              </View>
              <Text style={s.sheetTitle}>Reward redeemed</Text>
              <Text style={s.sheetBody}>
                Your {reward?.name} is ready and has been added to your
                activity.
              </Text>
              <PrimaryButton label="Done" onPress={close} />
            </>
          ) : (
            <>
              <View style={s.symbol}>
                {step === "confirm" ? <Gift size={28} /> : <Lock size={28} />}
              </View>
              <Text style={s.sheetTitle}>
                {step === "confirm"
                  ? `Redeem ${reward?.name}?`
                  : "Enter your reward PIN"}
              </Text>
              <Text style={s.sheetBody}>
                {step === "confirm"
                  ? `${reward?.points} points will be deducted after partner verification.`
                  : "A partner staff member enters their four-digit PIN to confirm collection."}
              </Text>
              {step === "pin" ? (
                <TextInput
                  testID="reward-pin"
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  style={s.pin}
                />
              ) : null}
              <PrimaryButton
                testID="confirm-reward"
                disabled={step === "pin" && pin.length !== 4}
                label={step === "confirm" ? "Continue" : "Confirm redemption"}
                onPress={proceed}
              />
            </>
          )}
        </View>
      </Modal>
    </>
  );
}
const s = dynamicStyles(() => StyleSheet.create({
  lead: {
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 16,
    color: C.muted,
    marginTop: -10,
    marginBottom: 14,
  },
  overview: {
    borderRadius: 25,
    backgroundColor: C.ink,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    ...shadow,
  },
  overValue: {
    fontFamily: F.headingSemi,
    color: C.lime,
    fontSize: 22,
    textAlign: "center",
  },
  overLabel: {
    fontFamily: F.bodyBold,
    color: C.onDarkMuted,
    fontSize: 11,
    letterSpacing: 0.7,
    textAlign: "center",
    marginTop: 3,
  },
  spotlight: {
    borderRadius: 24,
    backgroundColor: C.lime,
    padding: 18,
    flexDirection: "row",
    marginTop: 13,
  },
  label: {
    fontFamily: F.bodyBold,
    color: C.inkOnAccent,
    fontSize: 11,
    letterSpacing: 1,
  },
  spotTitle: {
    fontFamily: F.headingSemi,
    color: C.inkOnAccent,
    fontSize: 17,
    marginTop: 6,
  },
  copy: {
    fontFamily: F.body,
    fontSize: 11,
    lineHeight: 15,
    color: C.inkOnAccent,
    marginTop: 4,
  },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: C.line,
    marginTop: 11,
    overflow: "hidden",
  },
  progress: { width: "66%", height: "100%", backgroundColor: C.inkOnAccent },
  progressText: {
    fontFamily: F.bodyBold,
    color: C.inkOnAccent,
    fontSize: 11,
    marginTop: 4,
  },
  bonus: {
    fontFamily: F.heading,
    color: C.inkOnAccent,
    fontSize: 24,
    textAlign: "center",
    alignSelf: "center",
    marginLeft: 12,
  },
  heading: { fontFamily: F.headingSemi, fontSize: 21, marginVertical: 19 },
  card: {
    minHeight: 102,
    borderRadius: 21,
    backgroundColor: C.card,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 10,
    ...shadow,
  },
  image: { width: 80, height: 83, borderRadius: 16 },
  cardTitle: { fontFamily: F.headingSemi, fontSize: 15 },
  cardBody: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 4 },
  cost: {
    fontFamily: F.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 8,
  },
  arrow: { fontSize: 25 },
  mission: {
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: C.card,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  missionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  missionTitle: { fontFamily: F.bodyBold, fontSize: 13 },
  missionValue: { fontFamily: F.headingSemi, fontSize: 13 },
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
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    padding: 23,
    paddingBottom: 36,
  },
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
  },
  symbol: {
    width: 57,
    height: 57,
    borderRadius: 20,
    backgroundColor: C.soft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: F.heading, fontSize: 25, maxWidth: "85%" },
  sheetBody: {
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 17,
    color: C.muted,
    marginVertical: 12,
  },
  pin: {
    height: 66,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 18,
    backgroundColor: C.card,
    fontFamily: F.heading,
    fontSize: 31,
    letterSpacing: 13,
    textAlign: "center",
    marginBottom: 14,
  },
}));
