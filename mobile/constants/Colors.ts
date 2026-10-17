/**
 * Unified color palette for the application.
 */

const primaryRed = '#E60000';
// Dominant green sampled from the Kouponly logo.
const brandGreen = '#18B952';
const brandGreenLight = '#E8FAF0';
const softenedBlackBorder = 'rgba(0, 0, 0, 0.5)';

export type AppThemeMode = 'light' | 'dark';

const light = {
  text: '#0A0F0C',
  textInverse: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F7F8F6',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardMuted: '#F1F4EF',
  tint: primaryRed,
  subtitle: '#5F6861',
  mutedText: '#5F6861',
  subtleText: '#8B938B',
  border: softenedBlackBorder,
  borderStrong: softenedBlackBorder,
  icon: '#111713',
  iconMuted: '#7B857F',
  tabIconDefault: '#666666',
  tabIconSelected: primaryRed,
  primary: primaryRed,
  brand: brandGreen,
  brandText: '#0A0F0C',
  brandSoft: brandGreenLight,
  actionSolid: brandGreen,
  onActionSolid: '#0A0F0C',
  buttonText: '#0A0F0C',
  inputBackground: 'rgba(255,255,255,0.82)',
  inputBorder: softenedBlackBorder,
  inputPlaceholder: 'rgba(10,15,12,0.48)',
  inputText: 'rgba(10,15,12,0.78)',
  inputHighlight: 'rgba(255,255,255,0.92)',
  inputShade: 'rgba(10,15,12,0.05)',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.35)',
  tabBar: '#FFFFFF',
  logoTile: '#FFFFFF',
  logoTileBorder: softenedBlackBorder,
  logoTileText: '#0B0F0D',
  mediaBase: '#111111',
  imageScrim: 'rgba(0,0,0,0.28)',
  danger: '#D92D20',
  warning: '#B7791F',
  info: '#2563EB',
};

const dark = {
  text: '#F4F8F3',
  textInverse: '#0A0F0C',
  background: '#0B0F0D',
  surface: '#111513',
  surfaceElevated: '#171C19',
  card: '#141916',
  cardMuted: '#1E2420',
  tint: primaryRed,
  subtitle: '#C8D0C8',
  mutedText: '#C8D0C8',
  subtleText: '#89938B',
  border: '#29322D',
  borderStrong: '#3A463F',
  icon: '#F1F6F0',
  iconMuted: '#89938B',
  tabIconDefault: '#8C9890',
  tabIconSelected: brandGreen,
  primary: primaryRed,
  brand: brandGreen,
  brandText: '#F4F8F3',
  brandSoft: 'rgba(24, 185, 82, 0.18)',
  actionSolid: brandGreen,
  onActionSolid: '#080808',
  buttonText: '#080808',
  inputBackground: 'rgba(18,32,24,0.88)',
  inputBorder: 'rgba(255,255,255,0.10)',
  inputPlaceholder: 'rgba(244,248,243,0.50)',
  inputText: 'rgba(244,248,243,0.86)',
  inputHighlight: 'rgba(255,255,255,0.12)',
  inputShade: 'rgba(0,0,0,0.28)',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.62)',
  tabBar: '#0E1310',
  logoTile: '#F7F8F6',
  logoTileBorder: '#DCE4DA',
  logoTileText: '#0B0F0D',
  mediaBase: '#111111',
  imageScrim: 'rgba(0,0,0,0.44)',
  danger: '#FF6B5F',
  warning: '#F5C451',
  info: '#7DA2FF',
};

export type AppThemeColors = typeof light;

export const Colors = {
  cardOutline: 'rgba(100, 116, 106, 0.28)',
  border: softenedBlackBorder,
  light,
  dark,
  brandGreen,
  brandGreenLight,
  themes: {
    light,
    dark,
  },
  // Specific onboarding colors if they need to be fixed regardless of theme
  onboarding: {
    background: '#FFFFFF',
    title: '#000000',
    subtitle: '#666666',
    primary: brandGreen,
    buttonText: '#0A0F0C',
    shadow: brandGreen,
  },
};
