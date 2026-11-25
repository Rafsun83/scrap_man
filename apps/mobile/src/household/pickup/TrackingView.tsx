import { localDigits } from '@bw/shared';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Pickup } from '../../api/types';
import { useT } from '../../i18n/lang';
import { distanceM, etaMinutes, formatKm, initials } from '../../lib/format';
import { trackingSteps, type StepState } from '../../lib/pickupView';
import { useCollectorLocation } from '../../realtime/socket';
import { Button, Icon, Note } from '../../ui/components';
import { mapsEnabled, TrackingMap } from '../../ui/maps';
import { Badge } from '../../ui/parts';
import { body, cardShadow, colors, display, minTouch, radius, tones } from '../../ui/theme';
import { collectorName } from './shared';

/**
 * H6 (v1 design `household/Tracking.dc.html`): collector on the way (ACCEPTED) and at the door (ARRIVED). The collector's position starts from the
 * pickup's collectorLocation and follows live `collector.location` events. With a maps key the top panel is a
 * map; without one it shows distance and a rough ETA.
 */
export function TrackingView({ pickup }: { pickup: Pickup }) {
  const { t, lang } = useT();
  const router = useRouter();
  const live = useCollectorLocation(pickup.id);
  const saved = pickup.collectorLocation;
  // Whichever position is newer: the live event or the one saved with the pickup.
  const location = live && (!saved || Date.parse(live.at) >= Date.parse(saved.at)) ? live : (saved ?? null);
  const home = pickup.address?.lat != null && pickup.address?.lng != null ? { lat: pickup.address.lat, lng: pickup.address.lng } : null;
  const name = collectorName(pickup, t('collectorFallbackName'));
  const firstName = name.split(/\s+/)[0];
  const arrived = pickup.status === 'ARRIVED';

  const metres = !arrived && location && home ? distanceM(location, home) : null;
  const showMap = mapsEnabled && home !== null;

  const steps = trackingSteps(pickup.status);
  const stepLabels = [t('stepAccepted'), t('stepOnTheWay'), t('stepWeigh'), t('stepPaid')];

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.panel}>
        {showMap ? (
          <TrackingMap
            home={home!}
            collector={arrived ? null : location}
            style={StyleSheet.absoluteFill}
            label={t('mapLabel')}
          />
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('goHome')} onPress={() => router.dismissTo('/home')} style={s.homeBtn}>
          <Icon name="chevron-left" />
          <Text style={body(14, 600)}>{t('goHome')}</Text>
        </Pressable>
        {showMap ? null : (
          <View style={s.panelBody}>
            <View style={s.truck}>
              <Icon name={arrived ? 'home' : 'truck'} size={26} color={colors.surface} />
            </View>
            {arrived ? null : metres !== null ? (
              <Text style={display(22)}>{t('distanceAway', { km: formatKm(metres, lang) })}</Text>
            ) : (
              <Text style={[body(15, 600), { textAlign: 'center', color: colors.muted }]}>{t('waitingForLocation')}</Text>
            )}
          </View>
        )}
      </View>

      <ScrollView style={s.sheet} contentContainerStyle={s.sheetContent}>
        <View style={s.titleRow}>
          <Text style={[display(24), { flex: 1, lineHeight: 30 }]}>
            {t(arrived ? 'collectorArrived' : 'collectorComing', { name: firstName })}
          </Text>
          {metres !== null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Badge label={t('aboutMinutes', { minutes: localDigits(etaMinutes(metres), lang) })} tone="done" />
              {showMap ? (
                <Text style={[body(13), { color: colors.muted }]}>{t('distanceAway', { km: formatKm(metres, lang) })}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={s.collector}>
          <View style={s.avatar}>
            <Text style={[display(18), { color: colors.surface }]}>{initials(name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={body(16, 600)}>{name}</Text>
            <View style={s.verified}>
              <Icon name="shield" size={14} color={colors.money} />
              <Text style={[body(13, 500), { color: colors.money }]}>
                {t('verifiedCollector')}
                {pickup.collector?.rating ? ` · ★ ${localDigits(pickup.collector.rating.toFixed(1), lang)}` : ''}
              </Text>
            </View>
          </View>
          {pickup.collector?.phone ? (
            <Button
              label={t('call')}
              icon="phone"
              variant="outline"
              onPress={() => Linking.openURL(`tel:${pickup.collector!.phone}`)}
              style={s.callBtn}
            />
          ) : null}
        </View>

        {pickup.codeLocked ? (
          <Note tone="alert" icon="lock" text={t('codeLocked')} />
        ) : pickup.status === 'ACCEPTED' && pickup.pickupCode ? (
          <View style={s.code}>
            <View style={s.codeRow}>
              <Text style={body(14, 600)}>{t('pickupCode')}</Text>
              <View
                testID="pickup-code"
                accessible
                accessibilityLabel={t('pickupCodeLabel', { code: pickup.pickupCode.split('').join(' ') })}
                style={s.codeBoxes}
              >
                {pickup.pickupCode.split('').map((d, i) => (
                  <View key={i} style={s.codeBox}>
                    <Text style={display(26)}>{localDigits(d, lang)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={[body(13), { color: colors.muted, lineHeight: 20 }]}>{t('pickupCodeHelp')}</Text>
          </View>
        ) : null}

        {arrived ? <Note icon="activity" text={t('weighingNow')} /> : null}

        <View style={{ gap: 4 }}>
          <Text style={[body(14, 500), { color: colors.muted, marginBottom: 4 }]}>{t('progress')}</Text>
          {stepLabels.map((label, i) => (
            <Step key={label} n={i + 1} label={label} state={steps[i]} />
          ))}
        </View>

        <Button
          label={t('reportProblem')}
          icon="flag"
          variant="dangerLink"
          onPress={() => router.push(`/pickup/${pickup.id}/report`)}
          style={{ alignSelf: 'center' }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, label, state }: { n: number; label: string; state: StepState }) {
  const { lang } = useT();
  return (
    <View style={s.step} accessibilityState={{ selected: state === 'current' }}>
      <View
        style={[
          s.stepDot,
          state === 'done' && { backgroundColor: colors.money },
          state === 'current' && { borderWidth: 2, borderColor: colors.ink },
          state === 'todo' && { borderWidth: 1.5, borderColor: tones.ring },
        ]}
      >
        {state === 'done' ? (
          <Icon name="check" size={14} color={colors.surface} />
        ) : (
          <Text style={[body(12, 600), state === 'todo' && { color: colors.muted }]}>{localDigits(n, lang)}</Text>
        )}
      </View>
      <Text style={[body(15, state === 'current' ? 600 : 400), state === 'todo' && { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  panel: { height: 250, backgroundColor: tones.mapGround, padding: 12, overflow: 'hidden' },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: minTouch,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  panelBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 16 },
  truck: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, marginTop: -12, backgroundColor: colors.ground, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  sheetContent: { padding: 20, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  collector: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, ...cardShadow },
  avatar: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callBtn: { minHeight: minTouch, paddingHorizontal: 14 },
  code: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radius.md, padding: 16, gap: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  codeBoxes: { flexDirection: 'row', gap: 6 },
  codeBox: { width: 40, height: 48, borderRadius: radius.sm, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  stepDot: { width: 24, height: 24, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
});
