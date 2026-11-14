import { MATCHING } from '@bw/shared';
import { useEffect, useRef } from 'react';
import { Alert, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { Category, Pickup } from '../../api/types';
import { useT } from '../../i18n/lang';
import { categoryNames, formatKm } from '../../lib/format';
import { BackButton, Button, Card, Icon, Screen } from '../../ui/components';
import { body, colors, display, tones } from '../../ui/theme';
import { InfoRow, useSlotLabel } from './shared';

/** H5: waiting while nearby collectors see the request; cancel. */
export function SearchingView({
  pickup,
  categories,
  onCancel,
  cancelling,
  cancelError,
}: {
  pickup: Pickup;
  categories: Category[] | undefined;
  onCancel: () => void;
  cancelling: boolean;
  cancelError: string | null;
}) {
  const { t, lang } = useT();
  const slotLabel = useSlotLabel();
  const ping = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ping, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [ping]);

  const confirmCancel = () =>
    Alert.alert(t('cancelConfirmTitle'), t('cancelConfirmBody'), [
      { text: t('keepRequest'), style: 'cancel' },
      { text: t('cancelConfirmYes'), style: 'destructive', onPress: onCancel },
    ]);

  return (
    <Screen
      footer={
        <>
          {cancelError ? <Text style={[body(15, 600), { color: colors.alert }]}>{cancelError}</Text> : null}
          <Button testID="cancel-request" label={t('cancelRequest')} icon="x-circle" variant="danger" loading={cancelling} onPress={confirmCancel} />
        </>
      }
    >
      <BackButton label={t('goHome')} />
      <View style={s.radar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[s.ring, { margin: 0 }]} />
        <View style={[s.ring, { margin: 45 }]} />
        <View style={[s.ring, { margin: 90 }]} />
        <Animated.View
          style={[
            s.ping,
            {
              opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            },
          ]}
        />
        <View style={s.home}>
          <Icon name="home" size={24} color={colors.signal} />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={[display(27), { textAlign: 'center', lineHeight: 34 }]}>{t('searchingTitle')}</Text>
        <Text style={[body(16), { textAlign: 'center', color: colors.muted, lineHeight: 24 }]}>{t('searchingBody')}</Text>
        <Text style={[body(14, 600), { textAlign: 'center' }]}>
          {t('searchRadius', { km: formatKm(pickup.searchRadiusM || MATCHING.initialRadiusM, lang) })}
        </Text>
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
  radar: { width: 260, height: 260, alignSelf: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, borderWidth: 2, borderColor: tones.ring },
  ping: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.signal },
  home: {
    position: 'absolute',
    left: 105,
    top: 105,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
