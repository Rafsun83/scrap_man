import { formatKg, formatTaka, localDigits, type Lang } from '@bw/shared';
import { StyleSheet, Text, View } from 'react-native';
import type { Category, Pickup, PickupLine } from '../../api/types';
import { useT } from '../../i18n/lang';
import { formatDate, relativeDay } from '../../lib/dhaka';
import { categoryName } from '../../lib/format';
import { Divider, Icon } from '../../ui/components';
import { body, colors, display } from '../../ui/theme';

/** "আজ, সকাল ৯টা–১২টা" for a pickup's booked slot. */
export function useSlotLabel() {
  const { t, lang } = useT();
  return (p: Pick<Pickup, 'slotDate' | 'slot'>) => {
    const rel = relativeDay(p.slotDate, lang);
    const date = rel === 'today' ? t('today') : rel === 'tomorrow' ? t('tomorrow') : formatDate(p.slotDate, lang);
    return t('dateSlot', { date, slot: t(`slot_${p.slot}`) });
  };
}

export function collectorName(p: Pick<Pickup, 'collector'>, fallback: string): string {
  return p.collector?.name?.trim() || fallback;
}

/** The kg × rate breakdown used on H7, the disputed view and H8. */
export function WeighLines({ lines, categories }: { lines: PickupLine[]; categories: Category[] | undefined }) {
  const { t, lang } = useT();
  return (
    <View>
      {lines.map((l, i) => (
        <View key={l.categoryCode}>
          {i > 0 ? <Divider /> : null}
          <View style={s.line}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={body(16, 700)}>{categoryName(categories, l.categoryCode, lang)}</Text>
              <Text style={[body(14), { color: colors.muted }]}>{lineDetail(l, lang, t)}</Text>
            </View>
            <Text style={display(19)}>{formatTaka(l.amount, lang)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function lineDetail(
  l: PickupLine,
  lang: Lang,
  t: (key: 'lineKgRate' | 'lineQuoted', vars: Record<string, string>) => string,
): string {
  return l.rate === null || l.rate === undefined
    ? t('lineQuoted', { kg: formatKg(l.kg, lang) })
    : t('lineKgRate', { kg: formatKg(l.kg, lang), rate: formatTaka(l.rate, lang) });
}

/** Big navy totals card: total kg and amount. */
export function TotalsCard({ totalKg, totalAmount }: { totalKg: number; totalAmount: number }) {
  const { t, lang } = useT();
  return (
    <View style={s.totals} accessibilityLabel={t('totals')}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[body(14), { color: '#D3DCE5' }]}>{t('totalWeight')}</Text>
        <Text style={[display(32, 800), { color: colors.signal }]}>{formatKg(totalKg, lang)}</Text>
      </View>
      <View style={{ flex: 1, gap: 4, alignItems: 'flex-end' }}>
        <Text style={[body(14), { color: '#D3DCE5' }]}>{t('youGet')}</Text>
        <Text testID="total-amount" style={[display(32, 800), { color: colors.signal }]}>
          {formatTaka(totalAmount, lang)}
        </Text>
      </View>
    </View>
  );
}

/** A row with an icon and text (request summary on H5). */
export function InfoRow({ icon, text, last }: { icon: 'package' | 'clock' | 'map-pin'; text: string; last?: boolean }) {
  return (
    <View style={[s.info, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      <Icon name={icon} size={20} />
      <Text style={[body(15, 600), { flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function digits(n: number, lang: Lang) {
  return localDigits(n, lang);
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  totals: { flexDirection: 'row', gap: 12, backgroundColor: colors.ink, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
