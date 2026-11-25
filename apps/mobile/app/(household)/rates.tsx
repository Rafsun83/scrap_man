import { formatTaka } from '@bw/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useCategories, useTodayRates } from '../../src/api/hooks';
import { rateRows, ratesPublished, type RateRow } from '../../src/household/RateBoard';
import { useT } from '../../src/i18n/lang';
import { formatLongDate, formatTime } from '../../src/lib/dhaka';
import { BackButton, Button, Card, Divider, ErrorView, LoadingView, Note, Screen } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { Badge, categoryLook, IconTile } from '../../src/ui/parts';
import { body, colors, display } from '../../src/ui/theme';

/** H12 (v1 design `household/Rates.dc.html`): every category's rate, the change from yesterday, and the rate-lock note. */
export default function Rates() {
  const { t, lang } = useT();
  const router = useRouter();
  const categories = useCategories();
  const rates = useTodayRates();

  if (categories.isPending || rates.isPending) return <LoadingView />;
  if (categories.isError || rates.isError) {
    return <ErrorView message={errorMessage(categories.error ?? rates.error, lang)} onRetry={() => rates.refetch()} />;
  }

  const rows = rateRows(categories.data, rates.data.rates, lang, t('onInspection'));
  const published = ratesPublished(rows);

  const change = (r: RateRow): { label: string; tone: 'done' | 'alert' | 'neutral' } | null => {
    if (r.onInspection) return { label: t('rateInspectionNote'), tone: 'neutral' };
    if (r.change === null || r.ratePerKg === null) return null;
    if (r.change > 0) return { label: `▲ ${t('rateUp', { amount: formatTaka(r.change, lang) })}`, tone: 'done' };
    if (r.change < 0) return { label: `▼ ${t('rateDown', { amount: formatTaka(-r.change, lang) })}`, tone: 'alert' };
    return { label: t('rateSame'), tone: 'neutral' };
  };

  return (
    <Screen
      footer={
        <Button label={t('sellScrap')} icon="plus" variant="key" disabled={!published} onPress={() => router.push('/sell/items')} />
      }
    >
      <BackButton />
      <View style={{ gap: 2 }}>
        <Text style={[display(26), { lineHeight: 32 }]}>{t('todaysRates')}</Text>
        {rates.data.effectiveDate && rates.data.publishedAt ? (
          <Text style={[body(13), { color: colors.muted }]}>
            {t('ratesUpdated', { date: formatLongDate(rates.data.effectiveDate, lang), time: formatTime(rates.data.publishedAt, lang) })}
          </Text>
        ) : null}
      </View>

      {published ? (
        <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
          <View style={s.head}>
            <Text style={[body(13), { color: colors.muted }]}>{t('perKgTaka')}</Text>
          </View>
          {rows.map((r, i) => {
            const look = categoryLook(categories.data, r.code);
            const tag = change(r);
            return (
              <View key={r.code}>
                {i > 0 ? <Divider /> : null}
                <View style={s.row}>
                  <IconTile icon={look.icon} tint={look.tint} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={body(16, 600)}>{r.name}</Text>
                    {tag ? <Badge label={tag.label} tone={tag.tone} /> : null}
                  </View>
                  <Text style={r.onInspection ? [body(15, 600), { color: colors.muted }] : display(20)}>{r.price}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      ) : (
        <Card style={{ padding: 16 }}>
          <Text style={[body(15), { color: colors.muted, lineHeight: 22 }]}>{t('ratesNotPublished')}</Text>
        </Card>
      )}
      <Note icon="lock" text={t('rateLockNote')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
});
