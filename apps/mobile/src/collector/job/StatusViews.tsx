import { formatKg, formatTaka, localDigits } from '@bw/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { Category, Pickup } from '../../api/types';
import { WeighLines } from '../../household/pickup/shared';
import { useT } from '../../i18n/lang';
import { BackButton, Button, Card, Icon, Note, Screen, type IconName } from '../../ui/components';
import { body, colors, display } from '../../ui/theme';

function StatusScreen({
  icon,
  tone = 'plain',
  title,
  text,
  children,
}: {
  icon: IconName;
  tone?: 'plain' | 'done' | 'alert';
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const bg = tone === 'done' ? '#DCEFE7' : tone === 'alert' ? '#F6E3DA' : colors.selectedTint;
  const fg = tone === 'done' ? colors.money : tone === 'alert' ? colors.alert : colors.ink;
  return (
    <Screen footer={<Button label={t('backToRequests')} icon="map-pin" variant="outline" onPress={() => router.dismissTo('/requests')} />}>
      <BackButton />
      <View style={[s.badge, { backgroundColor: bg }]}>
        <Icon name={icon} size={34} color={fg} />
      </View>
      <Text style={[display(26), { lineHeight: 32 }]}>{title}</Text>
      {text ? <Text style={[body(16), { color: colors.muted, lineHeight: 24 }]}>{text}</Text> : null}
      {children}
    </Screen>
  );
}

/** WEIGHED: the household is checking the weights; the payment screen opens on `pickup.confirmed`. */
export function WaitConfirmView({ pickup, categories }: { pickup: Pickup; categories: Category[] | undefined }) {
  const { t } = useT();
  return (
    <StatusScreen icon="clock" title={t('waitConfirmTitle')} text={t('waitConfirmBody')}>
      <Card>
        <WeighLines lines={pickup.lines} categories={categories} />
      </Card>
    </StatusScreen>
  );
}

/** DISPUTED with staff (second rejection, or a team re-weigh). */
export function ReviewView() {
  const { t } = useT();
  return <StatusScreen icon="shield" tone="alert" title={t('reviewTitle')} text={t('reviewBody')} />;
}

/** COMPLETED. A "not received" report under review shows as a note. */
export function DoneView({ pickup }: { pickup: Pickup }) {
  const { t, lang } = useT();
  const reported = pickup.payment?.status === 'REPORTED';
  return (
    <StatusScreen
      icon="check-circle"
      tone="done"
      title={t('doneTitle')}
      text={t('donePaid', { amount: formatTaka(pickup.totalAmount ?? 0, lang), kg: formatKg(pickup.totalKg ?? 0, lang) })}
    >
      {reported ? <Note tone="alert" icon="alert-triangle" text={t('paymentReportedCollector')} /> : null}
      {pickup.rating ? <Note icon="star" text={t('ratingReceived', { count: localDigits(pickup.rating.stars, lang) })} /> : null}
    </StatusScreen>
  );
}

/** Cancelled, expired, or no longer this collector's. */
export function EndedView() {
  const { t } = useT();
  return <StatusScreen icon="x-circle" tone="alert" title={t('jobCancelledTitle')} text={t('jobCancelledBody')} />;
}

const s = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
