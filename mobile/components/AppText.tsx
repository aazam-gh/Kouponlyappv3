import { forwardRef } from 'react';
import { Text, type TextProps } from 'react-native';
import { getTextVariantStyle, type TextVariant } from '../constants/Typography';

type AppTextProps = TextProps & {
    variant?: TextVariant;
};

const AppText = forwardRef<Text, AppTextProps>(function AppText(
    { children, style, variant = 'display', ...props },
    ref,
) {
    return (
        <Text
            ref={ref}
            allowFontScaling
            style={[getTextVariantStyle(variant), style]}
            {...props}
        >
            {children}
        </Text>
    );
});

export default AppText;
