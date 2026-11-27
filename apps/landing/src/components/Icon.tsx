/** Line icons (24 x 24, 2 px stroke, currentColor). Decorative: the text next to them says what they mean. */
const paths = {
  scale: 'M12 3v18M5 21h14M4 7h16M7 7l-3 7a3 3 0 0 0 6 0L7 7Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  key: 'M14 10a4 4 0 1 1-1.2-2.8L21 7v3h-2v2h-2v2l-3-.2M8 10h.01',
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 10v4M18 10v4',
  check: 'M4 12l5 5L20 6',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12l3 3 5-6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9 12l2 2 4-4',
  eyeOff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.3 7.6A16 16 0 0 0 3 12s4 6 9 6a9 9 0 0 0 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  chat: 'M4 5h16v11H9l-5 4V5ZM8 9h8M8 12h5',
  pin: 'M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  minus: 'M5 12h14',
  phone: 'M7 2h10v20H7zM11 18h2',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9S9.5 5.7 12 3Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chevronDown: 'M6 9l6 6 6-6',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  close: 'M6 6l12 12M18 6 6 18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  // Scrap categories (icon names from the seed data).
  iron: 'M4 7h16M4 12h16M4 17h16M7 4v16M17 4v16',
  newspaper: 'M4 5h13v14H6a2 2 0 0 1-2-2V5ZM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12h7M7 15h4',
  bottle: 'M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3V2ZM8 12h8',
  carton: 'M3 8l9-4 9 4v9l-9 4-9-4V8ZM3 8l9 4 9-4M12 12v9',
  can: 'M7 5c0-1.1 2.2-2 5-2s5 .9 5 2v14c0 1.1-2.2 2-5 2s-5-.9-5-2V5ZM7 5c0 1.1 2.2 2 5 2s5-.9 5-2M7 9h10',
  device: 'M3 5h18v11H3zM8 20h8M12 16v4',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
