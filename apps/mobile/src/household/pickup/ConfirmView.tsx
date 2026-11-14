import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Category, PaymentMethod, Pickup } from '../../api/types';
import { useT } from '../../i18n/lang';
import { localPhone, normalizePhone } from '../../lib/format';
import { currentScalePhoto } from '../../lib/pickupView';
import { BackButton, Button, Card, Field, Icon, RadioRow, Screen } from '../../ui/components';
import { body, colors, display, minTouch } from '../../ui/theme';
import { collectorName, TotalsCard, WeighLines } from './shared';

export type ConfirmBody = { paymentMethod: PaymentMethod; walletNumber?: string };

/** H7: weigh lines, totals, scale photo, payment method; approve or report a problem. */
export function ConfirmView({
  pickup,
  categories,
  userPhone,
  onConfirm,
  onReport,
  confirming,
  error,
}: {
  pickup: Pickup;
  categories: Category[] | undefined;
  userPhone: string | undefined;
  onConfirm: (body: ConfirmBody) => void;
  onReport: () => void;
  confirming: boolean;
  error: string | null;
}) {
  const { t, lang } = useT();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [wallet, setWallet] = useState(userPhone ? localPhone(userPhone, 'en') : '');
  const [showScale, setShowScale] = useState(false);
  const scale = currentScalePhoto(pickup);
  const walletPhone = normalizePhone(wallet);
  const needsWallet = method !== 'CASH';
  const walletError = needsWallet && wallet.length > 0 && !walletPhone ? t('walletInvalid', { method: t(`pay_${method}`) }) : null;
  const canConfirm = !needsWallet || !!walletPhone;
  const canReport = !pickup.openDispute;

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(needsWallet ? { paymentMethod: method, walletNumber: walletPhone! } : { paymentMethod: 'CASH' });
  };

  return (
    <Screen
      footer={
        <>
          {error ? <Text style={[body(15, 600), { color: colors.alert }]}>{error}</Text> : null}
          <Button testID="confirm-weights" label={t('weightsOk')} icon="check-circle" loading={confirming} disabled={!canConfirm} onPress={confirm} />
          {canReport ? (
            <Button testID="weight-problem" label={t('weightProblem')} icon="alert-circle" variant="dangerLink" onPress={onReport} />
          ) : null}
        </>
      }
    >
      <View style={{ gap: 6 }}>
        <BackButton />
        <Text style={[display(28), { lineHeight: 34 }]}>{t('checkWeights')}</Text>
        <Text style={[body(15), { color: colors.muted }]}>
          {(pickup.weighVersion ?? 1) > 1
            ? t('reweighed')
            : t('weighedBy', { name: collectorName(pickup, t('collectorFallbackName')) })}
        </Text>
      </View>

      <TotalsCard totalKg={pickup.totalKg ?? 0} totalAmount={pickup.totalAmount ?? 0} />

      <Card accessibilityLabel={t('lineDetails')}>
        <WeighLines lines={pickup.lines} categories={categories} />
        {scale ? (
          <Pressable accessibilityRole="button" onPress={() => setShowScale(true)} style={s.scaleBtn}>
            <Icon name="image" size={20} />
            <Text style={body(15, 600)}>{t('seeScalePhoto')}</Text>
          </Pressable>
        ) : null}
      </Card>

      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        <Text style={display(19)}>{t('howToGetPaid')}</Text>
        <RadioRow testID="pay-CASH" label={t('pay_CASH')} sub={t('payCashSub')} selected={method === 'CASH'} onPress={() => setMethod('CASH')} />
        {(['BKASH', 'NAGAD'] as const).map((m) => (
          <RadioRow
            key={m}
            testID={`pay-${m}`}
            label={t(`pay_${m}`)}
            sub={walletPhone ? localPhone(walletPhone, lang) : undefined}
            selected={method === m}
            onPress={() => setMethod(m)}
          />
        ))}
        {needsWallet ? (
          <Field
            testID="wallet-input"
            label={t('walletNumber', { method: t(`pay_${method}`) })}
            value={wallet}
            onChangeText={setWallet}
            keyboardType="phone-pad"
            maxLength={14}
            error={walletError}
          />
        ) : null}
      </View>

      <Modal visible={showScale} animationType="fade" onRequestClose={() => setShowScale(false)}>
        <SafeAreaView style={s.modal}>
          <Text style={[display(20), { color: colors.surface }]}>{t('scalePhoto')}</Text>
          {scale ? <Image source={{ uri: scale.url }} style={s.photo} resizeMode="contain" accessibilityLabel={t('scalePhoto')} /> : null}
          <Button label={t('close')} icon="x" variant="primary" onPress={() => setShowScale(false)} />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  scaleBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouch + 4, borderTopWidth: 1, borderTopColor: colors.line },
  modal: { flex: 1, backgroundColor: colors.ink, padding: 20, gap: 16 },
  photo: { flex: 1, width: '100%' },
});
