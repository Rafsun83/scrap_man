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
import { body, colors, display, radius, tones } from '../../../src/ui/theme';

type Tab = 'TODAY' | 'UPCOMING' | 'PAST';

const TABS: { key: Tab; label: 'today' | 'tabUpcoming' | 'tabPast'; empty: 'emptyToday' | 'emptyUpcoming' | 'emptyPast' }[] = [
  { key: 'TODAY', label: 'today', empty: 'emptyToday' },
  { key: 'UPCOMING', label: 'tabUpcoming', empty: 'emptyUpcoming' },
  { key: 'PAST', label: 'tabPast', empty: 'emptyPast' },
];

const BADGE = {
  done: { bg: tones.doneBg, fg: tones.doneFg },
  cancelled: { bg: tones.cancelledBg, fg: tones.cancelledFg },
  active: { bg: colors.selectedTint, fg: colors.ink },
};

/** C8: today's and upcoming assigned pickups (active), and past ones with cursor paging. */
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
    const tone = BADGE[badgeTone(p.status)];
    const meta =
      p.status === 'COMPLETED' && p.totalKg != null
        ? `${formatDate(p.completedAt ?? p.slotDate, lang)} · ${formatKg(p.totalKg, lang)}`
        : `${p.area} · ${slotLabel(p)}`;
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push(`/job/${p.id}`)} style={s.row} testID={`job-${p.id}`}>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text style={body(16, 700)}>{p.household.name || p.area}</Text>
          <Text style={[body(14), { color: colors.muted }]}>{categoryNames(categories.data, p.categoryCodes, lang)}</Text>
          <Text style={[body(14), { color: colors.muted }]}>{meta}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {p.status === 'COMPLETED' && p.totalAmount != null ? (
            <Text style={[display(19), { color: colors.money }]}>{formatTaka(p.totalAmount, lang)}</Text>
          ) : null}
          <Text style={[body(13, 600), s.badge, { backgroundColor: tone.bg, color: tone.fg }]}>{t(`status_${p.status}`)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Text style={[display(28), { lineHeight: 34 }]}>{t('cTabJobs')}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
});
