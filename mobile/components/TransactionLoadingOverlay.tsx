import { Image } from 'expo-image';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '../constants/Typography';
import { Colors } from '../constants/Colors';

const transactionLoaderSource = require('../assets/images/loaders/couponly-transaction-loader.gif');
const LOADER_GREEN = Colors.brandGreen;
const LOADER_SIZE = 128;
const CIRCLE_SIZE = 136;
const STAGE_SIZE = 152;
const PULSE_SCALE = 1.09;
const HALF_LOOP_MS = 345;

type TransactionLoadingOverlayProps = {
  visible: boolean;
  label?: string;
};

export default function TransactionLoadingOverlay({
  visible,
  label,
}: TransactionLoadingOverlayProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const resolvedLabel = label || t('transaction_processing');
  const circleScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.96);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(circleScale);
      cancelAnimation(contentOpacity);
      cancelAnimation(contentScale);
      circleScale.value = 1;
      contentOpacity.value = 0;
      contentScale.value = 0.96;
      return;
    }

    contentOpacity.value = withTiming(1, { duration: 120 });
    contentScale.value = withTiming(1, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });

    if (reduceMotion) {
      circleScale.value = 1;
      return;
    }

    circleScale.value = withRepeat(
      withSequence(
        withTiming(PULSE_SCALE, {
          duration: HALF_LOOP_MS,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(1, {
          duration: HALF_LOOP_MS,
          easing: Easing.inOut(Easing.cubic),
        })
      ),
      -1,
      false
    );
  }, [circleScale, contentOpacity, contentScale, reduceMotion, visible]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <Animated.View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={resolvedLabel}
          style={[styles.content, contentStyle]}
        >
          <View style={styles.stage}>
            <Animated.View style={[styles.circle, circleStyle]} />
            <Image
              source={transactionLoaderSource}
              style={styles.loader}
              contentFit="contain"
              autoplay
              cachePolicy="memory-disk"
            />
          </View>
          <Text style={[styles.label, { writingDirection: 'ltr' }]}>
            {resolvedLabel}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: LOADER_GREEN,
  },
  loader: {
    width: LOADER_SIZE,
    height: LOADER_SIZE,
  },
  label: {
    color: LOADER_GREEN,
    ...Typography.getTextVariantStyle('bodyStrong'),
    fontSize: 15,
    textAlign: 'center',
  },
});
