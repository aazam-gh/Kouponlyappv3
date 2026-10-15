import type { TextStyle } from 'react-native';

const FontFamilyTokens = {
    display: 'Outfit_700Bold',
    body: 'Outfit_400Regular',
    bodyStrong: 'Outfit_600SemiBold',
} as const;

export type TextVariant = 'display' | 'body' | 'bodyStrong';

const textVariantStyles: Record<TextVariant, TextStyle> = {
    display: {
        fontFamily: FontFamilyTokens.display,
        fontStyle: 'normal',
    },
    body: {
        fontFamily: FontFamilyTokens.body,
        fontStyle: 'normal',
    },
    bodyStrong: {
        fontFamily: FontFamilyTokens.bodyStrong,
        fontStyle: 'normal',
    },
};

type TextDirectionOptions = {
    isRTL?: boolean;
    textAlign?: TextStyle['textAlign'];
};

export function getTextVariantStyle(variant: TextVariant): TextStyle {
    return textVariantStyles[variant];
}

function getTextDirectionStyle({
    isRTL: explicitRTL,
    textAlign,
}: TextDirectionOptions = {}): TextStyle {
    const rtl = explicitRTL ?? false;

    return {
        writingDirection: rtl ? 'rtl' : 'ltr',
        ...(textAlign ? { textAlign } : null),
    };
}

export const Typography = {
    display: {
        bold: FontFamilyTokens.display,
    },
    outfit: {
        medium: 'Outfit_600SemiBold',
        semiBold: FontFamilyTokens.bodyStrong,
        bold: 'Outfit_700Bold',
    },
    fontFamily: FontFamilyTokens,
    variants: textVariantStyles,
    getTextVariantStyle,
    getTextDirectionStyle,
} as const;
