import { forwardRef } from 'react';
import { Text, type TextProps } from 'react-native';
import { getTextVariantStyle, type TextVariant } from '../constants/Typography';
import { getLocalizedTextVariantStyle } from '../constants/Typography';
import { useAppLocale } from '../context/LocaleContext';

type AppTextProps = TextProps & {
    variant?: TextVariant;
};

const AppText = forwardRef<Text, AppTextProps>(function AppText(
    { children, style, variant = 'display', ...props },
    ref,
) {
    const { locale } = useAppLocale();
    return (
        <Text
            ref={ref}
            allowFontScaling
            style={[getTextVariantStyle(variant), getLocalizedTextVariantStyle(variant, locale), style]}
            {...props}
        >
            {children}
        </Text>
    );
});

export default AppText;
