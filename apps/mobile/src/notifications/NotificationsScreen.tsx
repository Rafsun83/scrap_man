import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories, useMarkNotificationsRead, useNotifications } from '../api/hooks';
import type { Notification } from '../api/types';
import { notificationView } from './notificationText';
import { useT } from '../i18n/lang';
import { dhakaToday, formatDate, formatTime } from '../lib/dhaka';
import { BackButton, Button, EmptyView, ErrorView, Icon, LoadingView } from '../ui/components';
import { errorMessage } from '../ui/errors';
import { body, cardShadow, colors, display, minTouch, radius, tones } from '../ui/theme';

const TONE = { money: colors.money, ink: colors.ink, alert: colors.alert };
const TINT = { money: tones.doneBg, ink: tones.inkTint, alert: tones.alertBg };

/**
 * H13 for households and the collector's inbox (bell on C1): newest first, grouped today / earlier, unread
 * highlighted, "mark all read". Each item opens the right screen for the role.
 */
export function NotificationsScreen({ role }: { role: 'HOUSEHOLD' | 'COLLECTOR' }) {
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
    const v = notificationView(n, lang, categories.data, new Date(), role);
    const when = dhakaToday(new Date(n.at)) === today ? formatTime(n.at, lang) : formatDate(n.at, lang);
    return (
      <Pressable
        testID={`notification-${n.id}`}
        accessibilityRole="button"
        onPress={() => router.push(v.href as never)}
        style={[s.row, n.read ? s.read : s.unread]}
      >
        <View style={[s.icon, { backgroundColor: n.read ? colors.ground : TINT[v.tone] }]}>
          <Icon name={v.icon} size={20} color={n.read ? colors.muted : TONE[v.tone]} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={body(15, n.read ? 500 : 600)}>{v.title}</Text>
          {v.body ? <Text style={[body(14), { color: colors.muted, lineHeight: 20 }]}>{v.body}</Text> : null}
          <Text style={[body(12), { color: colors.muted }]}>{when}</Text>
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
          <Text style={[display(24), { flex: 1 }]}>{t('notifications')}</Text>
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
        renderSectionHeader={({ section }) => <Text style={[body(13, 600), s.section]}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.list}
        onRefresh={() => feed.refetch()}
        refreshing={feed.isRefetching && !feed.isFetchingNextPage}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<EmptyView title={t('notifEmpty')} hint={role === 'HOUSEHOLD' ? t('notifEmptyHint') : undefined} />}
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
  },
  unread: { backgroundColor: colors.surface, ...cardShadow },
  read: { borderWidth: 1, borderColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: radius.round, backgroundColor: colors.signal, marginTop: 7 },
});
