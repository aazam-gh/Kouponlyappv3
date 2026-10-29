import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    OnboardingButtonMotion,
    OnboardingGlowMotion,
} from '../../components/onboarding/OnboardingMotion';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAppLocale } from '../../context/LocaleContext';
import { Typography } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import ProfileSprites from '@/components/profile/ProfileSprites';

export default function OnboardingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ intent?: string; prefillEmail?: string }>();
    const { width } = useWindowDimensions();
    const { t } = useTranslation();
    const { theme } = useAppTheme();
    const { isRTL } = useAppLocale();
    const signupParams = {
        flow: 'signup',
        ...(typeof params.prefillEmail === 'string' ? { email: params.prefillEmail } : {}),
    };
    const handleCreateAccount = () => router.push({ pathname: '/kouponly/onboarding', params: signupParams } as any);

    const handleLogin = () => {
        router.push({
            pathname: '/kouponly/onboarding',
            params: { flow: 'login' },
        } as any);
    };

    const handleGuest = () => {
        router.replace('/kouponly' as any);
    };

    if (params.intent === 'create') return <Redirect href={{ pathname: '/kouponly/onboarding', params: signupParams } as any} />;

    return (
        <View style={styles.container}>
                <StatusBar style="dark" />
            <ProfileSprites />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.headerTitle, { color: theme.text, fontSize: Math.min(width * 0.23, 96), lineHeight: Math.min(width * 0.26, 106) }]}>
                                k<Text style={{ color: Colors.brandGreen }}>o</Text>uponly
                            </Text>
                        </View>
                        {/* Footer */}
                        <View style={styles.footer}>
                            <OnboardingButtonMotion enabled>
                                <OnboardingGlowMotion
                                    style={styles.buttonGlowWrapper}
                                    glowStyle={[styles.buttonGlow, { backgroundColor: theme.brandSoft, borderColor: theme.brandSoft }]}
                                >
                                    <ScalePressable
                                        style={[styles.button, { backgroundColor: theme.actionSolid }]}
                                        onPress={handleLogin}
                                        activeOpacity={0.9}
                                        accessibilityRole="button"
                                    >
                                        <Text style={[styles.buttonText, { color: theme.onActionSolid }]}>
                                            {t('onboarding_login_action')}
                                        </Text>
                                        <View
                                            style={styles.arrowCircle}
                                        >
                                            <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={24} color={theme.actionSolid} />
                                        </View>
                                    </ScalePressable>
                                </OnboardingGlowMotion>
                            </OnboardingButtonMotion>
                            <ScalePressable
                                style={[styles.createAccountButton, { borderColor: theme.actionSolid }]}
                                onPress={handleCreateAccount}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.createAccountButtonText, { color: theme.brandText }]}>
                                    {t('onboarding_v2_create_account')}
                                </Text>
                            </ScalePressable>
                            <ScalePressable
                                style={styles.guestButton}
                                onPress={handleGuest}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.guestButtonText, { color: theme.brandText }]}>
                                    {t('continue_as_guest')}
                                </Text>
                            </ScalePressable>
                        </View>
                    </View>
                </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 4,
        justifyContent: 'space-between',
        zIndex: 1,
    },
    header: {
        width: '100%',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...Typography.getTextVariantStyle('display'),
        textAlign: 'center',
        letterSpacing: -2,
    },
    footer: {
        width: '100%',
        paddingBottom: 8,
        paddingHorizontal: 10,
    },
    guestButton: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
        marginTop: 2,
    },
    guestButtonText: {
        ...Typography.getTextVariantStyle('bodyStrong'),
        fontSize: 15,
        textDecorationLine: 'underline',
    },
    createAccountButton: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
        marginTop: 12,
        borderRadius: 28,
        borderWidth: 1.5,
    },
    createAccountButtonText: {
        ...Typography.getTextVariantStyle('bodyStrong'),
        fontSize: 17,
    },
    button: {
        width: '100%',
        height: 64,
        borderRadius: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingStart: 30,
        paddingEnd: 10,
        // Shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        // Elevation for Android
        elevation: 5,
    },
    buttonGlowWrapper: {
        position: 'relative',
    },
    buttonGlow: {
        position: 'absolute',
        top: -8,
        right: -8,
        bottom: -8,
        left: -8,
        borderRadius: 48,
        borderWidth: 1,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 18,
        elevation: 2,
    },
    buttonText: {
        ...Typography.getTextVariantStyle('display'),
        position: 'absolute',
        left: 0,
        right: 0,
        fontSize: 18,
        color: '#0A0F0C',
        textAlign: 'center',
    },
    arrowCircle: {
        marginStart: 'auto',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
});
