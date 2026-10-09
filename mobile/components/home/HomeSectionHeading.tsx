import { StyleSheet, Text, View } from 'react-native';

import { Typography } from '../../constants/Typography';
import { useAppLocale } from '../../context/LocaleContext';
import AppText from '../AppText';
import { HOME_HORIZONTAL_GUTTER, HOME_SECTION_HEADER_GAP } from './layout';

type Props = {
  prefix: string;
  highlight: string;
};

export default function HomeSectionHeading({ prefix, highlight }: Props) {
  const { isRTL } = useAppLocale();
  return (
    <View style={styles.container}>
      <AppText
        style={[
          styles.heading,
          Typography.getTextDirectionStyle({ isRTL }),
          { color: '#000000' },
        ]}
      >
        {prefix}
        <Text style={[styles.highlight, { color: '#000000' }]}>{highlight}</Text>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: HOME_HORIZONTAL_GUTTER,
    marginBottom: HOME_SECTION_HEADER_GAP,
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1,
  },
  highlight: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1,
    ...Typography.getTextVariantStyle('display'),
  },
});
