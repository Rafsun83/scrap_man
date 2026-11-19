import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Category, Pickup } from '../../api/types';
import { SUPPORT_PHONE } from '../../config';
import { useT } from '../../i18n/lang';
import { formatTime } from '../../lib/dhaka';
import { categoryName } from '../../lib/format';
import { slotStart } from '../slot';
import { Button, Field, Icon, Note, Screen } from '../../ui/components';
import { body, colors, display, radius } from '../../ui/theme';
import { NavyHeader, Tag } from '../ui';

const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^0-9]/g, '');

/** Google Maps directions to the household; works without an API key. */
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/**
 * C3: after accept, the exact address, note and phone; call, directions, and the household's 4-digit code
 * that moves the pickup to ARRIVED. "Can't find the customer" offers a call, support, or giving it back.
 */
export function ArriveView({
  pickup,
  categories,
  onArrive,
  arriving,
  arriveError,
  onRelease,
  releasing,
  releaseError,
  onNoShow,
  noShowing,
  noShowError,
  now = new Date(),
}: {
  pickup: Pickup;
  categories: Category[] | undefined;
  onArrive: (code: string) => void;
  arriving: boolean;
  arriveError: string | null;
  onRelease: (reason?: string) => void;
  releasing: boolean;
  releaseError: string | null;
  onNoShow: (note?: string) => void;
  noShowing: boolean;
  noShowError: string | null;
  /** For tests; the slot-start check uses it. */
  now?: Date;
}) {
  const { t, lang } = useT();
  const [code, setCode] = useState('');
  const [sheet, setSheet] = useState<'closed' | 'help' | 'release' | 'noShow'>('closed');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const starts = slotStart(pickup.slotDate, pickup.slot);
  const slotStarted = now.getTime() >= starts.getTime();
  const digits = toAscii(code);
  const phone = pickup.household.phone;
  const address = pickup.address;

  return (
    <>
      <Screen
        edges={['bottom']}
        style={{ padding: 0, gap: 0 }}
        footer={
          pickup.codeLocked ? undefined : (
            <>
              {arriveError ? <Text style={[body(15, 600), { color: colors.alert }]}>{arriveError}</Text> : null}
              <Button
                testID="verify-code"
                label={t('verifyAndWeigh')}
                icon="check-circle"
                disabled={digits.length !== 4}
                loading={arriving}
                onPress={() => onArrive(digits)}
              />
            </>
          )
        }
      >
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.ink }}>
          <NavyHeader back title={t('currentPickup')} sub={t('headingToCustomer')} />
        </SafeAreaView>
        <View style={s.body}>
          <View style={s.card}>
            <Text style={display(21)}>{pickup.household.name || t('customerFallback')}</Text>
            {address ? <Text style={[body(16), { lineHeight: 23 }]}>{address.text}</Text> : null}
            {address?.note ? <Text style={[body(15), { color: colors.muted }]}>{t('noteValue', { note: address.note })}</Text> : null}
            <View style={s.tags}>
              {pickup.categoryCodes.map((c) => (
                <Tag key={c} label={categoryName(categories, c, lang)} />
              ))}
            </View>
            <View style={s.row}>
              {phone ? (
                <Button label={t('call')} icon="phone" variant="outline" onPress={() => Linking.openURL(`tel:${phone}`)} style={{ flex: 1 }} />
              ) : null}
              {address?.lat != null && address.lng != null ? (
                <Button
                  label={t('directions')}
                  icon="navigation"
                  variant="outline"
                  onPress={() => Linking.openURL(directionsUrl(address.lat!, address.lng!))}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          </View>

          {pickup.codeLocked ? (
            <Note tone="alert" icon="lock" text={t('errCodeLocked')} />
          ) : (
            <View style={s.card}>
              <Text style={display(20)}>{t('arriveTitle')}</Text>
              <Text style={[body(15), { color: colors.muted }]}>{t('arriveHint')}</Text>
              <TextInput
                testID="code-input"
                accessibilityLabel={t('codeInput')}
                value={code}
                onChangeText={(v) => setCode(toAscii(v).slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                textContentType="oneTimeCode"
                style={s.code}
                placeholder="• • • •"
                placeholderTextColor={colors.muted}
              />
            </View>
          )}

          <Button label={t('cantFindCustomer')} icon="help-circle" variant="dangerLink" onPress={() => setSheet('help')} style={{ alignSelf: 'center' }} />
        </View>
      </Screen>

      <Modal visible={sheet !== 'closed'} transparent animationType="slide" onRequestClose={() => setSheet('closed')}>
        <Pressable style={s.backdrop} onPress={() => setSheet('closed')} accessibilityRole="button" accessibilityLabel={t('close')} />
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          {sheet === 'help' ? (
            <>
              <Text style={display(21)}>{t('cantFindCustomer')}</Text>
              <Text style={[body(15), { color: colors.muted, lineHeight: 22 }]}>{t('cantFindBody')}</Text>
              {phone ? <Button label={t('callCustomer')} icon="phone" onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
              {SUPPORT_PHONE ? (
                <Button label={t('callSupport')} icon="headphones" variant="outline" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
              ) : null}
              <Button testID="noshow-open" label={t('noShowButton')} icon="home" variant="outline" onPress={() => setSheet('noShow')} />
              <Button testID="release-open" label={t('releaseRequest')} icon="corner-up-left" variant="danger" onPress={() => setSheet('release')} />
            </>
          ) : sheet === 'noShow' ? (
            <>
              <Text style={display(21)}>{t('noShowButton')}</Text>
              {slotStarted ? (
                <>
                  <Text style={[body(15), { color: colors.muted, lineHeight: 22 }]}>{t('noShowHint')}</Text>
                  <Field label={t('noShowNote')} value={note} onChangeText={setNote} maxLength={200} />
                  {noShowError ? <Text style={[body(15, 600), { color: colors.alert }]}>{noShowError}</Text> : null}
                  <Button
                    testID="noshow-confirm"
                    label={t('noShowConfirm')}
                    icon="home"
                    variant="danger"
                    loading={noShowing}
                    onPress={() => onNoShow(note.trim() || undefined)}
                  />
                </>
              ) : (
                <Note icon="clock" text={t('noShowNotYet', { time: formatTime(starts, lang) })} />
              )}
            </>
          ) : (
            <>
              <Text style={display(21)}>{t('releaseRequest')}</Text>
              <Text style={[body(15), { color: colors.muted, lineHeight: 22 }]}>{t('releaseConfirm')}</Text>
              <Field label={t('releaseReason')} value={reason} onChangeText={setReason} maxLength={200} />
              {releaseError ? <Text style={[body(15, 600), { color: colors.alert }]}>{releaseError}</Text> : null}
              <Button
                testID="release-confirm"
                label={t('releaseYes')}
                icon="corner-up-left"
                variant="danger"
                loading={releasing}
                onPress={() => onRelease(reason.trim() || undefined)}
              />
            </>
          )}
          <Button label={t('close')} icon="x" variant="link" onPress={() => setSheet('closed')} style={{ alignSelf: 'center' }} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', gap: 10 },
  code: {
    minHeight: 64,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    textAlign: 'center',
    letterSpacing: 16,
    ...display(32, 800),
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(19,48,74,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 12 },
});
