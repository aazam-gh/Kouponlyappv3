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
                    {'Last updated: April 2026'}
                </Text>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'1. Data Collection'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We collect information that you provide directly to us when you create an account, update your profile, or use our services. This may include your name, email address, phone number, and date of birth.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'2. How We Use Your Data'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We use the information we collect to provide, maintain, and improve our services, to process your transactions, and to communicate with you about Kouponly updates and promotions.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'3. Data Sharing'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We do not share your personal information with third parties except as described in this policy, such as with your consent or to comply with legal obligations.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'4. Data Security'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'5. Your Choices'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'You may update or correct your account information at any time by logging into your account or contacting us. You can also request the deletion of your account.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'6. Contact Us'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'If you have any questions about this Privacy Policy, please contact us at hello@kouponly.com.'}
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
