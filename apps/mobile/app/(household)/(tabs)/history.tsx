import { formatKg, formatTaka } from '@bw/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories, useMyPickupPages, useSummary } from '../../../src/api/hooks';
import type { Pickup, PickupFilter } from '../../../src/api/types';
import { useT } from '../../../src/i18n/lang';
import { formatDate } from '../../../src/lib/dhaka';
import { categoryNames } from '../../../src/lib/format';
import { badgeTone } from '../../../src/lib/pickupView';
import { Button, Chip, EmptyView, ErrorView, LoadingView } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { body, colors, display, radius, tones } from '../../../src/ui/theme';

type Filter = PickupFilter | 'ALL';

const FILTERS: { key: Filter; label: 'filterAll' | 'filterActive' | 'filterDone' | 'filterCancelled'; empty: 'emptyAll' | 'emptyActive' | 'emptyDone' | 'emptyCancelled' }[] = [
  { key: 'ALL', label: 'filterAll', empty: 'emptyAll' },
  { key: 'ACTIVE', label: 'filterActive', empty: 'emptyActive' },
  { key: 'COMPLETED', label: 'filterDone', empty: 'emptyDone' },
  { key: 'CANCELLED', label: 'filterCancelled', empty: 'emptyCancelled' },
];

const BADGE = {
  done: { bg: tones.doneBg, fg: tones.doneFg },
  cancelled: { bg: tones.cancelledBg, fg: tones.cancelledFg },
  active: { bg: colors.selectedTint, fg: colors.ink },
};

/** H11: totals (GET /me/summary), filters and past pickups with cursor paging. */
export default function History() {
  const { t, lang } = useT();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const categories = useCategories();
  const pages = useMyPickupPages(filter);
  const summary = useSummary();
  const items = pages.data?.pages.flatMap((p) => p.items ?? []) ?? [];
  const current = FILTERS.find((f) => f.key === filter)!;

  const renderItem = ({ item: p }: { item: Pickup }) => {
    const tone = BADGE[badgeTone(p.status)];
    const meta =
      p.status === 'COMPLETED' && p.totalKg != null
        ? t('historyMeta', { date: formatDate(p.completedAt ?? p.slotDate, lang), kg: formatKg(p.totalKg, lang) })
        : formatDate(p.slotDate, lang);
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push(`/pickup/${p.id}`)} style={s.row}>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text style={body(16, 700)}>{categoryNames(categories.data, p.categoryCodes, lang)}</Text>
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
        <Text style={[display(28), { lineHeight: 34 }]}>{t('mySales')}</Text>
        {summary.data ? (
          <View style={s.totals}>
            <View style={s.total}>
              <Text style={[body(13), { color: tones.ink200 }]}>{t('earnedSoFar')}</Text>
              <Text testID="earned" style={[display(26, 800), { color: colors.signal }]}>{formatTaka(summary.data.totalAmount, lang)}</Text>
            </View>
            <View style={s.total}>
              <Text style={[body(13), { color: tones.ink200 }]}>{t('totalSold')}</Text>
              <Text testID="sold" style={[display(26, 800), { color: colors.signal }]}>{formatKg(summary.data.totalKg, lang)}</Text>
            </View>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t('filters')}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={t(f.label)} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>
      {pages.isPending ? (
        <LoadingView />
      ) : pages.isError ? (
        <ErrorView message={errorMessage(pages.error, lang)} onRetry={() => pages.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          onRefresh={() => pages.refetch()}
          refreshing={pages.isRefetching && !pages.isFetchingNextPage}
          onEndReached={() => pages.hasNextPage && !pages.isFetchingNextPage && pages.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyView
              title={t(current.empty)}
              hint={t('emptyHint')}
              action={<Button label={t('sellScrap')} icon="tag" onPress={() => router.push('/sell/items')} />}
            />
          }
          ListFooterComponent={
            pages.isFetchingNextPage ? <ActivityIndicator color={colors.ink} style={{ padding: 16 }} /> : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 14 },
  totals: { flexDirection: 'row', gap: 10 },
  total: { flex: 1, gap: 2, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.ink },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minHeight: 64,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
});
