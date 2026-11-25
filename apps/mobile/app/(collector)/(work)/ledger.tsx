import { PAYMENT_METHODS, formatKg, formatTaka, localDigits } from '@bw/shared';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories } from '../../../src/api/hooks';
import { useLedger } from '../../../src/collector/api';
import { rangeFor, type LedgerRange } from '../../../src/collector/ledgerRange';
import { StatTile, cs } from '../../../src/collector/ui';
import { useT } from '../../../src/i18n/lang';
import { formatTime } from '../../../src/lib/dhaka';
import { categoryName } from '../../../src/lib/format';
import { Chip, Divider, EmptyView, ErrorView, LoadingView } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { body, borderWidth, colors, display, radius } from '../../../src/ui/theme';

const RANGES: { key: LedgerRange; label: 'today' | 'rangeWeek' | 'rangeMonth' }[] = [
  { key: 'TODAY', label: 'today' },
  { key: 'WEEK', label: 'rangeWeek' },
  { key: 'MONTH', label: 'rangeMonth' },
];

/** C9 (v1 design `collector/CLedger.dc.html`): paid out, kg collected and pickups for today, this week or this month, by item and by method, and each payment. */
export default function LedgerScreen() {
  const { t, lang } = useT();
  const [range, setRange] = useState<LedgerRange>('TODAY');
  const { from, to } = rangeFor(range);
  const ledger = useLedger(from, to);
  const categories = useCategories();
  const data = ledger.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={ledger.isRefetching} onRefresh={() => void ledger.refetch()} />}
      >
        <View style={s.header}>
          <Text style={[display(24), { lineHeight: 30 }]}>{t('cTabLedger')}</Text>
          <View style={s.chips}>
            {RANGES.map((r) => (
              <Chip key={r.key} label={t(r.label)} selected={range === r.key} onPress={() => setRange(r.key)} />
            ))}
          </View>
          <View style={s.stats}>
            <StatTile testID="ledger-paid" value={formatTaka(data?.totalPaid ?? 0, lang)} label={t('totalPaid')} tone="money" />
            <StatTile value={formatKg(data?.totalKg ?? 0, lang)} label={t('collected')} />
            <StatTile value={localDigits(data?.pickupCount ?? 0, lang)} label={t('pickupsLabel')} />
          </View>
        </View>

        <View style={s.body}>
          {ledger.isPending ? (
            <LoadingView />
          ) : ledger.isError ? (
            <ErrorView message={errorMessage(ledger.error, lang)} onRetry={() => ledger.refetch()} />
          ) : !data || data.pickupCount === 0 ? (
            <EmptyView title={t('ledgerEmpty')} />
          ) : (
            <>
              <Text style={cs.sectionTitle}>{t('collectedByItem')}</Text>
              <View style={cs.section}>
                {data.byCategory.map((c) => {
                  const max = Math.max(...data.byCategory.map((x) => x.kg), 1);
                  return (
                    <View key={c.categoryCode} style={s.barRow}>
                      <Text style={[body(14), s.barName]} numberOfLines={1}>
                        {categoryName(categories.data, c.categoryCode, lang)}
                      </Text>
                      <View style={s.track}>
                        <View style={[s.fill, { width: `${Math.round((c.kg / max) * 100)}%` }]} />
                      </View>
                      <Text style={[body(14, 600), s.barKg]}>{formatKg(c.kg, lang)}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={s.methods}>
                {PAYMENT_METHODS.filter((m) => (data.byMethod[m] ?? 0) > 0).map((m) => (
                  <Text key={m} style={[body(13, 600), s.method]}>
                    {t(`byMethod_${m}`, { amount: formatTaka(data.byMethod[m] ?? 0, lang) })}
                  </Text>
                ))}
              </View>

              <Text style={cs.sectionTitle}>{t('paymentsTitle')}</Text>
              <View style={cs.section}>
                {data.payments.map((p, i) => {
                  const vars = { time: formatTime(p.paidAt, lang), method: t(`pay_${p.method}`) };
                  return (
                    <View key={p.pickupId} testID={`payment-${p.pickupId}`}>
                      {i > 0 ? <Divider /> : null}
                      <View style={s.row}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={body(15, 600)}>{p.householdName || t('customerFallback')}</Text>
                          <Text style={[body(13), { color: colors.muted }]}>
                            {p.trxId ? t('paymentMetaTrx', { ...vars, trx: p.trxId }) : t('paymentMeta', vars)}
                          </Text>
                        </View>
                        <Text style={display(16)}>{formatTaka(p.amount, lang)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 14 },
  chips: { flexDirection: 'row', gap: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  body: { padding: 20, gap: 16, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  barName: { width: 110 },
  barKg: { width: 72, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: radius.sm, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm, backgroundColor: colors.ink },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, borderWidth, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
});
