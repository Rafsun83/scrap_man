import { borderWidth, colors, minTouch, radius } from '@bw/shared';
import type { TextStyle, ViewStyle } from 'react-native';

export { borderWidth, colors, minTouch, radius };

/** Extra tones from the designs that are not brand tokens. */
export const tones = {
  ink200: '#D3DCE5',
  /** Dashed "add" outlines and unchecked boxes. */
  dashed: '#C9CFC6',
  /** Unselected radio ring. */
  ring: '#C9CFC6',
  mapGround: '#E9ECE5',
  doneBg: '#E3F2EC',
  doneFg: '#0B5C45',
  cancelledBg: '#EEF0EC',
  cancelledFg: '#3F4A54',
  /** Active tab and soft ink highlight. */
  inkTint: '#EEF2F6',
  /** Warning note: yellow-tinted background and border, brown text. */
  warnBg: '#FFF8E6',
  warnLine: '#F1E1B4',
  warnInk: '#5C4300',
  /** Alert note: red-tinted background and border. */
  alertBg: '#FFF8F5',
  alertLine: '#F0D5C8',
} as const;

/**
 * The light shadow under white cards (v1 style). One small elevation step, cheap on low-end Android.
 */
export const cardShadow: ViewStyle = {
  shadowColor: colors.ink,
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 1,
};

/**
 * Loaded font files. React Native picks a custom font by family name, not by weight, so each weight
 * is its own family.
 */
export const fontFamilies = {
  display700: 'AnekBangla_700Bold',
  display800: 'AnekBangla_800ExtraBold',
  body400: 'HindSiliguri_400Regular',
  body500: 'HindSiliguri_500Medium',
  body600: 'HindSiliguri_600SemiBold',
  body700: 'HindSiliguri_700Bold',
} as const;

export function display(size: number, weight: 700 | 800 = 700): TextStyle {
  return {
    fontFamily: weight === 800 ? fontFamilies.display800 : fontFamilies.display700,
    fontSize: size,
    color: colors.ink,
  };
}

export function body(size: number, weight: 400 | 500 | 600 | 700 = 400): TextStyle {
  const family = {
    400: fontFamilies.body400,
    500: fontFamilies.body500,
    600: fontFamilies.body600,
    700: fontFamilies.body700,
  }[weight];
  return { fontFamily: family, fontSize: size, color: colors.ink };
}
