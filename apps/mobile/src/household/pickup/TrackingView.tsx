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
import { body, colors, display, minTouch, radius, tones } from '../../ui/theme';
import { collectorName } from './shared';

/**
 * H6: collector on the way (ACCEPTED) and at the door (ARRIVED). The prototype's map needs a maps key and
 * the collector's last position from the API; until then the top panel shows distance and a rough ETA from
 * live `collector.location` events.
 */
export function TrackingView({ pickup }: { pickup: Pickup }) {
  const { t, lang } = useT();
  const router = useRouter();
  const location = useCollectorLocation(pickup.id);
  const name = collectorName(pickup, t('collectorFallbackName'));
  const firstName = name.split(/\s+/)[0];
  const arrived = pickup.status === 'ARRIVED';

  const metres =
    !arrived && location && pickup.address?.lat != null && pickup.address?.lng != null
      ? distanceM(location, { lat: pickup.address.lat, lng: pickup.address.lng })
      : null;

  const steps = trackingSteps(pickup.status);
  const stepLabels = [t('stepAccepted'), t('stepOnTheWay'), t('stepWeigh'), t('stepPaid')];

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.panel}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('goHome')} onPress={() => router.dismissTo('/home')} style={s.homeBtn}>
          <Icon name="arrow-left" />
          <Text style={body(14, 600)}>{t('goHome')}</Text>
        </Pressable>
        <View style={s.panelBody}>
          <View style={s.truck}>
            <Icon name={arrived ? 'home' : 'truck'} size={26} color={colors.signal} />
          </View>
          {arrived ? null : metres !== null ? (
            <Text style={display(22)}>{t('distanceAway', { km: formatKm(metres, lang) })}</Text>
          ) : (
            <Text style={[body(15, 600), { textAlign: 'center', color: colors.muted }]}>{t('waitingForLocation')}</Text>
          )}
        </View>
      </View>

      <ScrollView style={s.sheet} contentContainerStyle={s.sheetContent}>
        <View style={s.titleRow}>
          <Text style={[display(26), { flex: 1, lineHeight: 32 }]}>
            {t(arrived ? 'collectorArrived' : 'collectorComing', { name: firstName })}
          </Text>
          {metres !== null ? (
            <Text style={[body(16, 700), { color: colors.money }]}>
              {t('aboutMinutes', { minutes: localDigits(etaMinutes(metres), lang) })}
            </Text>
          ) : null}
        </View>

        <View style={s.collector}>
          <View style={s.avatar}>
            <Text style={[display(22), { color: colors.signal }]}>{initials(name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={body(17, 700)}>{name}</Text>
            <View style={s.verified}>
              <Icon name="check-circle" size={16} color={colors.money} />
              <Text style={[body(14, 600), { color: colors.money }]}>
                {t('verifiedCollector')}
                {pickup.collector?.rating ? ` · ★ ${localDigits(pickup.collector.rating.toFixed(1), lang)}` : ''}
              </Text>
            </View>
          </View>
          {pickup.collector?.phone ? (
            <Button
              label={t('call')}
              icon="phone"
              variant="primary"
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
              <Text style={[body(15, 600), { color: colors.surface }]}>{t('pickupCode')}</Text>
              <Text
                testID="pickup-code"
                accessibilityLabel={t('pickupCodeLabel', { code: pickup.pickupCode.split('').join(' ') })}
                style={[display(38, 800), { color: colors.signal, letterSpacing: 8 }]}
              >
                {localDigits(pickup.pickupCode, lang)}
              </Text>
            </View>
            <Text style={[body(14), { color: tones.ink200, lineHeight: 21 }]}>{t('pickupCodeHelp')}</Text>
          </View>
        ) : null}

        {arrived ? <Note icon="activity" text={t('weighingNow')} /> : null}

        <View style={{ gap: 4 }}>
          <Text style={[display(18), { marginBottom: 6 }]}>{t('progress')}</Text>
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
          state === 'current' && { backgroundColor: colors.signal, borderWidth: 2, borderColor: colors.ink },
          state === 'todo' && { borderWidth: 2, borderColor: tones.dashed },
        ]}
      >
        {state === 'done' ? (
          <Icon name="check" size={14} color={colors.surface} />
        ) : (
          <Text style={body(13, 700)}>{localDigits(n, lang)}</Text>
        )}
      </View>
      <Text style={[body(16, state === 'current' ? 700 : 400), state === 'todo' && { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  panel: { height: 200, backgroundColor: tones.mapGround, padding: 12 },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: minTouch,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  panelBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 16 },
  truck: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { flex: 1, marginTop: -20, backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetContent: { padding: 20, gap: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  collector: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callBtn: { minHeight: minTouch, paddingHorizontal: 14 },
  code: { backgroundColor: colors.ink, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 16, gap: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
