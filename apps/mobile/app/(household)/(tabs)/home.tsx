import { formatKg, formatTaka, localDigits } from '@bw/shared';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCategories, useDefaultAddress, useMyPickups, useNotifications, useTodayRates } from '../../../src/api/hooks';
import { useSession } from '../../../src/auth/session';
import { rateChangeTag, rateRows, ratesPublished } from '../../../src/household/RateBoard';
import { useT } from '../../../src/i18n/lang';
import { formatDate, formatLongDate, greetingKey } from '../../../src/lib/dhaka';
import { categoryNames } from '../../../src/lib/format';
import { Button, Card, Divider, ErrorView, Icon, LoadingView, Screen } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { Badge, categoryLook, IconTile } from '../../../src/ui/parts';
import { body, cardShadow, colors, display, minTouch, radius, tones } from '../../../src/ui/theme';

/** H2 (v1 design `household/Home.dc.html`): greeting, the sell card, today's rate tiles, active pickup, recent sales. */
export default function Home() {
  const { t, lang } = useT();
  const router = useRouter();
  const { user } = useSession();
  const categories = useCategories();
  const rates = useTodayRates();
  const { address } = useDefaultAddress();
  const active = useMyPickups('ACTIVE', 1);
  const recent = useMyPickups('COMPLETED', 3);
  const feed = useNotifications();
  const unread = feed.data?.pages[0]?.unreadCount ?? 0;

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
  const tiles = rows.filter((r) => !r.onInspection && r.ratePerKg !== null).slice(0, 4);
  const activePickup = active.data?.items?.[0];

  return (
    <Screen edges={['top']} style={{ gap: 22 }}>
      <View style={s.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[body(14), { color: colors.muted }]}>{user?.name ? `${t(greetingKey())},` : t(greetingKey())}</Text>
          {user?.name ? <Text style={[display(24), { lineHeight: 30 }]}>{user.name}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => router.push(address ? '/profile' : '/address')} style={s.place}>
            <Icon name="map-pin" size={16} color={colors.muted} />
            <Text style={[body(14), { color: colors.muted }]}>{address ? address.area : t('noAddressYet')}</Text>
            <Icon name="chevron-down" size={14} color={colors.muted} />
          </Pressable>
        </View>
        <Pressable
          testID="bell"
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `${t('notifications')}, ${t('unreadCount', { count: localDigits(unread, lang) })}` : t('notifications')}
          onPress={() => router.push('/notifications')}
          style={s.bell}
        >
          <Icon name="bell" size={22} />
          {unread > 0 ? <View style={s.dot} /> : null}
        </Pressable>
      </View>

      <View style={s.hero}>
        <View style={{ gap: 6 }}>
          <Text style={[body(13), { color: '#B9C6D2' }]}>{formatLongDate(rates.data.effectiveDate ?? new Date(), lang)}</Text>
          <Text style={[display(22), { color: colors.surface, lineHeight: 30 }]}>{t('homeHeroTitle')}</Text>
        </View>
        <Button
          testID="sell-scrap"
          label={t('sellScrap')}
          icon="plus"
          variant="key"
          disabled={!published}
          onPress={() => router.push('/sell/items')}
        />
      </View>

      {activePickup ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/pickup/${activePickup.id}`)} style={s.active}>
          <IconTile icon="truck" tint="#FFF4D6" />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={body(15, 600)}>{t('activePickup')}</Text>
            <Text style={[body(13), { color: colors.muted }]} numberOfLines={1}>
              {categoryNames(categories.data, activePickup.categoryCodes, lang)} · {t(`status_${activePickup.status}`)}
            </Text>
          </View>
          <Text style={body(14, 600)}>{t('activePickupOpen')}</Text>
          <Icon name="chevron-right" size={18} />
        </Pressable>
      ) : null}

      <View style={{ gap: 12 }} accessibilityLabel={t('todaysRates')}>
        <View style={s.sectionHead}>
          <Text style={display(18)}>{t('todaysRates')}</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/rates')} style={s.seeAll}>
            <Text style={body(14, 600)}>{t('seeAll')}</Text>
          </Pressable>
        </View>
        {published ? (
          <View style={s.grid}>
            {tiles.map((r) => {
              const look = categoryLook(categories.data, r.code);
              const tag = rateChangeTag(r, lang);
              return (
                <View key={r.code} style={s.tile}>
                  <View style={s.tileTop}>
                    <IconTile icon={look.icon} tint={look.tint} size={36} />
                    {tag ? <Badge label={tag.label} tone={tag.tone} /> : null}
                  </View>
                  <View style={{ gap: 1 }}>
                    <Text style={[body(14), { color: colors.muted }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text>
                      <Text style={display(22)}>{r.price}</Text>
                      <Text style={[body(13), { color: colors.muted }]}> {t('perKgSuffix')}</Text>
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Card style={{ padding: 16 }}>
            <Text style={[body(15), { color: colors.muted, lineHeight: 22 }]}>{t('ratesNotPublished')}</Text>
          </Card>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <Text style={display(18)}>{t('recentSales')}</Text>
        {recent.isPending ? (
          <LoadingView />
        ) : recent.isError ? (
          <Button label={t('retry')} icon="refresh-cw" variant="outline" onPress={() => recent.refetch()} />
        ) : recent.data.items?.length ? (
          <Card style={{ paddingVertical: 0 }}>
            {recent.data.items.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable accessibilityRole="button" onPress={() => router.push(`/pickup/${p.id}`)} style={s.saleRow}>
                  <IconTile icon="check" tint={tones.doneBg} color={colors.money} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={body(15, 600)} numberOfLines={1}>
                      {categoryNames(categories.data, p.categoryCodes, lang)}
                    </Text>
                    <Text style={[body(13), { color: colors.muted }]}>
                      {t('historyMeta', {
                        date: formatDate(p.completedAt ?? p.requestedAt, lang),
                        kg: p.totalKg != null ? formatKg(p.totalKg, lang) : '–',
                      })}
                    </Text>
                  </View>
                  <Text style={[display(18), { color: colors.money }]}>
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' },
  bell: {
    width: minTouch,
    height: minTouch,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  dot: {
    position: 'absolute',
    top: 12,
    right: 13,
    width: 10,
    height: 10,
    borderRadius: radius.round,
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  hero: { backgroundColor: colors.ink, borderRadius: radius.md, padding: 20, gap: 18 },
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.selected,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { minHeight: minTouch, justifyContent: 'center', paddingLeft: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', flexGrow: 1, gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, ...cardShadow },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: minTouch },
});
