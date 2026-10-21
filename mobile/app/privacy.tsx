import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { Typography } from '../constants/Typography';
import AppHeader from '../components/navigation/AppHeader';
import ProfileSprites from '@/components/profile/ProfileSprites';

export default function PrivacyScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <ProfileSprites />
            <AppHeader
                title={'Privacy Policy'}
                onBackPress={handleBack}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <Text style={[styles.lastUpdated, { color: theme.subtleText }]}>
                    {'Last updated: October 21, 2026'}
                </Text>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'1. Information We Collect'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We collect account and profile information you provide, such as your email address, name, phone number, date of birth, city, profile photo, and preferences. We also process saved offers, redemption records, and friend requests. If you request student verification, we collect your school email, student ID image, and review details so an authorized reviewer can assess your request.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'2. Location and Device Permissions'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'On iOS and Android, Kouponly may request foreground location access when you open the app if permission is not already granted. If you allow it, we use your current location to find nearby vendors and calculate distances. We do not request background location access. You can deny or revoke location permission in your device settings; nearby results may then be limited.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'3. Notifications'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We may ask for notification permission during sign-up or after a redemption. If you allow notifications, we register your device push token and platform with our services so we can send app notifications. You can change this permission in your device settings. Signing out asks our service to remove the device registration.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'4. How We Use and Share Information'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We use information to create and manage accounts, verify student eligibility, provide offers and redemptions, support the app, and protect our services. Kouponly uses service providers for its backend and storage (Supabase), product analytics (PostHog), email delivery (Resend), and push notifications (Expo and the platform notification services). These providers process information to provide services to Kouponly. If activity sharing was enabled, accepted friends may see vendors where you saved or redeemed offers during the last 30 days; contact us to request that existing sharing be disabled. You may also choose to show a redemption confirmation to a vendor. External vendor websites and apps have their own privacy practices.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'5. Analytics'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We use PostHog to understand app use. Our current analytics include app screen navigation, submitted searches, and coupon redemption events; when you are signed in, analytics may be associated with your account identifier. Screen and touch autocapture, session replay, and GeoIP enrichment are disabled in our current configuration.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'6. Your Choices and Data Retention'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'You can review or update profile information in the app and manage location and notification permissions in your device settings. Contact us to request access, correction, or deletion of information, or to disable activity sharing that was enabled previously. You can delete your account from Profile Details. We keep information for as long as needed to provide the service, handle account and redemption history, complete verification, and meet applicable obligations. Student ID images are available to authorized reviewers. Rejected and expired requests have their images removed during review or scheduled cleanup; approved images are kept for seven days after review before cleanup. Cancelling a pending request does not remove its image automatically; email us to request removal.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'7. Data Security'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We take reasonable measures to help protect information about you from loss, misuse, and unauthorized access, disclosure, alteration, or destruction.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'8. Contact Us'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'For privacy questions or requests, contact info@kouponly.in.'}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 40,
    },
    lastUpdated: {
        fontSize: 14,
        ...Typography.getTextVariantStyle('body'),
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        ...Typography.getTextVariantStyle('bodyStrong'),
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 16,
        ...Typography.getTextVariantStyle('body'),
        lineHeight: 28,
    },
});
