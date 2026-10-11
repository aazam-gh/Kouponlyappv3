import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  date_of_birth: string | null;
  first_name_edit_used: boolean;
  last_name_edit_used: boolean;
  date_of_birth_edit_used: boolean;
  mobile_edit_used: boolean;
  avatar_edit_used: boolean;
};
type Preferences = {
  offer_alerts: boolean;
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
const emptyProfile: Profile = {
  full_name: "",
  email: "",
  city: "",
  mobile: "",
  avatar_path: null,
  date_of_birth: null,
  first_name_edit_used: false,
  last_name_edit_used: false,
  date_of_birth_edit_used: false,
  mobile_edit_used: false,
  avatar_edit_used: false,
};
const defaults: Preferences = {
  offer_alerts: true,
  location: "",
  language: "English",
};
const rejectedByServer = (error: unknown) => /^(?:P0001|42501|22|23)/.test(String((error as {code?:string})?.code ?? ''));
const Context = createContext<Value>({
  profile: emptyProfile,
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
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [preferences, setPreferences] = useState(defaults);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const request = useRef(0);
  const uploadTask = useRef<ReturnType<typeof uploadStorageAsset> | null>(null);
  const pendingKey = (kind: "profile" | "preferences") =>
    `kouponly.user.${user?.id}.${kind}.pending.v1`;
  const refresh = useCallback(async () => {
    const current = ++request.current;
    const isCurrent = () => current === request.current && owner.current === user?.id;
    if (!user) {
      setProfile(emptyProfile);
      setPreferences(defaults);
      setAvatarUrl(null);
      return;
    }
    let [pendingProfile, pendingPreferences] = await Promise.all([
      AsyncStorage.getItem(`kouponly.user.${user.id}.profile.pending.v1`),
      AsyncStorage.getItem(`kouponly.user.${user.id}.preferences.pending.v1`),
    ]);
    if (!isCurrent()) return;
    if (pendingProfile)
      try {
        await updateProfile(JSON.parse(pendingProfile));
        await AsyncStorage.removeItem(
          `kouponly.user.${user.id}.profile.pending.v1`,
        );
        pendingProfile = null;
      } catch (error) {
        if(rejectedByServer(error)){await AsyncStorage.removeItem(`kouponly.user.${user.id}.profile.pending.v1`);pendingProfile=null;}
      }
    if (!isCurrent()) return;
    if (pendingPreferences)
      try {
        await updatePreferences(JSON.parse(pendingPreferences));
        await AsyncStorage.removeItem(
          `kouponly.user.${user.id}.preferences.pending.v1`,
        );
        pendingPreferences = null;
      } catch {}
    if (!isCurrent()) return;
    const [pref, row] = await Promise.all([fetchPreferences(), fetchProfile()]);
    if (!isCurrent()) return;
    const next = {
      full_name:
        row?.full_name ||
        (user.user_metadata.full_name as string | undefined) ||
        "",
      email: user.email ?? row?.email ?? "",
      city: row?.city ?? "",
      mobile: row?.mobile ?? "",
      avatar_path: row?.avatar_path ?? null,
      date_of_birth: row?.date_of_birth ?? null,
      first_name_edit_used: row?.first_name_edit_used ?? false,
      last_name_edit_used: row?.last_name_edit_used ?? false,
      date_of_birth_edit_used: row?.date_of_birth_edit_used ?? false,
      mobile_edit_used: row?.mobile_edit_used ?? false,
      avatar_edit_used: row?.avatar_edit_used ?? false,
    };
    // A damaged local draft must not prevent the server profile from loading.
    let draft: Partial<Profile> = {}, preferenceDraft: Partial<Preferences> = {};
    try { if (pendingProfile) draft = JSON.parse(pendingProfile); } catch {}
    try { if (pendingPreferences) preferenceDraft = JSON.parse(pendingPreferences); } catch {}
    setProfile({ ...next, ...draft });
    if (pendingPreferences) setPreferences({ ...defaults, ...preferenceDraft });
    else if (pref)
      setPreferences({
        offer_alerts: pref.offer_alerts,
        location: pref.location,
        language: pref.language,
      });
    const avatar = next.avatar_path ? await signedUrl("avatars", next.avatar_path).catch(() => null) : null;
    if (isCurrent()) setAvatarUrl(avatar);
  }, [user?.id]);
  useEffect(() => {
    setProfile(emptyProfile);setPreferences(defaults);setAvatarUrl(null);
    setUploading(false);setProgress(0);
    void refresh().catch(() => {});
    return () => { ++request.current;uploadTask.current?.cancel();uploadTask.current=null; };
  }, [refresh, user?.id]);
  const saveProfile = useCallback(
    async (value: Profile) => {
      setProfile(value);
      if (user)
        try {
          await updateProfile(value);
          await AsyncStorage.removeItem(pendingKey("profile"));
        } catch (error) {
          if(rejectedByServer(error)){if(owner.current===user.id)setProfile(profile);throw error;}
          await AsyncStorage.setItem(
            pendingKey("profile"),
            JSON.stringify(value),
          );
          throw error;
        }
    },
    [user?.id, profile],
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
    if (!asset || owner.current !== user.id) return;
    setUploading(true);
    setProgress(0);
    const previous = profile.avatar_path;
    try {
      const upload = uploadStorageAsset(asset, user.id, value => { if(owner.current===user.id)setProgress(value); });
      uploadTask.current=upload;
      await upload.promise;
      if(owner.current!==user.id)return;
      setProfile((value) => ({ ...value, avatar_path: asset.path, avatar_edit_used: true }));
      const avatar=await signedUrl("avatars", asset.path).catch(()=>null);
      if(owner.current!==user.id)return;
      setAvatarUrl(avatar);
      if (previous && previous !== asset.path)
        void removeStorageAsset({ bucket: "avatars", path: previous }).catch(
          () => {},
        );
    } finally {
      if(owner.current===user.id){uploadTask.current=null;setUploading(false);}
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
