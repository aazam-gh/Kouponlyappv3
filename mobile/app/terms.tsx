import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { Typography } from '../constants/Typography';
import AppHeader from '../components/navigation/AppHeader';
import ProfileSprites from '@/components/profile/ProfileSprites';

const sections = [
    ['1. About These Terms', 'These Terms apply to your use of the Kouponly mobile app and related services. Kouponly Private Limited, based in India, operates the service. By browsing, creating an account, or using a feature, you agree to these Terms and the Privacy Policy. If you do not agree, stop using the service.'],
    ['2. Eligibility and Your Account', 'You must be at least 18 years old to create or use a Kouponly account. Provide accurate information, keep your sign-in credentials secure, and promptly tell us if you believe someone has accessed your account without permission. You are responsible for activity through your account to the extent allowed by law. Do not create accounts using false details or someone else’s identity.'],
    ['3. What Kouponly Provides', 'Kouponly helps you discover participating vendors and their offers, save offers, use referral features, and record eligible redemptions. Kouponly currently does not take payment for vendor purchases in the app. If you buy something from a vendor, that purchase is between you and the vendor, and the vendor is responsible for the product or service, price, payment, fulfilment, and customer service.'],
    ['4. Offers and Vendor Responsibilities', 'Each offer is set by the participating vendor. Eligibility, dates, locations, exclusions, minimum spend, redemption steps, and limits may apply; read the offer details before relying on it. Offers, prices, opening hours, and availability can change or end. Kouponly works to display useful information but does not guarantee that a vendor will accept or fulfil an offer. Contact the vendor about a purchase or service, and contact Kouponly about an app or listing issue. Nothing in these Terms removes rights you have under consumer law.'],
    ['5. Redemptions, Codes, and Rewards', 'A redemption is subject to the offer’s displayed rules and any confirmation step in the app. Confirming an in-store offer may use its available allowance even if you do not complete a purchase, where the offer says so. A code or reservation may expire at the time shown in the app. Do not copy, transfer, resell, or try to reuse a one-time code. Referral benefits, points, and other rewards, if offered, are subject to the eligibility rules, limits, and expiry shown in the app. They are not cash and cannot be transferred unless Kouponly expressly says otherwise. We may correct an account balance or reverse a reward obtained through error, fraud, or a rule violation, subject to applicable law.'],
    ['6. Referral Features', 'You may share or enter referral codes using the referral feature. Follow the limits shown in the app; do not sell codes, create fake accounts, or manipulate referrals. We may withhold or reverse a referral benefit if the referral is ineligible, fraudulent, or violates these Terms. Referral activity does not allow another user to see your saved offers or redemption history.'],
    ['7. Acceptable Use', 'Use Kouponly lawfully and for personal, non-commercial use. Do not interfere with the service; probe or bypass security; scrape, reverse engineer, or automate access without permission; upload malicious or unlawful material; misrepresent eligibility; abuse a vendor or another user; or exploit an offer or redemption process. We may investigate misuse and restrict access when reasonably needed to protect users, vendors, or the service, subject to applicable law.'],
    ['8. Photos and Documents You Submit', 'You keep rights you have in profile photos and documents you upload. You confirm that you may submit them for the feature you choose. You give Kouponly permission to host, review, and use those materials only as needed to provide that feature, keep the service secure, and meet legal obligations. Do not upload content that is unlawful or belongs to someone else without permission. Student eligibility documents may be reviewed by authorized personnel as described in the Privacy Policy.'],
    ['9. Intellectual Property', 'Kouponly and its licensors own the app, branding, software, and Kouponly-created content, except for material identified as belonging to others. These Terms give you a limited, personal, revocable right to use the app as intended. You may not copy, modify, distribute, sell, or create derivative works from Kouponly materials unless the law allows it or we give written permission. Vendor names, logos, images, and offer content belong to their respective owners.'],
    ['10. Permissions and Privacy', 'Some features need foreground location or notification access. Location helps show nearby vendors and calculate distances; notifications deliver app messages and offer updates. You can deny or revoke either permission in device settings, though related features may be limited. The Privacy Policy explains what information is processed, how to exercise your choices, and how to contact us.'],
    ['11. Third-Party Services', 'The app may link to a vendor or another service that Kouponly does not operate. Those services have their own terms and privacy notices, and Kouponly is not responsible for their content or practices.'],
    ['12. Availability, Suspension, and Termination', 'We may change, suspend, or discontinue part of the service for operational, security, legal, or business reasons. You may stop using Kouponly and delete your account from Profile Details. We may suspend or close an account for a serious or repeated violation, fraud, security risk, or legal requirement. Where required, we will provide notice and an opportunity to challenge the decision. Account closure does not remove records that must be retained by law or to resolve a dispute.'],
    ['13. Disclaimers and Liability', 'Kouponly is provided on an “as available” basis, subject to warranties and rights that cannot be excluded under applicable law. Vendors remain responsible for their offers, products, services, and transactions. To the extent permitted by law, Kouponly is not liable for losses caused by a vendor, an unavailable offer, or an interruption outside our reasonable control. Nothing in these Terms excludes or limits liability, consumer rights, or remedies that cannot legally be excluded or limited.'],
    ['14. Changes to These Terms', 'We may revise these Terms when the service or applicable law changes. We will update the date below and provide any notice required by law. If a change materially affects your rights, we will take the notice or consent steps required by law. Using the service after revised Terms take effect means you accept them only to the extent that acceptance is legally effective.'],
    ['15. Applicable Law and Disputes', 'These Terms are governed by the laws of India. Subject to mandatory consumer protections and any non-waivable rights available to you, courts of competent jurisdiction in India may hear disputes relating to these Terms or the service. Nothing here prevents you from using a consumer forum or other remedy that applicable law makes available.'],
    ['16. Contact and Complaints', 'For questions, complaints, or notices about these Terms, email info@kouponly.in. Include enough information for us to understand and respond to your concern; do not email passwords or one-time codes.'],
] as const;

export default function TermsScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <ProfileSprites />
            <AppHeader title="Terms and Conditions" onBackPress={() => router.back()} />
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
