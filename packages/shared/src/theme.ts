/**
 * Brand tokens shared by the mobile app and the admin panel.
 * Version 1 style (docs/version-1/design/README.md): soft ground, white cards, plain grey border for
 * a selected or focused control, corners of 4-6 px, no animation.
 */
export const colors = {
  ink: '#13304A',
  signal: '#FFC72C',
  money: '#0B7A5C',
  ground: '#F5F6F2',
  surface: '#FFFFFF',
  /** Resting border of inputs, chips and cards. */
  line: '#E3E6E0',
  /** Lighter rule between rows inside a card. */
  divider: '#EDEFEA',
  /** Border of a selected card or chip, or an input being typed in. */
  selected: '#8A97A3',
  muted: '#5B6B7A',
  alert: '#A63D16',
  gamcha: '#D9483B',
  selectedTint: '#FFF4CC',
} as const;

export const fonts = {
  display: 'Anek Bangla',
  body: 'Hind Siliguri',
} as const;

/** Corner radius: 4 for small tiles, tags and code boxes; 6 for cards, inputs, buttons and chips. Circles use `round`. */
export const radius = { sm: 4, md: 6, lg: 6, round: 999 } as const;

/** Border width of inputs, chips, cards and selection. */
export const borderWidth = 1.5;

/** Smallest comfortable touch target, in points/pixels. */
export const minTouch = 48;
