import { useRouter } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { Typography } from '../constants/Typography';
import AppHeader from '../components/navigation/AppHeader';
import ProfileSprites from '@/components/profile/ProfileSprites';

export default function TermsScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <ProfileSprites />
            <AppHeader
                title={'Terms and Conditions'}
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
                        {'1. Introduction'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Welcome to Kouponly. These Terms and Conditions apply when you use the Kouponly app and services. By using Kouponly, you agree to these terms. The Privacy Policy explains how the app handles information and permissions.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'2. Use of Services'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'You must be at least 18 years old to use Kouponly. You may browse without an account, but redemption and student offers may require sign-in and approved student verification. Use the service lawfully, provide accurate account information, protect your sign-in details, and do not misuse, copy, resell, or attempt to bypass offer or redemption limits.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'3. Account Registration'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Some features require an account. Keep your account information accurate and tell us if you believe someone else has accessed your account. You are responsible for activity carried out through your account, subject to applicable law.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'4. Offers and Vendors'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Offers are provided by participating vendors and may have eligibility rules, exclusions, availability limits, or other conditions shown with the offer. Check those details before redeeming. Vendors control their products, services, opening hours, and fulfillment. Kouponly does not guarantee that an offer or vendor service will remain available.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'5. Redemptions'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Where an offer states a monthly limit, it is limited to one redemption per user, per offer, per month. Confirming an in-store redemption uses that offer’s monthly allowance, even if you do not complete a purchase. An online redemption is recorded when you confirm completion; its code is available for 10 minutes and expires after that time. Offer-specific terms shown in the app also apply.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'6. Intellectual Property'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'The content, organization, graphics, design, and other matters related to Kouponly are protected under applicable copyrights and other proprietary laws.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'7. Permissions and Activity Sharing'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Some features use device permissions. Foreground location helps show nearby vendors and calculate distances; notifications let us send app alerts. You can deny or revoke these permissions in your device settings, but the related features may be limited. If activity sharing was enabled, accepted friends may see your saved-offer and redemption activity; contact us to request that existing sharing be disabled. See the Privacy Policy for details.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'8. Third-Party Services and Liability'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Kouponly may link to vendor websites or other services that it does not operate; their terms and privacy practices apply when you use them. Vendors are responsible for their products, services, fulfillment, and offer availability. To the extent permitted by applicable law, Kouponly shall not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits or revenues. Nothing in these terms limits rights or remedies that cannot legally be excluded.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'9. Changes to Terms'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We may update these terms as the app or its services change. Continued use of Kouponly after an update takes effect means you accept the revised terms. The updated date above shows when this page was last revised. If you have questions, contact info@kouponly.in.'}
                    </Text>
                </View>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Artwork credits</Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>Sample subcategory artwork: Twemoji © Twitter, Inc and other contributors. Unmodified graphics, licensed under CC BY 4.0.</Text>
                    <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/twitter/twemoji').catch(() => Alert.alert('Unable to open link', 'Visit github.com/twitter/twemoji for the artwork source.'))} style={[styles.paragraph, { color: theme.brand }]}>Twemoji source</Text>
                    <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://creativecommons.org/licenses/by/4.0/').catch(() => Alert.alert('Unable to open link', 'Visit creativecommons.org/licenses/by/4.0 for the license.'))} style={[styles.paragraph, { color: theme.brand }]}>CC BY 4.0 license</Text>
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
