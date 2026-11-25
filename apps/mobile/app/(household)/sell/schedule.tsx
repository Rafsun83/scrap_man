import { formatTaka, type TimeSlot } from '@bw/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  useAddresses,
  useCategories,
  useCreatePickup,
  useIdempotencyKey,
  usePhotoUpload,
  useTodayRates,
} from '../../../src/api/hooks';
import type { CreatePickup } from '../../../src/api/types';
import { useSellDraft } from '../../../src/household/sellDraft';
import { StepHeader } from '../../../src/household/StepHeader';
import { useT } from '../../../src/i18n/lang';
import { bookableDays, firstOpenSlot, formatShortDay, relativeDay } from '../../../src/lib/dhaka';
import { previewEstimate } from '../../../src/lib/estimate';
import { categoryName } from '../../../src/lib/format';
import { Button, ErrorView, Field, LoadingView, Note, RadioRow, Screen } from '../../../src/ui/components';
import { IconTile, SectionLabel, SelectCard } from '../../../src/ui/parts';
import { errorMessage } from '../../../src/ui/errors';
import { body, borderWidth, colors, display, radius } from '../../../src/ui/theme';

/** H4 (v1 design `household/Schedule.dc.html`): address, day and slot, note, estimated payout; sends the request. */
export default function Schedule() {
  const { t, lang } = useT();
  const router = useRouter();
  const { draft, clear } = useSellDraft();
  const categories = useCategories();
  const rates = useTodayRates();
  const addresses = useAddresses();
  const create = useCreatePickup();
  const idem = useIdempotencyKey();
  const upload = usePhotoUpload();

  const days = useMemo(() => bookableDays(), []);
  const first = firstOpenSlot(days);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [choosingAddress, setChoosingAddress] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(first?.date ?? days[0].date);
  const [slot, setSlot] = useState<TimeSlot | null>(first?.slot ?? null);
  const sent = useRef(false);

  // Default address once addresses load.
  useEffect(() => {
    if (!addressId && addresses.data?.length) {
      setAddressId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id ?? null);
    }
  }, [addresses.data, addressId]);

  // Nothing chosen yet (e.g. back from a finished request): go to step 1.
  useEffect(() => {
    if (draft.categoryCodes.length === 0 && !sent.current) router.replace('/sell/items');
  }, [draft.categoryCodes.length, router]);

  if (categories.isPending || rates.isPending || addresses.isPending) return <LoadingView />;
  if (categories.isError || rates.isError || addresses.isError) {
    return (
      <ErrorView
        message={errorMessage(categories.error ?? rates.error ?? addresses.error, lang)}
        onRetry={() => addresses.refetch()}
      />
    );
  }

  const address = addresses.data.find((a) => a.id === addressId) ?? null;
  const day = days.find((d) => d.date === date) ?? days[0];
  const slotOpen = slot ? day.slots.find((s) => s.slot === slot)?.open : false;

  const perKgRates = draft.categoryCodes
    .map((code) => {
      const cat = categories.data.find((c) => c.code === code);
      if (cat?.pricingType !== 'PER_KG') return null;
      return rates.data.rates?.find((r) => r.categoryCode === code)?.ratePerKg ?? null;
    })
    .filter((r): r is number => r !== null);
  const estimate = previewEstimate(draft.weightBand, perKgRates);

  const body_: CreatePickup | null =
    address?.id && slot && slotOpen
      ? {
          addressId: address.id,
          categoryCodes: draft.categoryCodes,
          weightBand: draft.weightBand,
          slotDate: date,
          slot,
          ...(note.trim() ? { note: note.trim() } : {}),
        }
      : null;

  const send = () => {
    if (!body_) return;
    create.mutate(
      { body: body_, key: idem.keyFor(body_) },
      {
        onSuccess: async (pickup) => {
          if (draft.photo) {
            try {
              await upload(pickup.id, draft.photo);
            } catch {
              Alert.alert(t('photoUploadFailed'));
            }
          }
          sent.current = true;
          idem.reset();
          clear();
          router.dismissAll();
          router.push(`/pickup/${pickup.id}`);
        },
      },
    );
  };

  const dayLabel = (d: string) => {
    const rel = relativeDay(d, lang);
    return rel === 'today' ? t('today') : rel === 'tomorrow' ? t('tomorrow') : rel;
  };

  return (
    <Screen
      footer={
        <>
          <View style={s.estimateRow}>
            <Text style={[body(14), { color: colors.muted }]}>{t('estimatedPayout')}</Text>
            <Text style={[display(21), { color: colors.money, flexShrink: 1, textAlign: 'right' }]}>
              {estimate ? `${formatTaka(estimate.min, lang)}–${formatTaka(estimate.max, lang).slice(1)}` : t('estimateNone')}
            </Text>
          </View>
          {create.error ? <Text style={[body(14, 600), { color: colors.alert }]}>{errorMessage(create.error, lang)}</Text> : null}
          <Button
            testID="send-request"
            label={t('sendRequest')}
            icon="send"
            loading={create.isPending}
            disabled={!body_}
            onPress={send}
          />
        </>
      }
    >
      <StepHeader step={2} />
      <Text style={[display(24), { lineHeight: 30 }]}>{t('whenToCome')}</Text>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t('address')}</SectionLabel>
        {address ? (
          <SelectCard selected={false} onPress={() => (addresses.data.length > 1 ? setChoosingAddress((v) => !v) : router.push('/address'))} style={s.addrCard}>
            <IconTile icon="map-pin" tint="#FFF4D6" />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={body(15, 600)}>{address.label}</Text>
              <Text style={[body(13), { color: colors.muted }]} numberOfLines={2}>
                {address.line}, {address.area}
              </Text>
            </View>
            {addresses.data.length > 1 ? <Text style={body(14, 600)}>{t('change')}</Text> : null}
          </SelectCard>
        ) : (
          <View style={{ gap: 8 }}>
            <Note tone="warn" icon="map-pin" text={t('needAddress')} />
            <Button label={t('addAddress')} icon="plus" variant="outline" onPress={() => router.push('/address')} />
          </View>
        )}
        {choosingAddress ? (
          <View style={{ gap: 8 }} accessibilityLabel={t('chooseAddress')}>
            {addresses.data.map((a) => (
              <RadioRow
                key={a.id}
                label={a.label}
                sub={`${a.line}, ${a.area}`}
                selected={a.id === addressId}
                onPress={() => {
                  setAddressId(a.id ?? null);
                  setChoosingAddress(false);
                }}
              />
            ))}
            <Button label={t('addAddress')} icon="plus" variant="link" onPress={() => router.push('/address')} />
          </View>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>{t('day')}</SectionLabel>
        <View style={s.days}>
          {days.map((d) => {
            const on = d.date === date;
            const anyOpen = d.slots.some((x) => x.open);
            return (
              <SelectCard
                key={d.date}
                role="radio"
                selected={on}
                disabled={!anyOpen}
                onPress={() => {
                  setDate(d.date);
                  const keep = d.slots.find((x) => x.slot === slot)?.open;
                  setSlot(keep ? slot : (d.slots.find((x) => x.open)?.slot ?? null));
                }}
                style={s.day}
              >
                <Text style={body(15, on ? 600 : 500)}>{dayLabel(d.date)}</Text>
                <Text style={[body(12), { color: colors.muted }]}>{formatShortDay(d.date, lang)}</Text>
              </SelectCard>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>{t('time')}</SectionLabel>
        {day.slots.every((x) => !x.open) ? <Note tone="warn" text={t('noSlotsLeft')} /> : null}
        {day.slots.map((x) => (
          <RadioRow
            key={x.slot}
            testID={`slot-${x.slot}`}
            label={t(`slot_${x.slot}`)}
            sub={x.open ? undefined : t('slotOver')}
            selected={slot === x.slot}
            disabled={!x.open}
            onPress={() => setSlot(x.slot)}
          />
        ))}
      </View>

      <Field
        label={t('noteForCollector')}
        value={note}
        onChangeText={setNote}
        placeholder={t('notePlaceholder')}
        multiline
        maxLength={200}
      />

      <View style={{ gap: 8 }}>
        <SectionLabel>{t('yourSale')}</SectionLabel>
        <View style={s.pills}>
          {draft.categoryCodes.map((code) => (
            <Text key={code} style={[body(13, 500), s.pill]}>
              {categoryName(categories.data, code, lang)}
            </Text>
          ))}
        </View>
        <Text style={[body(13), { color: colors.muted }]}>{t('finalAfterWeigh')}</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  addrCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12 },
  days: { flexDirection: 'row', gap: 8 },
  day: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, borderWidth, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
});
