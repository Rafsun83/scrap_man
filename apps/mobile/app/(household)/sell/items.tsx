import { localDigits, WEIGHT_BANDS } from '@bw/shared';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useCategories, useTodayRates } from '../../../src/api/hooks';
import { StepHeader } from '../../../src/household/StepHeader';
import { choosePhoto } from '../../../src/household/photoPicker';
import { rateRows } from '../../../src/household/RateBoard';
import { useSellDraft } from '../../../src/household/sellDraft';
import { useT } from '../../../src/i18n/lang';
import { Button, Chip, ErrorView, LoadingView, Screen } from '../../../src/ui/components';
import { categoryLook, DashedButton, IconTile, SectionLabel, SelectCard } from '../../../src/ui/parts';
import { errorMessage } from '../../../src/ui/errors';
import { body, colors, display, radius } from '../../../src/ui/theme';

/** H3 (v1 design `household/SelectItems.dc.html`): category cards (multi-select), weight band, optional photo. */
export default function SelectItems() {
  const { t, lang } = useT();
  const router = useRouter();
  const categories = useCategories();
  const rates = useTodayRates();
  const { draft, update } = useSellDraft();

  if (categories.isPending || rates.isPending) return <LoadingView />;
  if (categories.isError || rates.isError) {
    return <ErrorView message={errorMessage(categories.error ?? rates.error, lang)} onRetry={() => rates.refetch()} />;
  }

  const rows = rateRows(categories.data, rates.data.rates, lang, t('onInspection'));
  const selected = new Set(draft.categoryCodes);
  const count = selected.size;

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    // Keep category display order.
    update({ categoryCodes: rows.map((r) => r.code).filter((c) => next.has(c)) });
  };

  return (
    <Screen
      footer={
        <View style={s.footerRow}>
          <Text style={[body(16, 600), { flex: 1 }]}>
            {count > 0 ? t('itemsSelected', { count: localDigits(count, lang) }) : t('nothingSelected')}
          </Text>
          <Button
            testID="items-next"
            label={t('next')}
            icon="arrow-right"
            disabled={count === 0}
            onPress={() => router.push('/sell/schedule')}
            style={{ minWidth: 150 }}
          />
        </View>
      }
    >
      <StepHeader step={1} />
      <View style={{ gap: 4 }}>
        <Text style={[display(24), { lineHeight: 30 }]}>{t('whatToSell')}</Text>
        <Text style={[body(14), { color: colors.muted }]}>{t('pickOneOrMore')}</Text>
      </View>

      <View style={s.grid}>
        {rows.map((r) => {
          const on = selected.has(r.code);
          const unavailable = !r.onInspection && r.ratePerKg === null;
          const look = categoryLook(categories.data, r.code);
          return (
            <SelectCard
              key={r.code}
              testID={`category-${r.code}`}
              role="checkbox"
              selected={on}
              disabled={unavailable}
              onPress={() => toggle(r.code)}
              style={s.card}
            >
              <IconTile icon={look.icon} tint={look.tint} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={body(15, 600)} numberOfLines={2}>
                  {r.name}
                </Text>
                <Text style={[body(13), { color: colors.muted }]}>
                  {r.onInspection ? r.price : unavailable ? t('noRate') : t('perKgPrice', { price: r.price })}
                </Text>
              </View>
            </SelectCard>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>{t('weightQuestion')}</SectionLabel>
        <View style={s.chips}>
          {WEIGHT_BANDS.map((band) => (
            <Chip
              key={band}
              label={t(`band_${band}`)}
              selected={draft.weightBand === band}
              onPress={() => update({ weightBand: band })}
            />
          ))}
        </View>
        <Text style={[body(13), { color: colors.muted }]}>{t('minimumNote')}</Text>
      </View>

      {draft.photo ? (
        <View style={s.photoRow}>
          <Image source={{ uri: draft.photo.uri }} style={s.thumb} accessibilityLabel={t('photoAdded')} />
          <Text style={[body(15, 600), { flex: 1 }]}>{t('photoAdded')}</Text>
          <Button label={t('removePhoto')} icon="trash-2" variant="dangerLink" onPress={() => update({ photo: null })} />
        </View>
      ) : (
        <DashedButton
          icon="camera"
          title={t('takePhoto')}
          sub={t('takePhotoSub')}
          onPress={async () => {
            const photo = await choosePhoto(lang);
            if (photo) update({ photo });
          }}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47%', flexGrow: 1, minHeight: 76, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
