import { formatTaka } from '@bw/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keys, useCategories, useIdempotencyKey, useTodayRates } from '../../../src/api/hooks';
import type { NearbyRequest } from '../../../src/api/types';
import { useSession } from '../../../src/auth/session';
import { useAccept } from '../../../src/collector/api';
import { currentPosition } from '../../../src/collector/location';
import { skipRequest } from '../../../src/collector/skipped';
import { KeyValue, cs } from '../../../src/collector/ui';
import { useSlotLabel } from '../../../src/household/pickup/shared';
import { useT } from '../../../src/i18n/lang';
import { categoryName, formatKm } from '../../../src/lib/format';
import { BackButton, Button, Divider, EmptyView, Note, Screen } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { body, colors, display } from '../../../src/ui/theme';

/**
 * C2: a nearby request before accepting: approximate area and distance only, the items at today's rates and
 * the payout estimate. Built from the nearby list (the API keeps the pickup itself private until accept).
 */
export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { api } = useSession();
  const request = qc.getQueryData<NearbyRequest[]>(keys.nearby)?.find((r) => r.id === id);
  const categories = useCategories();
  const rates = useTodayRates();
  const accept = useAccept();
  const idem = useIdempotencyKey();
  const slotLabel = useSlotLabel();
  const [problem, setProblem] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  if (!request) {
    return (
      <Screen>
        <BackButton />
        <EmptyView
          title={t('requestGone')}
          action={<Button label={t('backToRequests')} icon="arrow-left" variant="outline" onPress={() => router.replace('/requests')} />}
        />
      </Screen>
    );
  }

  const onAccept = async () => {
    setProblem(null);
    // Accept checks the distance from the last ping, so send a fresh one first.
    setLocating(true);
    const pos = await currentPosition();
    if (pos.ok) await api.request('PUT', '/collector/location', { body: pos.position }).catch(() => {});
    setLocating(false);
    if (!pos.ok) {
      setProblem(pos.reason === 'denied' ? t('locationForOnline') : t('locationUnavailable'));
      return;
    }
    accept.mutate({ id, key: idem.keyFor({ id }) }, { onSuccess: (pickup) => router.replace(`/job/${pickup.id}`) });
  };

  const rateLabel = (code: string) => {
    const c = categories.data?.find((x) => x.code === code);
    if (c?.pricingType === 'ON_INSPECTION') return t('onInspection');
    const rate = rates.data?.rates?.find((r) => r.categoryCode === code)?.ratePerKg;
    return rate == null ? t('noRate') : t('perKgPrice', { price: formatTaka(rate, lang) });
  };

  const error = problem ?? (accept.error ? errorMessage(accept.error, lang) : null);
  const gone = accept.error !== null && !problem && ['ALREADY_TAKEN', 'INVALID_STATE', 'NOT_FOUND'].includes((accept.error as { code?: string }).code ?? '');

  return (
    <Screen
      footer={
        <>
          {error ? <Text style={[body(15, 600), { color: colors.alert }]}>{error}</Text> : null}
          {gone ? (
            <Button label={t('backToRequests')} icon="arrow-left" variant="outline" onPress={() => router.replace('/requests')} />
          ) : (
            <View style={s.actions}>
              <Button
                label={t('skip')}
                icon="x"
                variant="outline"
                onPress={() => {
                  skipRequest(id);
                  router.back();
                }}
                style={{ flex: 1 }}
              />
              <Button testID="accept" label={t('acceptRequest')} icon="check" loading={locating || accept.isPending} onPress={onAccept} style={{ flex: 2 }} />
            </View>
          )}
        </>
      }
    >
      <View style={{ gap: 4 }}>
        <BackButton />
        <Text style={[display(28), { lineHeight: 34 }]}>{request.area}</Text>
        <Text style={[body(15, 600), { color: colors.money }]}>{t('distanceFromYou', { km: formatKm(request.distanceM, lang) })}</Text>
      </View>
      <Note icon="lock" text={t('addressAfterAccept')} />

      <Text style={cs.sectionTitle}>{t('timeAndWeight')}</Text>
      <View style={cs.section}>
        <KeyValue label={t('time')} value={slotLabel(request)} />
        <KeyValue label={t('estWeight')} value={t(`band_${request.weightBand}`)} last />
      </View>

      <Text style={cs.sectionTitle}>{t('itemsAndRates')}</Text>
      <View style={cs.section}>
        {request.categoryCodes.map((code, i) => (
          <View key={code}>
            {i > 0 ? <Divider /> : null}
            <View style={s.item}>
              <Text style={[body(16, 700), { flex: 1 }]}>{categoryName(categories.data, code, lang)}</Text>
              <Text style={[body(15), { color: colors.muted }]}>{rateLabel(code)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.estimate}>
        <Text style={[body(15), { color: '#D3DCE5' }]}>{t('estToPay')}</Text>
        <Text testID="estimate" style={[display(28, 800), { color: colors.signal }]}>
          {request.estimate?.min != null && request.estimate.max != null
            ? `${formatTaka(request.estimate.min, lang)}–${formatTaka(request.estimate.max, lang).replace('৳', '')}`
            : t('onInspection')}
        </Text>
      </View>
      <Note icon="zap" text={t('firstAcceptWins')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  estimate: { backgroundColor: colors.ink, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, gap: 4 },
});
