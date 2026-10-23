import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { Typography } from '../constants/Typography';
import AppHeader from '../components/navigation/AppHeader';
import ProfileSprites from '@/components/profile/ProfileSprites';

const sections = [
    ['1. Who We Are and What This Notice Covers', 'Kouponly Private Limited ("Kouponly", "we", or "us"), based in India, provides an app for discovering participating vendors and offers, saving offers, managing referrals, and recording redemptions. This notice explains how Kouponly handles information through the app and related support services. For privacy requests or complaints, contact info@kouponly.in.'],
    ['2. Information You Provide', 'Depending on the features you use, we receive your name, email address, and profile details you choose to provide, such as your phone number, date of birth, city, profile photo, language, and preferences. Our authentication provider manages your sign-in credential; Kouponly does not receive your password in readable form. We also process saved vendors and offers, referral codes and rewards, and coupon and redemption records. If you submit a student eligibility request, we process the school email, application details, student ID image, and review outcome you submit. If you contact us, we receive your name, reply email address, and message.'],
    ['3. Location', 'On iOS and Android, the app may request foreground location permission when it starts if permission has not already been granted. If you allow it, the app uses your current location to find nearby vendors and calculate distances. The current app processes these coordinates on your device and does not upload them to Kouponly servers through this nearby-offers feature. We do not request background location. You can deny or revoke access in device settings; nearby results or distance information may then be unavailable.'],
    ['4. Notifications and Device Information', 'The app may request notification permission around sign-up and again after an offer redemption if permission is still unavailable and your device allows another prompt. If you grant permission, we receive and store your push token, account association, and device platform so Kouponly can send notifications through Expo and Apple or Google notification services. Notifications may include offer updates, redemption or account messages, and service announcements. You can turn them off in device settings. Signing out asks our service to unregister the device token; a temporary network failure may delay removal.'],
    ['5. How We Use Information', 'We use information to create and secure accounts; verify student eligibility; show and save offers; calculate nearby results; manage referrals; confirm redemptions and rewards; send notifications you permit; answer questions; troubleshoot and improve the app; prevent fraud and abuse; and meet legal obligations. Where applicable law requires consent, we ask for it and explain how to withdraw it. Other processing relies on a lawful basis available under the laws that apply.'],
    ['6. Analytics', 'When analytics are enabled, PostHog receives app screen names and high-level events such as a search being submitted or a coupon being redeemed. Analytics may be associated with your account identifier when you sign in. The current app does not send the text of your search in those events, and screen and touch autocapture, session replay, and GeoIP enrichment are disabled. Analytics may also receive basic app or device information needed to operate the analytics service.'],
    ['7. When We Share Information', 'We use service providers to host account and app data (Supabase), deliver email (Resend), provide product analytics (PostHog), and deliver push notifications (Expo, Apple, and Google). They process information for Kouponly under their service terms. When you choose to redeem an offer, we share the redemption details needed for the participating vendor to verify and honor that offer. A vendor’s own handling of information is governed by its privacy notice. We may also disclose information when required by law, to protect users or the service, or as part of a business transfer subject to applicable law. We do not sell personal information.'],
    ['8. Student Documents and Retention', 'Student ID images and review details are accessible to authorized reviewers for eligibility decisions. We retain information only while reasonably needed for the purposes described here, service records, security, dispute resolution, and legal requirements. We do not promise a fixed deletion date for every record. Cancelling a pending student request does not automatically delete its uploaded image; email info@kouponly.in to request removal. Account deletion removes your authentication account and account-owned avatar files through the current deletion service. Some redemption, referral, security, or legally required records may need to be retained, and provider backups may persist until their normal deletion cycle.'],
    ['9. Information Stored on Your Device', 'The app stores some information locally, such as saved items, profile or app state, and pending changes needed to sync when connectivity returns. This information remains in the app’s private device storage. After account deletion, local copies may remain until the app or device removes them; you can clear app storage or uninstall the app to remove local data.'],
    ['10. Security and International Processing', 'We use reasonable technical and organizational safeguards designed to protect information. No internet transmission or storage system can be guaranteed completely secure. Our service providers may process information in countries where they or their infrastructure operate. Where required, we use safeguards for cross-border processing and respond to valid legal requests.'],
    ['11. Your Choices and Requests', 'You can update available profile details in the app, manage location and notification permissions in device settings, and delete your account from Profile Details. You may contact info@kouponly.in to ask to access, correct, or delete your information; withdraw consent where processing is based on consent; ask about a student document; or make a privacy complaint. We may ask for information needed to verify your identity. We will handle requests under applicable law, including any lawful retention limits.'],
    ['12. Children', 'Kouponly accounts are for people aged 18 or older. The service is not directed to children, and we do not knowingly invite children to create accounts. If you believe a child has provided personal information, contact info@kouponly.in so we can review it and take appropriate steps.'],
    ['13. Changes and Contact', 'We may update this notice when the app, our processing, or applicable law changes. We will update the date below and provide any notice required by law. Questions, requests, and complaints can be sent to info@kouponly.in.'],
] as const;

export default function PrivacyScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <ProfileSprites />
            <AppHeader title="Privacy Policy" onBackPress={() => router.back()} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.lastUpdated, { color: theme.subtleText }]}>Last updated: October 23, 2026</Text>
                {sections.map(([title, body]) => (
                    <View key={title} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
                        <Text style={[styles.paragraph, { color: theme.mutedText }]}>{body}</Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40 },
    lastUpdated: { fontSize: 14, ...Typography.getTextVariantStyle('body'), marginBottom: 24 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, ...Typography.getTextVariantStyle('bodyStrong'), marginBottom: 12 },
    paragraph: { fontSize: 16, ...Typography.getTextVariantStyle('body'), lineHeight: 28 },
});
