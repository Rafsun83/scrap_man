import { localDigits, WEIGHT_BANDS } from '@bw/shared';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCategories, useTodayRates } from '../../../src/api/hooks';
import { StepHeader } from '../../../src/household/StepHeader';
import { choosePhoto } from '../../../src/household/photoPicker';
import { rateRows } from '../../../src/household/RateBoard';
import { useSellDraft } from '../../../src/household/sellDraft';
import { useT } from '../../../src/i18n/lang';
import { Button, Chip, ErrorView, Icon, LoadingView, Screen, type IconName } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { body, colors, display, radius, tones } from '../../../src/ui/theme';

const CATEGORY_ICONS: Record<string, IconName> = {
  iron: 'tool',
  newspaper: 'file-text',
  bottle: 'droplet',
  carton: 'package',
  can: 'archive',
  device: 'monitor',
};

/** H3: category cards (multi-select), weight band, optional photo. */
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
        <Text style={[display(28), { lineHeight: 34 }]}>{t('whatToSell')}</Text>
        <Text style={[body(16), { color: colors.muted }]}>{t('pickOneOrMore')}</Text>
      </View>

      <View style={s.grid}>
        {rows.map((r) => {
          const on = selected.has(r.code);
          const unavailable = !r.onInspection && r.ratePerKg === null;
          const icon = CATEGORY_ICONS[categories.data.find((c) => c.code === r.code)?.icon ?? ''] ?? 'box';
          return (
            <Pressable
              key={r.code}
              testID={`category-${r.code}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: unavailable }}
              disabled={unavailable}
              onPress={() => toggle(r.code)}
              style={[
                s.card,
                { borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.selectedTint : colors.surface },
                unavailable && { opacity: 0.5 },
              ]}
            >
              <Icon name={icon} size={28} />
              <Text style={body(17, 700)}>{r.name}</Text>
              <Text style={[body(14), { color: colors.muted }]}>
                {r.onInspection ? r.price : unavailable ? t('noRate') : t('perKgPrice', { price: r.price })}
              </Text>
              {on ? (
                <View style={s.check}>
                  <Icon name="check" size={16} color={colors.signal} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={display(19)}>{t('weightQuestion')}</Text>
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
        <Text style={[body(14), { color: colors.muted }]}>{t('minimumNote')}</Text>
      </View>

      {draft.photo ? (
        <View style={s.photoRow}>
          <Image source={{ uri: draft.photo.uri }} style={s.thumb} accessibilityLabel={t('photoAdded')} />
          <Text style={[body(16, 700), { flex: 1 }]}>{t('photoAdded')}</Text>
          <Button label={t('removePhoto')} icon="trash-2" variant="dangerLink" onPress={() => update({ photo: null })} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            const photo = await choosePhoto(lang);
            if (photo) update({ photo });
          }}
          style={s.photoBtn}
        >
          <Icon name="camera" size={26} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={body(16, 700)}>{t('takePhoto')}</Text>
            <Text style={[body(14), { color: colors.muted }]}>{t('takePhotoSub')}</Text>
          </View>
        </Pressable>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 112,
    padding: 14,
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tones.dashed,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
