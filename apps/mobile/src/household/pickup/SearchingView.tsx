import { localDigits, MATCHING } from '@bw/shared';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { Category, NearbyCollectors, Pickup } from '../../api/types';
import { useT } from '../../i18n/lang';
import { categoryNames, formatKm } from '../../lib/format';
import { BackButton, Button, Card, Icon, Screen } from '../../ui/components';
import { body, colors, display, radius, tones } from '../../ui/theme';
import { RADAR, radarDots } from './radar';
import { InfoRow, useSlotLabel } from './shared';

/**
 * H5 (v1 design `household/Searching.dc.html`): waiting while nearby collectors see the request, with the online
 * ones on still rings (no animation); cancel.
 */
export function SearchingView({
  pickup,
  categories,
  nearby,
  onCancel,
  cancelling,
  cancelError,
}: {
  pickup: Pickup;
  categories: Category[] | undefined;
  /** Online collectors inside the radius; undefined until the first answer (or if it failed). */
  nearby?: NearbyCollectors;
  onCancel: () => void;
  cancelling: boolean;
  cancelError: string | null;
}) {
  const { t, lang } = useT();
  const slotLabel = useSlotLabel();
  // The radar's answer is fresher than the pickup after the radius widens (that change sends no event).
  const radiusM = nearby?.radiusM || pickup.searchRadiusM || MATCHING.initialRadiusM;
  const dots = nearby ? radarDots(nearby.collectors, radiusM) : [];
  const onlineText = !nearby
    ? null
    : nearby.count === 0
      ? t('noCollectorsOnline')
      : nearby.count === 1
        ? t('oneCollectorOnline')
        : t('collectorsOnline', { count: localDigits(nearby.count, lang) });

  const confirmCancel = () =>
    Alert.alert(t('cancelConfirmTitle'), t('cancelConfirmBody'), [
      { text: t('keepRequest'), style: 'cancel' },
      { text: t('cancelConfirmYes'), style: 'destructive', onPress: onCancel },
    ]);

  return (
    <Screen
      footer={
        <>
          {cancelError ? <Text style={[body(14, 600), { color: colors.alert }]}>{cancelError}</Text> : null}
          <Button testID="cancel-request" label={t('cancelRequest')} icon="x-circle" variant="danger" loading={cancelling} onPress={confirmCancel} />
        </>
      }
    >
      <BackButton label={t('goHome')} />
      <View style={s.radar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[s.ring, { margin: 0 }]} />
        <View style={[s.ring, { margin: 45 }]} />
        <View style={[s.ring, { margin: 90 }]} />
        <View style={s.home}>
          <Icon name="home" size={24} />
        </View>
        {dots.map((d, i) => (
          <View key={i} testID="radar-collector" style={[s.dot, d]}>
            <Icon name="truck" size={16} />
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={[display(24), { textAlign: 'center', lineHeight: 30 }]}>{t('searchingTitle')}</Text>
        <Text style={[body(15), { textAlign: 'center', color: colors.muted, lineHeight: 23 }]}>{t('searchingBody')}</Text>
        <Text style={[body(13, 500), { textAlign: 'center', color: colors.muted }]}>
          {t('searchRadius', { km: formatKm(radiusM, lang) })}
        </Text>
        {onlineText ? (
          <View style={s.online} accessibilityLiveRegion="polite">
            <Icon name={nearby!.count > 0 ? 'truck' : 'clock'} size={18} color={nearby!.count > 0 ? colors.ink : colors.muted} />
            <Text style={[body(14, 600), { color: nearby!.count > 0 ? colors.ink : colors.muted, textAlign: 'center', flexShrink: 1 }]}>{onlineText}</Text>
          </View>
        ) : null}
      </View>
      <Card accessibilityLabel={t('requestSummary')}>
        <InfoRow icon="package" text={categoryNames(categories, pickup.categoryCodes, lang)} />
        <InfoRow icon="clock" text={slotLabel(pickup)} last={!pickup.address} />
        {pickup.address ? <InfoRow icon="map-pin" text={pickup.address.text ?? pickup.area} last /> : null}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  radar: { width: RADAR.size, height: RADAR.size, alignSelf: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.round, borderWidth: 1, borderColor: colors.line },
  home: {
    position: 'absolute',
    left: (RADAR.size - RADAR.home) / 2,
    top: (RADAR.size - RADAR.home) / 2,
    width: RADAR.home,
    height: RADAR.home,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: tones.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: RADAR.dot,
    height: RADAR.dot,
    borderRadius: radius.round,
    borderWidth: 1.5,
    borderColor: colors.selected,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  online: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
