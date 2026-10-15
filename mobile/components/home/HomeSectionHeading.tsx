import ScalePressable from '@/components/ScalePressable';
import { useAppTheme } from '@/context/AppThemeContext';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { Typography } from '../../constants/Typography';
import { useAppLocale } from '../../context/LocaleContext';
import AppText from '../AppText';
import { HOME_HORIZONTAL_GUTTER, HOME_SECTION_HEADER_GAP } from './layout';

type Props = {
  prefix: string;
  highlight: string;
  onSeeMore?: () => void;
  headingStyle?: StyleProp<TextStyle>;
};

export default function HomeSectionHeading({ prefix, highlight, onSeeMore, headingStyle }: Props) {
  const { theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  return (
    <View style={styles.container}>
      <AppText
        style={[
          styles.heading,
          Typography.getTextDirectionStyle({ isRTL }),
          { color: theme.text },
          headingStyle,
        ]}
      >
        {prefix}
        <Text style={[styles.highlight, { color: theme.text }]}>{highlight}</Text>
      </AppText>
      {onSeeMore ? <ScalePressable accessibilityRole="button" accessibilityLabel={`See more ${prefix}${highlight}`} onPress={onSeeMore} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.brandText, fontSize: 14, ...Typography.getTextVariantStyle('bodyStrong') }}>See More</Text></ScalePressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: HOME_HORIZONTAL_GUTTER,
    marginBottom: HOME_SECTION_HEADER_GAP,
  },
  heading: {
    flex: 1,
    ...Typography.getTextVariantStyle('bodyStrong'),
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  highlight: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    ...Typography.getTextVariantStyle('display'),
  },
});
