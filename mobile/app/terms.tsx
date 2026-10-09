import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { Typography } from '../constants/Typography';
import AppHeader from '../components/navigation/AppHeader';

export default function TermsScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <AppHeader
                title={'Terms and Conditions'}
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
                        {'1. Introduction'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Welcome to Kouponly. These Terms and Conditions govern your use of our application and services. By accessing or using Kouponly, you agree to be bound by these terms.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'2. Use of Services'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'You must be at least 18 years old to use this service. You agree to use Kouponly only for lawful purposes and in a way that does not infringe the rights of, restrict or inhibit anyone else&apos;s use and enjoyment of Kouponly.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'3. Account Registration'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'To access certain features, you may be required to register for an account. You represent and warrant that all registration information you submit is truthful and accurate.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'4. Intellectual Property'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'The content, organization, graphics, design, and other matters related to Kouponly are protected under applicable copyrights and other proprietary laws.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'5. Limitation of Liability'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'Kouponly shall not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues.'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {'6. Changes to Terms'}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.mutedText }]}>
                        {'We reserve the right to modify these terms at any time. Your continued use of Kouponly after any such changes constitutes your acceptance of the new Terms and Conditions.'}
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
