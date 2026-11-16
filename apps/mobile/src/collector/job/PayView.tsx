import { formatKg, formatTaka } from '@bw/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Category, PaymentMethod, Pickup } from '../../api/types';
import { useT } from '../../i18n/lang';
import { categoryNames, localPhone } from '../../lib/format';
import { Button, Field, Icon, Note, Screen } from '../../ui/components';
import { body, colors, display, radius } from '../../ui/theme';
import { NavyHeader } from '../ui';

const TRX_RE = /^[A-Za-z0-9]{6,30}$/;

export type PayBody = { method: PaymentMethod; trxId?: string };

/**
 * C5: the household confirmed; pay the server's total by the method they chose. bKash and Nagad need the TrxID
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
          {error ? <Text style={[body(15, 600), { color: colors.alert }]}>{error}</Text> : null}
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
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.ink }}>
        <NavyHeader
          back
          title={again ? t('payAgainTitle') : t('payTitle')}
          sub={again ? undefined : t('customerConfirmed', { name: pickup.household.name || t('customerFallback') })}
        />
      </SafeAreaView>
      <View style={s.body}>
        {again ? <Note tone="warn" icon="alert-triangle" text={t('payAgainBody')} /> : null}
        <View style={s.amount}>
          <Text style={[body(15), { color: '#D3DCE5' }]}>{t('amountToPay')}</Text>
          <Text testID="pay-amount" style={[display(40, 800), { color: colors.signal }]}>
            {amount}
          </Text>
          <Text style={[body(14), { color: '#D3DCE5' }]}>
            {t('kgAndItems', { kg: formatKg(pickup.totalKg ?? 0, lang), items: categoryNames(categories, pickup.lines.map((l) => l.categoryCode), lang) })}
          </Text>
        </View>

        <View style={s.card}>
          <Text style={[body(14), { color: colors.muted }]}>{t('customerChose')}</Text>
          <View style={s.methodRow}>
            <Icon name={needsTrx ? 'smartphone' : 'dollar-sign'} />
            <Text style={[display(22), { flex: 1 }]}>{methodName}</Text>
            {wallet ? <Text testID="wallet" style={display(20)}>{localPhone(wallet, lang)}</Text> : null}
          </View>
          <Text style={[body(15), { lineHeight: 22 }]}>
            {needsTrx ? t('sendToNumber', { method: methodName, amount }) : t('cashHandOver', { amount })}
          </Text>
        </View>

        {needsTrx ? (
          <View style={{ gap: 6 }}>
            <Text style={[body(15), { color: colors.muted }]}>{t('enterTrxHelp', { method: methodName })}</Text>
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
  amount: { backgroundColor: colors.ink, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, gap: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 10 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
