import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Category } from '../api/types';
import { Icon, type IconName } from './components';
import { body, borderWidth, cardShadow, colors, display, radius, tones } from './theme';

/*
 * Small v1 pieces shared by the household and collector screens (docs/version-1/design/README.md).
 * No animation; selection is a grey border.
 */

const CATEGORY_LOOK: Record<string, { icon: IconName; tint: string }> = {
  iron: { icon: 'tool', tint: '#E8ECF1' },
  newspaper: { icon: 'file-text', tint: '#FFF4D6' },
  bottle: { icon: 'droplet', tint: '#E3F2EC' },
  carton: { icon: 'package', tint: '#F3ECE2' },
  can: { icon: 'archive', tint: '#F1EAF6' },
  device: { icon: 'monitor', tint: '#E6EEF5' },
};

/** Icon and tile colour for a category, from its `icon` key. */
export function categoryLook(categories: Category[] | undefined, code: string): { icon: IconName; tint: string } {
  const key = categories?.find((c) => c.code === code)?.icon ?? '';
  return CATEGORY_LOOK[key] ?? { icon: 'box', tint: colors.ground };
}

/** Square tile with an icon on a soft tint (4 px corners). */
export function IconTile({ icon, tint = colors.ground, color = colors.ink, size = 40 }: { icon: IconName; tint?: string; color?: string; size?: number }) {
  return (
    <View style={[s.tile, { width: size, height: size, backgroundColor: tint }]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

export type BadgeTone = 'done' | 'warn' | 'alert' | 'neutral' | 'ink';

const BADGE: Record<BadgeTone, { bg: string; fg: string }> = {
  done: { bg: tones.doneBg, fg: colors.money },
  warn: { bg: '#FFF4D6', fg: '#8A5A00' },
  alert: { bg: '#FBEAE3', fg: colors.alert },
  neutral: { bg: tones.cancelledBg, fg: colors.muted },
  ink: { bg: '#E8ECF1', fg: colors.ink },
};

/** Small status tag (4 px corners). */
export function Badge({ label, tone = 'neutral', testID }: { label: string; tone?: BadgeTone; testID?: string }) {
  const c = BADGE[tone];
  return (
    <Text testID={testID} style={[body(12, 600), s.badge, { backgroundColor: c.bg, color: c.fg }]}>
      {label}
    </Text>
  );
}

/** Thin progress bar, `value` from 0 to 1. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={s.track} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[s.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

/** A tappable white card; selected shows the grey border. */
export function SelectCard({
  selected,
  onPress,
  children,
  style,
  role = 'button',
  disabled,
  testID,
  label,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  role?: 'button' | 'radio' | 'checkbox';
  disabled?: boolean;
  testID?: string;
  label?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'button' ? { selected, disabled: !!disabled } : { checked: selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.select, { borderColor: selected ? colors.selected : colors.line }, disabled && { opacity: 0.5 }, style]}
    >
      {children}
    </Pressable>
  );
}

/** Muted label above a group of fields or choices. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={[body(14, 500), { color: colors.muted }]}>{children}</Text>;
}

/** White card with a small label and a big number (totals). */
export function StatCard({ label, value, tone = 'ink', testID }: { label: string; value: string; tone?: 'ink' | 'money'; testID?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[body(13), { color: colors.muted }]}>{label}</Text>
      <Text testID={testID} style={[display(22), tone === 'money' && { color: colors.money }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** On/off switch without the platform's sliding animation: green when on, grey when off (6 px corners). */
export function Toggle({ value, onChange, label, testID }: { value: boolean; onChange: (next: boolean) => void; label: string; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={10}
      style={[s.toggle, { backgroundColor: value ? colors.money : tones.ring, justifyContent: value ? 'flex-end' : 'flex-start' }]}
    >
      <View style={s.knob} />
    </Pressable>
  );
}

/** Dashed "add" row (photo, item, address). */
export function DashedButton({ icon, title, sub, onPress, testID }: { icon: IconName; title: string; sub?: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={s.dashed}>
      <View style={s.dashedTile}>
        <Icon name={icon} size={20} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={body(15, 600)}>{title}</Text>
        {sub ? <Text style={[body(13), { color: colors.muted }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden', alignSelf: 'flex-start' },
  track: { height: 4, borderRadius: radius.sm, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm, backgroundColor: colors.ink },
  select: { borderRadius: radius.md, borderWidth, backgroundColor: colors.surface },
  stat: { flex: 1, gap: 2, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, ...cardShadow },
  toggle: { width: 50, height: 30, borderRadius: radius.md, padding: 4, flexDirection: 'row' },
  knob: { width: 22, height: 22, borderRadius: radius.sm, backgroundColor: colors.surface },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth,
    borderStyle: 'dashed',
    borderColor: tones.dashed,
  },
  dashedTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
