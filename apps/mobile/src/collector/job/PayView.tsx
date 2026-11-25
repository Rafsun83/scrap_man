import { formatKg, formatTaka } from '@bw/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Category, PaymentMethod, Pickup } from '../../api/types';
import { useT } from '../../i18n/lang';
import { categoryNames, localPhone } from '../../lib/format';
import { Button, Field, Note, Screen } from '../../ui/components';
import { Badge } from '../../ui/parts';
import { body, cardShadow, colors, display, radius } from '../../ui/theme';
import { PageHeader } from '../ui';

const TRX_RE = /^[A-Za-z0-9]{6,30}$/;

export type PayBody = { method: PaymentMethod; trxId?: string };

/**
 * C5 (v1 design `collector/CPay.dc.html`): the household confirmed; pay the server's total by the method they chose. bKash and Nagad need the TrxID
 * from the wallet's message. `again` is the PAY_AGAIN case after a "not received" report.
 */
export function PayView({
  pickup,
  categories,
  again,
  onPay,
  paying,
  error,
}: {
  pickup: Pickup;
  categories: Category[] | undefined;
  again: boolean;
  onPay: (body: PayBody) => void;
  paying: boolean;
  error: string | null;
}) {
  const { t, lang } = useT();
  const [trx, setTrx] = useState('');
  const method = (again ? pickup.payment?.method : pickup.paymentMethod) ?? 'CASH';
  const wallet = again ? pickup.payment?.walletNumber : pickup.walletNumber;
  const amount = formatTaka(pickup.totalAmount ?? 0, lang);
  const needsTrx = method !== 'CASH';
  const trxValue = trx.trim().toUpperCase();
  const trxError = needsTrx && trx.length > 0 && !TRX_RE.test(trxValue) ? t('trxInvalid') : null;
  const ready = !needsTrx || TRX_RE.test(trxValue);
  const methodName = t(`pay_${method}`);

  return (
    <Screen
      edges={['bottom']}
      style={{ padding: 0, gap: 0 }}
      footer={
        <>
          {error ? <Text style={[body(14, 600), { color: colors.alert }]}>{error}</Text> : null}
          <Button
            testID="paid"
            label={t('paidComplete')}
            icon="check-circle"
            disabled={!ready}
            loading={paying}
            onPress={() => onPay(needsTrx ? { method, trxId: trxValue } : { method })}
          />
        </>
      }
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.ground }}>
        <PageHeader
          back
          title={again ? t('payAgainTitle') : t('payTitle')}
          sub={again ? undefined : t('customerConfirmed', { name: pickup.household.name || t('customerFallback') })}
        />
      </SafeAreaView>
      <View style={s.body}>
        {again ? <Note tone="warn" icon="alert-triangle" text={t('payAgainBody')} /> : null}
        <View style={s.amount}>
          <Text style={[body(13), { color: colors.muted }]}>{t('amountToPay')}</Text>
          <Text testID="pay-amount" style={[display(36), { color: colors.money, lineHeight: 42 }]}>
            {amount}
          </Text>
          <Text style={[body(13), { color: colors.muted }]}>
            {t('kgAndItems', { kg: formatKg(pickup.totalKg ?? 0, lang), items: categoryNames(categories, pickup.lines.map((l) => l.categoryCode), lang) })}
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.methodRow}>
            <Text style={[body(13), { color: colors.muted, flex: 1 }]}>{t('customerChose')}</Text>
            <Badge label={methodName} tone="ink" />
          </View>
          {wallet ? (
            <Text testID="wallet" style={[display(20), { letterSpacing: 0.5 }]}>
              {localPhone(wallet, lang)}
            </Text>
          ) : null}
          <Text style={[body(14), { lineHeight: 21, color: colors.muted }]}>
            {needsTrx ? t('sendToNumber', { method: methodName, amount }) : t('cashHandOver', { amount })}
          </Text>
        </View>

        {needsTrx ? (
          <View style={{ gap: 6 }}>
            <Text style={[body(13), { color: colors.muted }]}>{t('enterTrxHelp', { method: methodName })}</Text>
            <Field
              testID="trx-input"
              label={t('trxLabel')}
              value={trx}
              onChangeText={setTrx}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={30}
              error={trxError}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  amount: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 18, gap: 4, ...cardShadow },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 10, borderWidth: 1.5, borderColor: colors.line },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
