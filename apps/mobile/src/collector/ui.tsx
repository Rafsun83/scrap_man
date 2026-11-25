import { MAX_WORK_AREAS, VEHICLE_TYPES, WORK_AREAS, localDigits, type Lang } from '@bw/shared';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VehicleType, WorkArea } from '../api/types';
import { useT } from '../i18n/lang';
import { Chip, Icon } from '../ui/components';
import { SelectCard } from '../ui/parts';
import { body, borderWidth, cardShadow, colors, display, minTouch, radius, tones } from '../ui/theme';

/** Light page header for collector screens (C1, C3, C4, C10, C5, C9): optional back, title, muted sub, a right slot. */
export function PageHeader({ title, sub, back, right, children }: { title: string; sub?: string; back?: boolean; right?: ReactNode; children?: ReactNode }) {
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
          <Icon name="chevron-left" size={24} />
          <Text style={body(15, 600)}>{t('back')}</Text>
        </Pressable>
      ) : null}
      <View style={s.titleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[display(24), { lineHeight: 30 }]}>{title}</Text>
          {sub ? <Text style={[body(14), { color: colors.muted }]}>{sub}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** White card with a big number and a small label (C1 today's totals, C9 totals). */
export function StatTile({ value, label, testID, tone = 'ink' }: { value: string; label: string; testID?: string; tone?: 'ink' | 'money' }) {
  return (
    <View style={s.stat}>
      <Text testID={testID} style={[display(20), tone === 'money' && { color: colors.money }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[body(12), { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

/** Small tag: an item on a request card; `signal` marks something to notice (yellow tint). */
export function Tag({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'signal' }) {
  return (
    <Text style={[body(13, tone === 'signal' ? 600 : 400), s.tag, tone === 'signal' && { backgroundColor: '#FFF4D6', color: '#8A5A00' }]}>{label}</Text>
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
    <View style={s.vehicles} accessibilityRole="radiogroup" accessibilityLabel={t('vehicleLabel')}>
      {VEHICLE_TYPES.map((v) => (
        <SelectCard key={v} testID={`vehicle-${v}`} role="radio" selected={value === v} onPress={() => onChange(v)} style={s.vehicle}>
          <Text style={body(15, value === v ? 600 : 500)}>{t(`vehicle_${v}`)}</Text>
        </SelectCard>
      ))}
    </View>
  );
}

/** A tick box row with a 48 px target (scale, agreement). */
export function CheckRow({ label, checked, onPress, testID }: { label: string; checked: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={s.check}>
      <View style={[s.box, checked && { backgroundColor: colors.muted, borderColor: colors.muted }]}>
        {checked ? <Icon name="check" size={18} color={colors.surface} /> : null}
      </View>
      <Text style={[body(15, 500), { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

/** Label and value on one row (C11 work details, C2 time and weight). */
export function KeyValue({ label, value, action, last }: { label: string; value: string; action?: ReactNode; last?: boolean }) {
  return (
    <View style={[s.kv, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[body(13), { color: colors.muted }]}>{label}</Text>
        <Text style={body(15, 600)}>{value}</Text>
      </View>
      {action}
    </View>
  );
}

export const cs = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 4, ...cardShadow },
  sectionTitle: { ...body(14, 500), color: colors.muted, marginBottom: -6 },
});

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: minTouch, alignSelf: 'flex-start', marginLeft: -4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { flex: 1, gap: 2, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surface, ...cardShadow },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.ground, overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vehicles: { flexDirection: 'row', gap: 8 },
  vehicle: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  box: { width: 26, height: 26, borderRadius: radius.sm, borderWidth, borderColor: tones.dashed, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  kv: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
