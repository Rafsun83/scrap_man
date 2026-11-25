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
import { IconTile, SectionLabel } from '../../ui/parts';
import { body, cardShadow, colors, display, minTouch, radius, tones } from '../../ui/theme';
import { collectorName, TotalsCard, WeighLines } from './shared';

/** DISPUTED: the household's weight objection is with the collector (REWEIGH) or our team (ADMIN_REVIEW). */
export function DisputedView({ pickup, categories }: { pickup: Pickup; categories: Category[] | undefined }) {
  const { t } = useT();
  const reweigh = pickup.openDispute?.status === 'REWEIGH';
  return (
    <Screen>
      <BackButton label={t('goHome')} />
      <View style={{ gap: 8 }}>
        <Text style={[display(24), { lineHeight: 30 }]}>{t(reweigh ? 'disputeReweighTitle' : 'disputeReviewTitle')}</Text>
        <Note tone="warn" icon={reweigh ? 'refresh-cw' : 'users'} text={t(reweigh ? 'disputeReweighBody' : 'disputeReviewBody')} />
      </View>
      {pickup.lines.length ? (
        <View style={{ gap: 8 }}>
          <SectionLabel>{t('previousWeights')}</SectionLabel>
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
        <IconTile icon="clock" tint="#FFF4D6" color="#8A5A00" size={64} />
        <Text style={[display(24), { textAlign: 'center' }]}>{t('waitingPaymentTitle')}</Text>
        <Text style={[body(15), { textAlign: 'center', lineHeight: 23, color: colors.muted }]}>
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

/** H8 (v1 design `household/Receipt.dc.html`): amount received, receipt lines, star rating, "not paid" report. */
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
  const saved = pickup.rating?.stars ?? 0;
  const [stars, setStars] = useState(saved);
  const [ratingNote, setRatingNote] = useState<string | null>(saved ? t('ratedStars', { count: localDigits(saved, lang) }) : null);
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
      // Rated from another device since this screen loaded: the API refuses a second rating.
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
        <IconTile icon="check" tint={tones.doneBg} color={colors.money} size={64} />
        <Text testID="received" style={[display(32), { textAlign: 'center', lineHeight: 40, color: colors.money }]}>
          {t('receivedAmount', { amount })}
        </Text>
        <Text style={[body(15), { textAlign: 'center' }]}>
          {pay?.method && pay.method !== 'CASH'
            ? t('paidToWallet', { method: t(`pay_${pay.method}`), number: pay.walletNumber ? localPhone(pay.walletNumber, lang) : '' })
            : t('paidByCash')}
        </Text>
        {pay?.trxId ? <Text style={[body(13), { color: colors.muted }]}>{t('trxId', { trxId: pay.trxId })}</Text> : null}
        {when ? <Text style={[body(13), { color: colors.muted }]}>{when}</Text> : null}
      </View>

      {pay?.status === 'REPORTED' || pickup.openDispute?.type === 'PAYMENT' ? (
        <Note tone="warn" icon="alert-circle" text={t('paymentReported')} />
      ) : null}

      <Card style={{ paddingVertical: 14, gap: 10 }}>
        <Text style={body(14, 600)}>{t('receipt')}</Text>
        {pickup.lines.map((l) => (
          <View key={l.categoryCode} style={s.rcptRow}>
            <Text style={body(15)}>{t('receiptLine', { name: categoryName(categories, l.categoryCode, lang), kg: formatKg(l.kg, lang) })}</Text>
            <Text style={body(15, 600)}>{formatTaka(l.amount, lang)}</Text>
          </View>
        ))}
        <View style={[s.rcptRow, s.rcptTotal]}>
          <Text style={body(15, 600)}>{t('receiptTotal', { kg: formatKg(pickup.totalKg ?? 0, lang) })}</Text>
          <Text style={[display(19), { color: colors.money }]}>{amount}</Text>
        </View>
        <Text style={[body(13), { color: colors.muted }]}>{t('collectorLabel', { name })}</Text>
      </Card>

      <View style={s.rating}>
        <Text style={body(15, 600)}>{t('rateCollector', { name: firstName })}</Text>
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
              <Icon name="star" size={30} color={n <= stars ? '#E0A800' : tones.ring} />
            </Pressable>
          ))}
        </View>
        {ratingNote ? <Text style={[body(14, 600), { color: colors.money }]}>{ratingNote}</Text> : null}
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
        <IconTile icon={expired ? 'clock' : 'x'} tint={tones.cancelledBg} color={colors.muted} size={64} />
        <Text style={[display(24), { textAlign: 'center' }]}>{t(expired ? 'expiredTitle' : 'cancelledTitle')}</Text>
        <Text style={[body(15), { textAlign: 'center', color: colors.muted, lineHeight: 23 }]}>{t(expired ? 'expiredBody' : 'cancelledBody')}</Text>
      </View>
      <Card style={{ padding: 16, gap: 4 }}>
        <Text style={body(15, 600)}>{pickup.categoryCodes.map((c) => categoryName(categories, c, lang)).join(', ')}</Text>
        <Text style={[body(14), { color: colors.muted }]}>
          {pickup.displayNo} · {formatDate(pickup.slotDate, lang)}
        </Text>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, paddingTop: 12 },
  rcptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rcptTotal: { paddingTop: 10, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: tones.ring },
  rating: { alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, ...cardShadow },
  star: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
});
