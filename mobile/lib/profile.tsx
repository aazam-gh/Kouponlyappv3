import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAsset } from "@/lib/cloud.types";
import {
  fetchPreferences,
  fetchProfile,
  removeStorageAsset,
  signedUrl,
  updatePreferences,
  updateProfile,
  uploadStorageAsset,
} from "@/lib/backend";
import { useAuth } from "@/lib/auth";
import { pickAvatar } from "@/lib/media";

type Profile = {
  full_name: string;
  email: string;
  city: string;
  mobile: string;
  avatar_path: string | null;
};
type Preferences = {
  offer_alerts: boolean;
  creator_updates: boolean;
  location: string;
  language: string;
};
type Value = {
  profile: Profile;
  preferences: Preferences;
  avatarUrl: string | null;
  uploading: boolean;
  progress: number;
  refresh: () => Promise<void>;
  saveProfile: (value: Profile) => Promise<void>;
  savePreferences: (value: Preferences) => Promise<void>;
  chooseAvatar: () => Promise<void>;
};
const demo: Profile = {
  full_name: "Neil Jose Pillard",
  email: "neil.j.pillard@gmail.com",
  city: "Kochi, Kerala",
  mobile: "+91 98765 43210",
  avatar_path: null,
};
const defaults: Preferences = {
  offer_alerts: true,
  creator_updates: true,
  location: "Kochi",
  language: "English",
};
const Context = createContext<Value>({
  profile: demo,
  preferences: defaults,
  avatarUrl: null,
  uploading: false,
  progress: 0,
  refresh: async () => {},
  saveProfile: async () => {},
  savePreferences: async () => {},
  chooseAvatar: async () => {},
});
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(demo);
  const [preferences, setPreferences] = useState(defaults);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pendingKey = (kind: "profile" | "preferences") =>
    `kouponly.user.${user?.id}.${kind}.pending.v1`;
  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(demo);
      setPreferences(defaults);
      setAvatarUrl(null);
      return;
    }
    const [pendingProfile, pendingPreferences] = await Promise.all([
      AsyncStorage.getItem(`kouponly.user.${user.id}.profile.pending.v1`),
      AsyncStorage.getItem(`kouponly.user.${user.id}.preferences.pending.v1`),
    ]);
    if (pendingProfile)
      try {
        await updateProfile(JSON.parse(pendingProfile));
        await AsyncStorage.removeItem(
          `kouponly.user.${user.id}.profile.pending.v1`,
        );
      } catch {}
    if (pendingPreferences)
      try {
        await updatePreferences(JSON.parse(pendingPreferences));
        await AsyncStorage.removeItem(
          `kouponly.user.${user.id}.preferences.pending.v1`,
        );
      } catch {}
    const [pref, row] = await Promise.all([fetchPreferences(), fetchProfile()]);
    const next = {
      full_name:
        row?.full_name ||
        (user.user_metadata.full_name as string | undefined) ||
        "",
      email: user.email ?? row?.email ?? "",
      city: row?.city ?? "Kochi, Kerala",
      mobile: row?.mobile ?? "",
      avatar_path: row?.avatar_path ?? null,
    };
    setProfile(pendingProfile ? JSON.parse(pendingProfile) : next);
    if (pendingPreferences) setPreferences(JSON.parse(pendingPreferences));
    else if (pref)
      setPreferences({
        offer_alerts: pref.offer_alerts,
        creator_updates: pref.creator_updates,
        location: pref.location,
        language: pref.language,
      });
    setAvatarUrl(
      next.avatar_path ? await signedUrl("avatars", next.avatar_path) : null,
    );
  }, [user?.id]);
  useEffect(() => {
    void refresh().catch(() => {});
    if (!user) return;
    return () => {
    };
  }, [refresh, user?.id]);
  const saveProfile = useCallback(
    async (value: Profile) => {
      setProfile(value);
      if (user)
        try {
          await updateProfile(value);
          await AsyncStorage.removeItem(pendingKey("profile"));
        } catch (error) {
          await AsyncStorage.setItem(
            pendingKey("profile"),
            JSON.stringify(value),
          );
          throw error;
        }
    },
    [user?.id],
  );
  const savePreferences = useCallback(
    async (value: Preferences) => {
      setPreferences(value);
      if (user)
        try {
          await updatePreferences(value);
          await AsyncStorage.removeItem(pendingKey("preferences"));
        } catch (error) {
          await AsyncStorage.setItem(
            pendingKey("preferences"),
            JSON.stringify(value),
          );
          throw error;
        }
    },
    [user?.id],
  );
  const chooseAvatar = useCallback(async () => {
    if (!user) throw new Error("Sign in to upload a profile photo.");
    const asset = await pickAvatar(user.id);
    if (!asset) return;
    setUploading(true);
    setProgress(0);
    const previous = profile.avatar_path;
    try {
      const upload = uploadStorageAsset(
        asset as StorageAsset,
        user.id,
        undefined,
        setProgress,
      );
      await upload.promise;
      setProfile((value) => ({ ...value, avatar_path: asset.path }));
      setAvatarUrl(await signedUrl("avatars", asset.path));
      if (previous && previous !== asset.path)
        void removeStorageAsset({ bucket: "avatars", path: previous }).catch(
          () => {},
        );
    } finally {
      setUploading(false);
    }
  }, [user?.id, profile.avatar_path]);
  const value = useMemo(
    () => ({
      profile,
      preferences,
      avatarUrl,
      uploading,
      progress,
      refresh,
      saveProfile,
      savePreferences,
      chooseAvatar,
    }),
    [
      profile,
      preferences,
      avatarUrl,
      uploading,
      progress,
      refresh,
      saveProfile,
      savePreferences,
      chooseAvatar,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useProfile = () => useContext(Context);
