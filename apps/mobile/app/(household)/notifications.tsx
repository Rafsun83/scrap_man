import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories, useMarkNotificationsRead, useNotifications } from '../../src/api/hooks';
import type { Notification } from '../../src/api/types';
import { notificationView } from '../../src/household/notificationText';
import { useT } from '../../src/i18n/lang';
import { dhakaToday, formatDate, formatTime } from '../../src/lib/dhaka';
import { BackButton, Button, EmptyView, ErrorView, Icon, LoadingView } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display, minTouch, radius } from '../../src/ui/theme';

const TONE = { money: colors.money, ink: colors.ink, alert: colors.alert };

/** H13: payment, accepted, weights, rates published, expired… newest first, grouped today / earlier. */
export default function Notifications() {
  const { t, lang } = useT();
  const router = useRouter();
  const categories = useCategories();
  const feed = useNotifications();
  const markRead = useMarkNotificationsRead();

  if (feed.isPending) return <LoadingView />;
  if (feed.isError) return <ErrorView message={errorMessage(feed.error, lang)} onRetry={() => feed.refetch()} />;

  const items = feed.data.pages.flatMap((p) => p.items);
  const unread = feed.data.pages[0]?.unreadCount ?? 0;
  const today = dhakaToday();
  const sections = [
    { title: t('notifToday'), data: items.filter((n) => dhakaToday(new Date(n.at)) === today) },
    { title: t('notifEarlier'), data: items.filter((n) => dhakaToday(new Date(n.at)) !== today) },
  ].filter((s) => s.data.length > 0);

  const renderItem = ({ item: n }: { item: Notification }) => {
    const v = notificationView(n, lang, categories.data);
    const when = dhakaToday(new Date(n.at)) === today ? formatTime(n.at, lang) : formatDate(n.at, lang);
    return (
      <Pressable
        testID={`notification-${n.id}`}
        accessibilityRole="button"
        onPress={() => router.push(v.href as never)}
        style={[s.row, !n.read && s.unread]}
      >
        <View style={[s.icon, { backgroundColor: n.read ? colors.ground : colors.selectedTint }]}>
          <Icon name={v.icon} size={22} color={TONE[v.tone]} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={body(16, n.read ? 600 : 700)}>{v.title}</Text>
          {v.body ? <Text style={[body(14), { color: colors.muted, lineHeight: 20 }]}>{v.body}</Text> : null}
          <Text style={[body(13), { color: colors.muted }]}>{when}</Text>
        </View>
        {!n.read ? <View style={s.dot} accessibilityElementsHidden importantForAccessibility="no" /> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.header}>
        <BackButton />
        <View style={s.titleRow}>
          <Text style={[display(28), { flex: 1 }]}>{t('notifications')}</Text>
          {unread > 0 ? (
            <Button
              testID="mark-all-read"
              label={t('markAllRead')}
              icon="check-square"
              variant="link"
              loading={markRead.isPending}
              onPress={() => markRead.mutate()}
            />
          ) : null}
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => <Text style={[body(14, 700), s.section]}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.list}
        onRefresh={() => feed.refetch()}
        refreshing={feed.isRefetching && !feed.isFetchingNextPage}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<EmptyView title={t('notifEmpty')} hint={t('notifEmptyHint')} />}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.ink} style={{ padding: 16 }} /> : undefined}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 8, flexGrow: 1 },
  section: { color: colors.muted, marginTop: 12, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    minHeight: minTouch + 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.signal },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gamcha, marginTop: 6 },
});
