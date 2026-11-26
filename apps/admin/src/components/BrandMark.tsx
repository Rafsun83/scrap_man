import { colors } from '@bw/shared'

/** Logo L3 (the bhangariwala's face on a yellow tile). */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <rect width="200" height="200" rx="33" fill={colors.signal} />
      <circle cx="100" cy="90" r="52" fill="#E0A872" stroke={colors.ink} strokeWidth="6" />
      <path d="M48 86 C46 50 72 36 100 36 C130 36 156 52 152 86 C142 70 122 64 104 66 C84 64 62 72 48 86 Z" fill={colors.ink} />
      <line x1="24" y1="114" x2="176" y2="114" stroke={colors.ink} strokeWidth="9" strokeLinecap="round" />
      <path d="M8 150 Q24 166 40 150 Z M160 150 Q176 166 192 150 Z" fill="#fff" stroke={colors.ink} strokeWidth="5" />
      <path d="M24 114 L12 150 M24 114 L36 150 M176 114 L164 150 M176 114 L188 150" stroke={colors.ink} strokeWidth="4" />
    </svg>
  )
}
