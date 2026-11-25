import { formatKg, formatTaka } from '@bw/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories, useMyPickupPages, useMyPickups } from '../../../src/api/hooks';
import type { Pickup } from '../../../src/api/types';
import { splitActive } from '../../../src/collector/collectorView';
import { useSlotLabel } from '../../../src/household/pickup/shared';
import { useT } from '../../../src/i18n/lang';
import { dhakaToday, formatDate } from '../../../src/lib/dhaka';
import { categoryNames } from '../../../src/lib/format';
import { badgeTone } from '../../../src/lib/pickupView';
import { Button, Chip, EmptyView, ErrorView, LoadingView } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { body, cardShadow, colors, display, radius } from '../../../src/ui/theme';
import { Badge, type BadgeTone } from '../../../src/ui/parts';

type Tab = 'TODAY' | 'UPCOMING' | 'PAST';

const TABS: { key: Tab; label: 'today' | 'tabUpcoming' | 'tabPast'; empty: 'emptyToday' | 'emptyUpcoming' | 'emptyPast' }[] = [
  { key: 'TODAY', label: 'today', empty: 'emptyToday' },
  { key: 'UPCOMING', label: 'tabUpcoming', empty: 'emptyUpcoming' },
  { key: 'PAST', label: 'tabPast', empty: 'emptyPast' },
];

const BADGE: Record<'done' | 'cancelled' | 'active', BadgeTone> = { done: 'done', cancelled: 'neutral', active: 'warn' };

/** C8 (v1 design `collector/CPickups.dc.html`): today's and upcoming assigned pickups (active), and past ones with cursor paging. */
export default function Jobs() {
  const { t, lang } = useT();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('TODAY');
  const categories = useCategories();
  const slotLabel = useSlotLabel();
  const active = useMyPickups('ACTIVE', 50);
  const past = useMyPickupPages('PAST');
  const split = splitActive(active.data?.items ?? [], dhakaToday());
  const isPast = tab === 'PAST';
  const query = isPast ? past : active;
  const items: Pickup[] = isPast ? (past.data?.pages.flatMap((p) => p.items ?? []) ?? []) : tab === 'TODAY' ? split.today : split.upcoming;
  const current = TABS.find((x) => x.key === tab)!;

  const renderItem = ({ item: p }: { item: Pickup }) => {
    const kind = badgeTone(p.status);
    const tone = BADGE[kind];
    const meta =
      p.status === 'COMPLETED' && p.totalKg != null
        ? `${formatDate(p.completedAt ?? p.slotDate, lang)} · ${formatKg(p.totalKg, lang)}`
        : `${p.area} · ${slotLabel(p)}`;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/job/${p.id}`)}
        style={[s.row, kind === 'active' && s.rowActive]}
        testID={`job-${p.id}`}
      >
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          <Text style={body(15, 600)}>{p.household.name || p.area}</Text>
          <Text style={[body(13), { color: colors.muted }]} numberOfLines={1}>
            {categoryNames(categories.data, p.categoryCodes, lang)}
          </Text>
          <Text style={[body(13), { color: colors.muted }]}>{meta}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Badge label={t(`status_${p.status}`)} tone={tone} />
          {p.status === 'COMPLETED' && p.totalAmount != null ? (
            <Text style={[display(16), { color: colors.money }]}>{formatTaka(p.totalAmount, lang)}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Text style={[display(24), { lineHeight: 30 }]}>{t('cTabJobs')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t('filters')}>
          {TABS.map((x) => (
            <Chip key={x.key} label={t(x.label)} selected={tab === x.key} onPress={() => setTab(x.key)} />
          ))}
        </ScrollView>
      </View>
      {query.isPending ? (
        <LoadingView />
      ) : query.isError ? (
        <ErrorView message={errorMessage(query.error, lang)} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          onRefresh={() => query.refetch()}
          refreshing={query.isRefetching && !past.isFetchingNextPage}
          onEndReached={() => isPast && past.hasNextPage && !past.isFetchingNextPage && past.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyView
              title={t(current.empty)}
              hint={t('emptyJobsHint')}
              action={<Button label={t('cTabRequests')} icon="map-pin" onPress={() => router.navigate('/requests')} />}
            />
          }
          ListFooterComponent={isPast && past.isFetchingNextPage ? <ActivityIndicator color={colors.ink} style={{ padding: 16 }} /> : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 14 },
  list: { padding: 20, paddingTop: 8, gap: 10, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, ...cardShadow },
  rowActive: { borderWidth: 1.5, borderColor: colors.selected },
});
