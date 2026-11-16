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
import { body, colors, display } from '../../../src/ui/theme';

const RANGES: { key: LedgerRange; label: 'today' | 'rangeWeek' | 'rangeMonth' }[] = [
  { key: 'TODAY', label: 'today' },
  { key: 'WEEK', label: 'rangeWeek' },
  { key: 'MONTH', label: 'rangeMonth' },
];

/** C9: paid out, kg collected and pickups for today, this week or this month, by item and by method, and each payment. */
export default function LedgerScreen() {
  const { t, lang } = useT();
  const [range, setRange] = useState<LedgerRange>('TODAY');
  const { from, to } = rangeFor(range);
  const ledger = useLedger(from, to);
  const categories = useCategories();
  const data = ledger.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }} edges={['top']}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={ledger.isRefetching} onRefresh={() => void ledger.refetch()} />}
      >
        <View style={s.header}>
          <Text style={[display(28), { color: colors.surface }]}>{t('cTabLedger')}</Text>
          <View style={s.chips}>
            {RANGES.map((r) => (
              <Chip key={r.key} label={t(r.label)} selected={range === r.key} onPress={() => setRange(r.key)} />
            ))}
          </View>
          <View style={s.stats}>
            <StatTile testID="ledger-paid" value={formatTaka(data?.totalPaid ?? 0, lang)} label={t('totalPaid')} />
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
                {data.byCategory.map((c, i) => (
                  <View key={c.categoryCode}>
                    {i > 0 ? <Divider /> : null}
                    <View style={s.row}>
                      <Text style={[body(16, 600), { flex: 1 }]}>{categoryName(categories.data, c.categoryCode, lang)}</Text>
                      <Text style={body(16, 700)}>{formatKg(c.kg, lang)}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={s.methods}>
                {PAYMENT_METHODS.filter((m) => (data.byMethod[m] ?? 0) > 0).map((m) => (
                  <Text key={m} style={[body(14, 700), s.method]}>
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
                          <Text style={body(16, 700)}>{p.householdName || t('customerFallback')}</Text>
                          <Text style={[body(13), { color: colors.muted }]}>
                            {p.trxId ? t('paymentMetaTrx', { ...vars, trx: p.trxId }) : t('paymentMeta', vars)}
                          </Text>
                        </View>
                        <Text style={[display(19), { color: colors.money }]}>{formatTaka(p.amount, lang)}</Text>
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
  header: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, gap: 14 },
  chips: { flexDirection: 'row', gap: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  body: { padding: 20, gap: 16, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, overflow: 'hidden' },
});
