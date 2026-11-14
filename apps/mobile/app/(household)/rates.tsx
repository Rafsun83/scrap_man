import { formatTaka } from '@bw/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useCategories, useTodayRates } from '../../src/api/hooks';
import { rateRows, ratesPublished, type RateRow } from '../../src/household/RateBoard';
import { useT } from '../../src/i18n/lang';
import { formatLongDate, formatTime } from '../../src/lib/dhaka';
import { BackButton, Button, ErrorView, LoadingView, Note, Screen } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display, radius } from '../../src/ui/theme';

/** H12: every category's rate, the change from yesterday, and the rate-lock note. */
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

  const changeText = (r: RateRow) => {
    if (r.onInspection) return t('rateInspectionNote');
    if (r.change === null || r.ratePerKg === null) return '';
    if (r.change > 0) return t('rateUp', { amount: formatTaka(r.change, lang) });
    if (r.change < 0) return t('rateDown', { amount: formatTaka(-r.change, lang) });
    return t('rateSame');
  };

  return (
    <Screen
      footer={
        <Button
          label={t('sellScrap')}
          icon="tag"
          variant="dark"
          disabled={!published}
          onPress={() => router.push('/sell/items')}
        />
      }
    >
      <BackButton />
      <View style={s.board}>
        <View style={{ gap: 4 }}>
          <Text style={[display(34, 800), { lineHeight: 38 }]}>{t('todaysRates')}</Text>
          {rates.data.effectiveDate && rates.data.publishedAt ? (
            <Text style={body(15, 600)}>
              {t('ratesUpdated', {
                date: formatLongDate(rates.data.effectiveDate, lang),
                time: formatTime(rates.data.publishedAt, lang),
              })}
            </Text>
          ) : null}
          <Text style={body(14)}>{t('perKgTaka')}</Text>
        </View>
        {published ? (
          <View style={{ gap: 4 }}>
            {rows.map((r) => (
              <View key={r.code} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={body(18, 600)}>{r.name}</Text>
                  {changeText(r) ? <Text style={body(13)}>{changeText(r)}</Text> : null}
                </View>
                <Text style={display(24, 800)}>{r.price}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[body(16), { lineHeight: 24 }]}>{t('ratesNotPublished')}</Text>
        )}
      </View>
      <Note icon="lock" text={t('rateLockNote')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  board: {
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderTopWidth: 1, borderTopColor: colors.ink },
});
