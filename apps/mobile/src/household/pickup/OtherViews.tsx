import { formatKg, formatTaka, localDigits } from '@bw/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import type { Category, Pickup } from '../../api/types';
import { useT } from '../../i18n/lang';
import { formatDate, formatTime } from '../../lib/dhaka';
import { categoryName, localPhone } from '../../lib/format';
import { BackButton, Button, Card, Icon, Note, Screen } from '../../ui/components';
import { body, colors, display, minTouch } from '../../ui/theme';
import { collectorName, TotalsCard, WeighLines } from './shared';

/** DISPUTED: the household's weight objection is with the collector (REWEIGH) or our team (ADMIN_REVIEW). */
export function DisputedView({ pickup, categories }: { pickup: Pickup; categories: Category[] | undefined }) {
  const { t } = useT();
  const reweigh = pickup.openDispute?.status === 'REWEIGH';
  return (
    <Screen>
      <BackButton label={t('goHome')} />
      <View style={{ gap: 8 }}>
        <Text style={[display(28), { lineHeight: 34 }]}>{t(reweigh ? 'disputeReweighTitle' : 'disputeReviewTitle')}</Text>
        <Note tone="warn" icon={reweigh ? 'refresh-cw' : 'users'} text={t(reweigh ? 'disputeReweighBody' : 'disputeReviewBody')} />
      </View>
      {pickup.lines.length ? (
        <View style={{ gap: 8 }}>
          <Text style={display(19)}>{t('previousWeights')}</Text>
          <TotalsCard totalKg={pickup.totalKg ?? 0} totalAmount={pickup.totalAmount ?? 0} />
          <Card>
            <WeighLines lines={pickup.lines} categories={categories} />
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

/** CONFIRMED: weights approved, waiting for the collector to pay. */
export function PaymentWaitView({ pickup, categories }: { pickup: Pickup; categories: Category[] | undefined }) {
  const { t, lang } = useT();
  const amount = formatTaka(pickup.totalAmount ?? 0, lang);
  const method = pickup.paymentMethod ?? 'CASH';
  return (
    <Screen>
      <BackButton label={t('goHome')} />
      <View style={s.hero}>
        <View style={[s.badge, { backgroundColor: colors.signal }]}>
          <Icon name="clock" size={34} />
        </View>
        <Text style={[display(30), { textAlign: 'center' }]}>{t('waitingPaymentTitle')}</Text>
        <Text style={[body(16), { textAlign: 'center', lineHeight: 24 }]}>
          {method === 'CASH'
            ? t('waitingPaymentCash', { amount })
            : t('waitingPaymentWallet', {
                amount,
                method: t(`pay_${method}`),
                number: pickup.walletNumber ? localPhone(pickup.walletNumber, lang) : '',
              })}
        </Text>
      </View>
      <TotalsCard totalKg={pickup.totalKg ?? 0} totalAmount={pickup.totalAmount ?? 0} />
      <Card>
        <WeighLines lines={pickup.lines} categories={categories} />
      </Card>
    </Screen>
  );
}

/** H8: amount received, receipt lines, star rating, "not paid" report. */
export function ReceiptView({
  pickup,
  categories,
  onRate,
  onReportPayment,
}: {
  pickup: Pickup;
  categories: Category[] | undefined;
  onRate: (stars: number) => Promise<void>;
  onReportPayment: () => void;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [ratingNote, setRatingNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pay = pickup.payment;
  const amount = formatTaka(pay?.amount ?? pickup.totalAmount ?? 0, lang);
  const name = collectorName(pickup, t('collectorFallbackName'));
  const firstName = name.split(/\s+/)[0];
  const paidAt = pay?.paidAt ?? pickup.completedAt;
  const when = paidAt ? `${formatDate(paidAt, lang)}, ${formatTime(paidAt, lang)}` : '';

  const rate = async (n: number) => {
    if (saving || ratingNote) return;
    setStars(n);
    setSaving(true);
    try {
      await onRate(n);
      setRatingNote(t('ratingSaved'));
    } catch (e) {
      // The API has no "already rated" flag on the pickup; a second rating is refused with INVALID_STATE.
      if (e instanceof ApiError && e.code === 'INVALID_STATE') setRatingNote(t('ratingAlready'));
      else setStars(0);
    } finally {
      setSaving(false);
    }
  };

  const share = () => {
    const lines = pickup.lines
      .map((l) => `${t('receiptLine', { name: categoryName(categories, l.categoryCode, lang), kg: formatKg(l.kg, lang) })}: ${formatTaka(l.amount, lang)}`)
      .join('\n');
    Share.share({ message: t('shareReceiptText', { no: pickup.displayNo, lines, total: amount, when }) }).catch(() => {});
  };

  return (
    <Screen
      footer={
        <>
          <Button label={t('goHome')} icon="home" onPress={() => router.dismissTo('/home')} />
          <Button label={t('shareReceipt')} icon="share-2" variant="outline" onPress={share} />
        </>
      }
    >
      <View style={s.hero}>
        <View style={[s.badge, { backgroundColor: colors.money }]}>
          <Icon name="check" size={38} color={colors.surface} />
        </View>
        <Text testID="received" style={[display(44, 800), { textAlign: 'center', lineHeight: 50 }]}>
          {t('receivedAmount', { amount })}
        </Text>
        <Text style={[body(16), { textAlign: 'center' }]}>
          {pay?.method && pay.method !== 'CASH'
            ? t('paidToWallet', { method: t(`pay_${pay.method}`), number: pay.walletNumber ? localPhone(pay.walletNumber, lang) : '' })
            : t('paidByCash')}
        </Text>
        {pay?.trxId ? <Text style={[body(14), { color: colors.muted }]}>{t('trxId', { trxId: pay.trxId })}</Text> : null}
        {when ? <Text style={[body(14), { color: colors.muted }]}>{when}</Text> : null}
      </View>

      {pay?.status === 'REPORTED' || pickup.openDispute?.type === 'PAYMENT' ? (
        <Note tone="warn" icon="alert-circle" text={t('paymentReported')} />
      ) : null}

      <Card style={{ paddingVertical: 14, gap: 10 }}>
        <Text style={display(18)}>{t('receipt')}</Text>
        {pickup.lines.map((l) => (
          <View key={l.categoryCode} style={s.rcptRow}>
            <Text style={body(15)}>{t('receiptLine', { name: categoryName(categories, l.categoryCode, lang), kg: formatKg(l.kg, lang) })}</Text>
            <Text style={body(15, 600)}>{formatTaka(l.amount, lang)}</Text>
          </View>
        ))}
        <View style={[s.rcptRow, s.rcptTotal]}>
          <Text style={body(17, 700)}>{t('receiptTotal', { kg: formatKg(pickup.totalKg ?? 0, lang) })}</Text>
          <Text style={[body(17, 700), { color: colors.money }]}>{amount}</Text>
        </View>
        <Text style={[body(14), { color: colors.muted }]}>{t('collectorLabel', { name })}</Text>
      </Card>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={display(19)}>{t('rateCollector', { name: firstName })}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              testID={`star-${n}`}
              accessibilityRole="button"
              accessibilityLabel={t('starLabel', { count: localDigits(n, lang) })}
              accessibilityState={{ selected: n === stars, disabled: !!ratingNote }}
              disabled={!!ratingNote || saving}
              onPress={() => rate(n)}
              style={s.star}
            >
              <Icon name="star" size={32} color={n <= stars ? '#E0A800' : colors.ink} />
            </Pressable>
          ))}
        </View>
        {ratingNote ? <Text style={[body(15, 600), { color: colors.money }]}>{ratingNote}</Text> : null}
      </View>

      {pay?.status === 'PAID' && !pickup.openDispute ? (
        <Button label={t('paymentNotReceived')} icon="flag" variant="dangerLink" onPress={onReportPayment} style={{ alignSelf: 'center' }} />
      ) : null}
    </Screen>
  );
}

/** CANCELLED or EXPIRED, with "send it again". */
export function EndedView({ pickup, categories }: { pickup: Pickup; categories: Category[] | undefined }) {
  const { t, lang } = useT();
  const router = useRouter();
  const expired = pickup.status === 'EXPIRED';
  return (
    <Screen
      footer={<Button label={t('requestAgain')} icon="repeat" onPress={() => router.push('/sell/items')} />}
    >
      <BackButton label={t('goHome')} />
      <View style={s.hero}>
        <View style={[s.badge, { backgroundColor: colors.line }]}>
          <Icon name={expired ? 'clock' : 'x'} size={34} />
        </View>
        <Text style={[display(28), { textAlign: 'center' }]}>{t(expired ? 'expiredTitle' : 'cancelledTitle')}</Text>
        <Text style={[body(16), { textAlign: 'center', color: colors.muted }]}>{t(expired ? 'expiredBody' : 'cancelledBody')}</Text>
      </View>
      <Card style={{ padding: 16, gap: 4 }}>
        <Text style={body(16, 700)}>{pickup.categoryCodes.map((c) => categoryName(categories, c, lang)).join(', ')}</Text>
        <Text style={[body(14), { color: colors.muted }]}>
          {pickup.displayNo} · {formatDate(pickup.slotDate, lang)}
        </Text>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, paddingTop: 12 },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  rcptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rcptTotal: { paddingTop: 10, borderTopWidth: 2, borderTopColor: colors.ink },
  star: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
});
