import { MATCHING, formatKg, formatTaka, localDigits } from '@bw/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories, useMyPickups } from '../../../src/api/hooks';
import type { NearbyRequest } from '../../../src/api/types';
import { useSession } from '../../../src/auth/session';
import { useCollectorProfile, useLedger, useNearby, useSetOnline } from '../../../src/collector/api';
import { currentJob } from '../../../src/collector/collectorView';
import { currentPosition, useLastPosition } from '../../../src/collector/location';
import { useSkipped } from '../../../src/collector/skipped';
import { NavyHeader, StatTile, Tag } from '../../../src/collector/ui';
import { useSlotLabel } from '../../../src/household/pickup/shared';
import { useT } from '../../../src/i18n/lang';
import { dhakaToday, greetingKey } from '../../../src/lib/dhaka';
import { categoryName, formatKm } from '../../../src/lib/format';
import { Button, EmptyView, ErrorView, Icon, LoadingView, Note } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { body, colors, display, minTouch, radius, tones } from '../../../src/ui/theme';

/** A request is "new" for this long after it was made. */
const NEW_FOR_MS = 10 * 60 * 1000;

/** C1: online switch, today's totals, the current pickup, and nearby requests kept live by socket events. */
export default function Requests() {
  const { t, lang } = useT();
  const router = useRouter();
  const { user } = useSession();
  const profile = useCollectorProfile();
  const online = profile.data?.isOnline === true;
  const position = useLastPosition();
  const setOnline = useSetOnline();
  const [locationProblem, setLocationProblem] = useState<string | null>(null);
  const today = dhakaToday();
  const ledger = useLedger(today, today);
  const active = useMyPickups('ACTIVE', 20);
  const job = currentJob(active.data?.items ?? []);
  const nearby = useNearby(position, online);
  const skipped = useSkipped();
  const categories = useCategories();
  const slotLabel = useSlotLabel();

  // Online after a restart: find the position so the list can load.
  useEffect(() => {
    if (online && !position) void currentPosition();
  }, [online, position]);

  const toggle = async () => {
    setLocationProblem(null);
    if (online) {
      setOnline.mutate({ online: false });
      return;
    }
    const result = await currentPosition();
    if (!result.ok) {
      setLocationProblem(result.reason === 'denied' ? t('locationForOnline') : t('locationUnavailable'));
      return;
    }
    setOnline.mutate({ online: true, location: result.position });
  };

  const name = (user?.name ?? '').split(/\s+/)[0];
  const requests = (nearby.data ?? []).filter((r) => !skipped.has(r.id));

  const header = (
    <>
      <NavyHeader
        title={name ? t('greetName', { greeting: t(greetingKey()), name }) : t(greetingKey())}
        right={
          <Pressable
            testID="online-switch"
            accessibilityRole="switch"
            accessibilityLabel={t('onlineSwitch')}
            accessibilityState={{ checked: online, busy: setOnline.isPending }}
            disabled={setOnline.isPending}
            onPress={toggle}
            style={[s.pill, { borderColor: online ? colors.signal : tones.dashed }]}
          >
            <Text style={[body(15, 700), { color: colors.surface }]}>{online ? t('online') : t('offline')}</Text>
            <View style={[s.track, { backgroundColor: online ? colors.money : tones.dashed, justifyContent: online ? 'flex-end' : 'flex-start' }]}>
              <View style={s.knob} />
            </View>
          </Pressable>
        }
      >
        <View style={s.stats}>
          <StatTile testID="today-count" value={t('countPickups', { count: localDigits(ledger.data?.pickupCount ?? 0, lang) })} label={t('todayPickups')} />
          <StatTile value={formatKg(ledger.data?.totalKg ?? 0, lang)} label={t('collected')} />
          <StatTile value={formatTaka(ledger.data?.totalPaid ?? 0, lang)} label={t('paidOut')} />
        </View>
      </NavyHeader>
      <View style={s.body}>
        {locationProblem ? <Note tone="alert" icon="map-pin" text={locationProblem} /> : null}
        {setOnline.error ? <Note tone="alert" text={errorMessage(setOnline.error, lang)} /> : null}
        {job ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/job/${job.id}`)} style={s.job}>
            <Icon name="truck" color={colors.ink} />
            <Text style={[body(16, 700), { flex: 1 }]}>{t('activeJob', { area: job.area })}</Text>
            <Text style={[body(15, 700), { color: colors.money }]}>{t('openJob')}</Text>
          </Pressable>
        ) : null}
        <View style={s.titleRow}>
          <Text style={display(21)}>{t('nearbyRequests')}</Text>
          <Text style={[body(14), { color: colors.muted }]}>
            {t('withinKm', { km: localDigits(MATCHING.widenedRadiusM / 1000, lang) })}
          </Text>
        </View>
      </View>
    </>
  );

  const renderItem = ({ item: r, index }: { item: NearbyRequest; index: number }) => {
    const isNew = Date.now() - Date.parse(r.requestedAt) < NEW_FOR_MS;
    return (
      <View style={[s.card, { borderColor: index === 0 ? colors.ink : colors.line }]}>
        <View style={s.cardTop}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={body(17, 700)}>{r.area}</Text>
            {isNew ? <Text style={[body(14, 700), { color: colors.money }]}>{t('newBadge')}</Text> : null}
          </View>
          {r.hasPhoto ? <Tag label={t('hasPhoto')} /> : null}
          <Tag label={t('kmShort', { km: formatKm(r.distanceM, lang) })} tone={index === 0 ? 'signal' : 'plain'} />
        </View>
        <View style={s.tags}>
          {r.categoryCodes.map((code) => (
            <Tag key={code} label={categoryName(categories.data, code, lang)} />
          ))}
        </View>
        <View style={s.cardBottom}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[body(14), { color: colors.muted }]}>{slotLabel(r)}</Text>
            <Text style={[body(14), { color: colors.muted }]}>{t('aboutWeight', { band: t(`band_${r.weightBand}`) })}</Text>
          </View>
          <Button testID={`view-${r.id}`} label={t('view')} icon="chevron-right" variant="dark" onPress={() => router.push(`/request/${r.id}`)} style={s.view} />
        </View>
      </View>
    );
  };

  let empty;
  if (!online) empty = <EmptyView title={t('offlineTitle')} hint={t('offlineHint')} />;
  else if (nearby.isPending) empty = <LoadingView />;
  else if (nearby.isError) empty = <ErrorView message={errorMessage(nearby.error, lang)} onRetry={() => nearby.refetch()} />;
  else empty = <EmptyView title={t('noRequests')} hint={t('noRequestsHint')} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }} edges={['top']}>
      <FlatList
        style={{ backgroundColor: colors.ground }}
        data={online ? requests : []}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={{ paddingHorizontal: 20 }}>{empty}</View>}
        contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
        refreshing={nearby.isRefetching || ledger.isRefetching}
        onRefresh={() => {
          void profile.refetch();
          void ledger.refetch();
          void active.refetch();
          if (online) void currentPosition().then(() => nearby.refetch());
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouch, paddingLeft: 14, paddingRight: 6, borderRadius: radius.pill, borderWidth: 2 },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, flexDirection: 'row' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
  stats: { flexDirection: 'row', gap: 8 },
  body: { paddingHorizontal: 20, paddingTop: 18, gap: 12 },
  job: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.signal, borderWidth: 2, borderColor: colors.ink },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  card: { marginHorizontal: 20, backgroundColor: colors.surface, borderWidth: 2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  view: { minHeight: 48, paddingHorizontal: 16 },
});
