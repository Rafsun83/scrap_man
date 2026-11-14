import { formatKg, formatTaka } from '@bw/shared';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCategories, useDefaultAddress, useMyPickups, useTodayRates } from '../../../src/api/hooks';
import { useSession } from '../../../src/auth/session';
import { rateRows, ratesPublished } from '../../../src/household/RateBoard';
import { useT } from '../../../src/i18n/lang';
import { formatDate, greetingKey } from '../../../src/lib/dhaka';
import { categoryNames } from '../../../src/lib/format';
import { Button, Card, Divider, ErrorView, Icon, LoadingView, Screen } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { body, colors, display, minTouch, radius, tones } from '../../../src/ui/theme';

/** H2: greeting, today's rate board, the big "sell scrap" action, active pickup, recent sales. */
export default function Home() {
  const { t, lang } = useT();
  const router = useRouter();
  const { user } = useSession();
  const categories = useCategories();
  const rates = useTodayRates();
  const { address } = useDefaultAddress();
  const active = useMyPickups('ACTIVE', 1);
  const recent = useMyPickups('COMPLETED', 3);

  const greeting = t(greetingKey());
  const title = user?.name ? t('greetName', { greeting, name: user.name }) : greeting;

  if (categories.isPending || rates.isPending) return <LoadingView />;
  if (categories.isError || rates.isError) {
    return (
      <ErrorView
        message={errorMessage(categories.error ?? rates.error, lang)}
        onRetry={() => {
          categories.refetch();
          rates.refetch();
        }}
      />
    );
  }

  const rows = rateRows(categories.data, rates.data.rates, lang, t('onInspection'));
  const published = ratesPublished(rows);
  const boardRows = rows.filter((r) => !r.onInspection && r.ratePerKg !== null).slice(0, 5);
  const activePickup = active.data?.items?.[0];

  return (
    <Screen edges={['top']}>
      <View style={{ gap: 4 }}>
        <Text style={[display(26), { lineHeight: 32 }]}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push(address ? '/profile' : '/address')} style={s.place}>
          <Icon name="map-pin" size={18} />
          <Text style={body(16)}>{address ? address.area : t('noAddressYet')}</Text>
          <Icon name="chevron-down" size={16} />
        </Pressable>
      </View>

      {activePickup ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/pickup/${activePickup.id}`)}
          style={s.activeBanner}
        >
          <Icon name="truck" size={24} />
          <View style={{ flex: 1 }}>
            <Text style={body(16, 700)}>{t('activePickup')}</Text>
            <Text style={body(14)}>
              {categoryNames(categories.data, activePickup.categoryCodes, lang)} · {t(`status_${activePickup.status}`)}
            </Text>
          </View>
          <Text style={body(15, 700)}>{t('activePickupOpen')}</Text>
          <Icon name="chevron-right" size={20} />
        </Pressable>
      ) : null}

      <View style={s.board} accessibilityLabel={t('todaysRates')}>
        <View style={s.boardHead}>
          <Text style={[display(30, 800), { lineHeight: 34 }]}>{t('todaysRates')}</Text>
          {rates.data.effectiveDate ? <Text style={body(15, 600)}>{formatDate(rates.data.effectiveDate, lang)}</Text> : null}
        </View>
        {published ? (
          <>
            <Text style={[body(14), { marginTop: -6 }]}>{t('perKgTaka')}</Text>
            <View style={{ gap: 8, marginTop: 4 }}>
              {boardRows.map((r) => (
                <View key={r.code} style={s.rateRow}>
                  <Text style={body(18, 500)}>{r.name}</Text>
                  <View style={s.dots} />
                  <Text style={display(21)}>{r.price}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={[body(16), { lineHeight: 24 }]}>{t('ratesNotPublished')}</Text>
        )}
        <Link href="/rates" asChild>
          <Pressable accessibilityRole="link" style={s.allRates}>
            <Icon name="list" size={18} />
            <Text style={[body(16, 600), { textDecorationLine: 'underline' }]}>{t('seeAllRates')}</Text>
          </Pressable>
        </Link>
      </View>

      <Pressable
        testID="sell-scrap"
        accessibilityRole="button"
        accessibilityState={{ disabled: !published }}
        disabled={!published}
        onPress={() => router.push('/sell/items')}
        style={[s.sell, !published && { opacity: 0.55 }]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[display(23), { color: colors.surface }]}>{t('sellScrap')}</Text>
          <Text style={[body(15), { color: tones.ink200 }]}>{t('sellScrapSub')}</Text>
        </View>
        <View style={s.sellArrow}>
          <Icon name="arrow-right" size={24} />
        </View>
      </Pressable>

      <View style={{ gap: 6 }}>
        <Text style={display(20)}>{t('recentSales')}</Text>
        {recent.isPending ? (
          <LoadingView />
        ) : recent.isError ? (
          <Button label={t('retry')} icon="refresh-cw" variant="outline" onPress={() => recent.refetch()} />
        ) : recent.data.items?.length ? (
          <Card>
            {recent.data.items.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable accessibilityRole="button" onPress={() => router.push(`/pickup/${p.id}`)} style={s.saleRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={body(16, 600)}>{categoryNames(categories.data, p.categoryCodes, lang)}</Text>
                    <Text style={[body(14), { color: colors.muted }]}>
                      {t('historyMeta', {
                        date: formatDate(p.completedAt ?? p.requestedAt, lang),
                        kg: p.totalKg != null ? formatKg(p.totalKg, lang) : '–',
                      })}
                    </Text>
                  </View>
                  <Text style={[display(19), { color: colors.money }]}>
                    {p.totalAmount != null ? formatTaka(p.totalAmount, lang) : ''}
                  </Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Card style={{ padding: 16 }}>
            <Text style={[body(15), { color: colors.muted }]}>{t('noRecentSales')}</Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  place: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: minTouch, alignSelf: 'flex-start' },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.selectedTint,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  board: {
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 10,
  },
  boardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dots: { flex: 1, borderBottomWidth: 2, borderStyle: 'dotted', borderColor: colors.ink, transform: [{ translateY: -5 }] },
  allRates: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: minTouch, alignSelf: 'flex-start' },
  sell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 84,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  sellArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: minTouch },
});
