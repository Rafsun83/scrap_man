import { MAX_WORK_AREAS, VEHICLE_TYPES, WORK_AREAS, localDigits, type Lang } from '@bw/shared';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VehicleType, WorkArea } from '../api/types';
import { useT } from '../i18n/lang';
import { Chip, Icon, RadioRow } from '../ui/components';
import { body, colors, display, minTouch, radius, tones } from '../ui/theme';

/** Navy panel at the top of collector screens (C1, C4, C10, C5), with an optional back action. */
export function NavyHeader({ title, sub, back, right, children }: { title: string; sub?: string; back?: boolean; right?: ReactNode; children?: ReactNode }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <View style={s.header}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/requests'))}
          style={s.back}
          hitSlop={8}
        >
          <Icon name="arrow-left" size={24} color={colors.surface} />
          <Text style={[body(15, 600), { color: colors.surface }]}>{t('back')}</Text>
        </Pressable>
      ) : null}
      <View style={s.titleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[display(26), { color: colors.surface, lineHeight: 32 }]}>{title}</Text>
          {sub ? <Text style={[body(15), { color: tones.ink200 }]}>{sub}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Yellow number on navy (C1 today's totals, C9 totals). */
export function StatTile({ value, label, testID }: { value: string; label: string; testID?: string }) {
  return (
    <View style={s.stat}>
      <Text testID={testID} style={[display(22), { color: colors.signal }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[body(13), { color: tones.ink200 }]}>{label}</Text>
    </View>
  );
}

/** Small grey pill: an item on a request card. */
export function Tag({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'signal' }) {
  return (
    <Text style={[body(14, tone === 'signal' ? 700 : 400), s.tag, tone === 'signal' && { backgroundColor: colors.signal }]}>{label}</Text>
  );
}

export function workAreaName(code: string, lang: Lang): string {
  const area = WORK_AREAS.find((a) => a.code === code);
  return area ? area[lang] : code;
}

export function workAreaNames(codes: string[], lang: Lang): string {
  return codes.map((c) => workAreaName(c, lang)).join(', ');
}

/** C6 and the work-details editor: area chips, up to 10. */
export function WorkAreaPicker({ value, onChange }: { value: WorkArea[]; onChange: (next: WorkArea[]) => void }) {
  const { t, lang } = useT();
  const toggle = (code: WorkArea) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : value.length < MAX_WORK_AREAS ? [...value, code] : value);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[body(13), { color: colors.muted }]}>{t('workAreasHint', { count: localDigits(MAX_WORK_AREAS, lang) })}</Text>
      <View style={s.wrap} accessibilityLabel={t('workAreasLabel')}>
        {WORK_AREAS.map((a) => (
          <Chip key={a.code} label={a[lang]} selected={value.includes(a.code)} onPress={() => toggle(a.code)} />
        ))}
      </View>
    </View>
  );
}

export function VehiclePicker({ value, onChange }: { value: VehicleType | null; onChange: (v: VehicleType) => void }) {
  const { t } = useT();
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t('vehicleLabel')}>
      {VEHICLE_TYPES.map((v) => (
        <RadioRow key={v} testID={`vehicle-${v}`} label={t(`vehicle_${v}`)} selected={value === v} onPress={() => onChange(v)} />
      ))}
    </View>
  );
}

/** A tick box row with a 48 px target (scale, agreement). */
export function CheckRow({ label, checked, onPress, testID }: { label: string; checked: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={s.check}>
      <View style={[s.box, checked && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
        {checked ? <Icon name="check" size={18} color={colors.signal} /> : null}
      </View>
      <Text style={[body(16, 600), { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

/** Label and value on one row (C11 work details, C2 time and weight). */
export function KeyValue({ label, value, action, last }: { label: string; value: string; action?: ReactNode; last?: boolean }) {
  return (
    <View style={[s.kv, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[body(14), { color: colors.muted }]}>{label}</Text>
        <Text style={body(16, 700)}>{value}</Text>
      </View>
      {action}
    </View>
  );
}

export const cs = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 4 },
  sectionTitle: { ...display(19), marginBottom: -6 },
});

const s = StyleSheet.create({
  header: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, gap: 14 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: minTouch, alignSelf: 'flex-start', marginLeft: -4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#1E4466' },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.ground, overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: tones.dashed, alignItems: 'center', justifyContent: 'center' },
  kv: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
