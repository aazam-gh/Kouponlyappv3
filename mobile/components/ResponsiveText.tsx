import { forwardRef } from 'react';
import { Text, type TextProps } from 'react-native';

import { getLocalizedTextVariantStyle, getTextVariantStyle, type TextVariant } from '../constants/Typography';
import { useAppLocale } from '../context/LocaleContext';

type ResponsiveTextProps = TextProps & {
  variant?: TextVariant;
  minimumFontScale?: number;
};

const ResponsiveText = forwardRef<Text, ResponsiveTextProps>(function ResponsiveText(
  {
    children,
    style,
    variant = 'display',
    minimumFontScale = 0.72,
    numberOfLines = 1,
    ...props
  },
  ref,
) {
  const { locale, isRTL } = useAppLocale();

  return (
    <Text
      ref={ref}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit
      allowFontScaling
      minimumFontScale={minimumFontScale}
      style={[
        getTextVariantStyle(variant),
        getLocalizedTextVariantStyle(variant, locale),
        {
          flexShrink: 1,
          minWidth: 0,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
});

export default ResponsiveText;
