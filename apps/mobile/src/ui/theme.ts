import { colors, minTouch, radius } from '@bw/shared';
import type { TextStyle } from 'react-native';

export { colors, minTouch, radius };

/** Extra tones from the prototype that are not brand tokens. */
export const tones = {
  ink200: '#D3DCE5',
  dashed: '#8A949E',
  ring: '#C9CFC8',
  mapGround: '#E2E6E0',
  doneBg: '#DCEFE7',
  doneFg: '#0B5C45',
  cancelledBg: '#E2E6E0',
  cancelledFg: '#3F4A54',
} as const;

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
  return { fontFamily: weight === 800 ? fontFamilies.display800 : fontFamilies.display700, fontSize: size, color: colors.ink };
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
