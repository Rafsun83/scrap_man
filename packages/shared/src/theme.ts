/** Brand tokens shared by the mobile app and the admin panel. */
export const colors = {
  ink: '#13304A',
  signal: '#FFC72C',
  money: '#0B7A5C',
  ground: '#EEF0EC',
  surface: '#FFFFFF',
  line: '#D5D9D3',
  muted: '#4F5B66',
  alert: '#A63D16',
  gamcha: '#D9483B',
  selectedTint: '#FFF4CC',
} as const;

export const fonts = {
  display: 'Anek Bangla',
  body: 'Hind Siliguri',
} as const;

export const radius = { sm: 10, md: 14, lg: 16, pill: 999 } as const;

/** Smallest comfortable touch target, in points/pixels. */
export const minTouch = 48;
