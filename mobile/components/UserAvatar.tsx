import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Typography } from '../constants/Typography';
import { Colors } from '../constants/Colors';

type UserAvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  role?: string | null;
  seed?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const AVATAR_THEMES = [
  { background: '#101820', accent: Colors.brandGreen, soft: Colors.brandGreenLight, text: '#FFFFFF' },
  { background: '#143D66', accent: Colors.brandGreen, soft: Colors.brandGreenLight, text: '#FFFFFF' },
  { background: '#F2C94C', accent: '#101820', soft: '#FFF4B8', text: '#101820' },
  { background: '#0D3B66', accent: '#F95738', soft: '#BEE3F8', text: '#FFFFFF' },
  { background: '#2D1E2F', accent: '#F7B801', soft: '#FDE7AA', text: '#FFFFFF' },
  { background: '#004E64', accent: Colors.brandGreen, soft: Colors.brandGreenLight, text: '#FFFFFF' },
];

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  const firstInitial = firstName?.trim()?.charAt(0);
  const lastInitial = lastName?.trim()?.charAt(0);

  if (firstInitial || lastInitial) {
    return `${firstInitial || ''}${lastInitial || ''}`.toUpperCase();
  }

  return email?.trim()?.charAt(0)?.toUpperCase() || 'X';
}

export default function UserAvatar({
  firstName,
  lastName,
  email,
  photoURL,
  role,
  seed,
  size = 80,
  style,
}: UserAvatarProps) {
  const normalizedSeed = seed || email || `${firstName || ''}-${lastName || ''}` || 'couponly-user';
  const hash = hashString(normalizedSeed);
  const theme = AVATAR_THEMES[hash % AVATAR_THEMES.length];
  const initials = getInitials(firstName, lastName, email);
  const isCreator = role === 'creator';

  if (photoURL) {
    return (
      <View style={[styles.shell, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image source={{ uri: photoURL }} style={styles.image} contentFit="cover" />
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={`${initials} avatar`}
      accessibilityRole="image"
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.background,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.orb,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size * 0.36,
            backgroundColor: theme.soft,
            right: -size * 0.2,
            top: -size * 0.18,
          },
        ]}
      />
      <View
        style={[
          styles.sash,
          {
            backgroundColor: theme.accent,
            height: size * 0.24,
            transform: [{ rotate: `${hash % 2 === 0 ? '-' : ''}18deg` }],
          },
        ]}
      />
      <Text
        maxFontSizeMultiplier={1.1}
        style={[
          styles.initials,
          {
            color: theme.text,
            fontSize: size * 0.32,
            letterSpacing: size * 0.015,
          },
        ]}
      >
        {initials}
      </Text>
      {isCreator ? (
        <View
          style={[
            styles.creatorDot,
            {
              width: size * 0.22,
              height: size * 0.22,
              borderRadius: size * 0.11,
              backgroundColor: theme.accent,
              borderWidth: Math.max(2, size * 0.025),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  orb: {
    opacity: 0.42,
    position: 'absolute',
  },
  sash: {
    left: '-18%',
    opacity: 0.9,
    position: 'absolute',
    width: '136%',
  },
  initials: {
    ...Typography.getTextVariantStyle('bodyStrong'),
    includeFontPadding: false,
    textAlign: 'center',
    zIndex: 1,
  },
  creatorDot: {
    borderColor: '#FFFFFF',
    bottom: '8%',
    position: 'absolute',
    right: '8%',
  },
});
