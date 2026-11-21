import { formatKg, formatTaka, localDigits } from '@bw/shared';
import { useCallback, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Category, Pickup, Rate } from '../../api/types';
import { useT } from '../../i18n/lang';
import { categoryName } from '../../lib/format';
import { TotalsLabelCard } from './parts';
import { Button, Icon, Note, Screen } from '../../ui/components';
import { errorMessage } from '../../ui/errors';
import { body, colors, display, radius, tones } from '../../ui/theme';
import { takePhoto } from '../camera';
import { NavyHeader } from '../ui';
import { initialLines, parseKg, previewTotals, rateLookup, stepKg, toWeightLines, type DraftLine } from '../weigh';
import { PhotoUploadError, useWeighDraft } from '../weighDraft';

/**
 * C4 (first weigh, ARRIVED) and C10 (re-weigh after the household's first dispute). Kg steppers in 0.5 kg steps
 * with typed entry to 0.1 kg, a quote for inspection items, items found at the door, an optional scale photo,
 * and a live total that previews the server's sum. The round is kept on the phone and retried when offline.
 */
export function WeighView({
  pickup,
  categories,
  todayRates,
  mode,
}: {
  pickup: Pickup;
  categories: Category[] | undefined;
  todayRates: Rate[] | undefined;
  mode: 'first' | 'reweigh';
}) {
  const { t, lang } = useT();
  const toLines = useCallback((lines: DraftLine[]) => toWeightLines(lines, categories), [categories]);
  const initial = useCallback(() => initialLines(pickup), [pickup]);
  const { draft, setLines, setPhoto, send, sending, error } = useWeighDraft(pickup, initial, toLines);
  const [picking, setPicking] = useState(false);
  const rateOf = useMemo(() => rateLookup(pickup.lockedRates, todayRates), [pickup.lockedRates, todayRates]);

  if (!draft) return null;
  const lines = draft.lines;
  const preview = previewTotals(lines, categories, rateOf);
  const ready = toLines(lines) !== null;
  const reweigh = mode === 'reweigh';
  const previous = pickup.lines;

  const change = (i: number, next: Partial<DraftLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...next } : l)));
  const remove = (i: number) => setLines(lines.filter((_, j) => j !== i));
  // Items found at the door: any category not on the list yet that can be priced today.
  const addable = (categories ?? []).flatMap((c) =>
    c.code &&
    !lines.some((l) => l.categoryCode === c.code) &&
    (c.pricingType === 'ON_INSPECTION' || todayRates?.some((r) => r.categoryCode === c.code && r.ratePerKg != null))
      ? [c.code]
      : [],
  );

  const rateText = (code: string) => {
    const c = categories?.find((x) => x.code === code);
    if (c?.pricingType === 'ON_INSPECTION') return t('onInspection');
    const rate = rateOf(code);
    return rate === null ? t('noRate') : t('perKgPrice', { price: formatTaka(rate, lang) });
  };

  return (
    <Screen
      edges={['bottom']}
      style={{ padding: 0, gap: 0 }}
      footer={
        <>
          {draft.queued ? <Note tone="warn" icon="wifi-off" text={t('weighQueued')} /> : null}
          {error ? (
            <Text style={[body(15, 600), { color: colors.alert }]}>
              {error instanceof PhotoUploadError ? t('scalePhotoUploadFailed') : errorMessage(error, lang)}
            </Text>
          ) : null}
          {!ready ? <Text style={[body(14), { color: colors.muted }]}>{t('weighIncomplete')}</Text> : null}
          <Button
            testID="send-weights"
            label={sending ? t('weighSending') : reweigh ? t('sendNewWeights') : t('sendForConfirm')}
            icon="send"
            disabled={!ready}
            loading={sending}
            onPress={() => void send()}
          />
        </>
      }
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.ink }}>
        <NavyHeader back title={reweigh ? t('reweighTitle') : t('weighTitle')} sub={reweigh ? t('reweighSub') : t('weighSub')} />
      </SafeAreaView>
      <View style={s.body}>
        {reweigh && pickup.openDispute ? (
          <View style={s.dispute}>
            <Icon name="alert-circle" color={colors.alert} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={body(16, 700)}>{t('disputedBy', { name: pickup.household.name || t('customerFallback') })}</Text>
              {pickup.openDispute.reason ? <Text style={[body(15), { color: colors.muted }]}>“{pickup.openDispute.reason}”</Text> : null}
            </View>
          </View>
        ) : null}

        {lines.map((l, i) => {
          const name = categoryName(categories, l.categoryCode, lang);
          const inspection = categories?.find((c) => c.code === l.categoryCode)?.pricingType === 'ON_INSPECTION';
          const listed = pickup.categoryCodes.includes(l.categoryCode);
          const before = previous.find((p) => p.categoryCode === l.categoryCode);
          return (
            <View key={l.categoryCode} style={s.line} testID={`line-${l.categoryCode}`}>
              <View style={s.lineTop}>
                <Text style={[body(17, 700), { flex: 1 }]}>{name}</Text>
                <Text style={[body(14), { color: colors.muted }]}>{rateText(l.categoryCode)}</Text>
                {!listed ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('removeItem', { item: name })} onPress={() => remove(i)} hitSlop={12} style={s.remove}>
                    <Icon name="trash-2" size={20} color={colors.alert} />
                  </Pressable>
                ) : null}
              </View>
              {reweigh && before ? <Text style={[body(14), { color: colors.muted }]}>{t('beforeKg', { kg: formatKg(before.kg, lang) })}</Text> : null}
              <View style={s.lineBottom}>
                <View style={s.stepper}>
                  <Pressable
                    testID={`dec-${l.categoryCode}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('kgDecrease', { item: name })}
                    onPress={() => change(i, { kg: stepKg(l.kg, -1) })}
                    style={[s.step, { backgroundColor: colors.surface }]}
                  >
                    <Icon name="minus" size={20} />
                  </Pressable>
                  <KgInput kg={l.kg} label={t('kgInput', { item: name })} onChange={(kg) => change(i, { kg })} testID={`kg-${l.categoryCode}`} />
                  <Pressable
                    testID={`inc-${l.categoryCode}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('kgIncrease', { item: name })}
                    onPress={() => change(i, { kg: stepKg(l.kg, 1) })}
                    style={[s.step, { backgroundColor: colors.ink }]}
                  >
                    <Icon name="plus" size={20} color={colors.signal} />
                  </Pressable>
                </View>
                <Text testID={`amount-${l.categoryCode}`} style={[display(20), { color: colors.money }]}>
                  {formatTaka(preview.amounts[i], lang)}
                </Text>
              </View>
              {inspection ? (
                <View style={{ gap: 4 }}>
                  <TextInput
                    testID={`quote-${l.categoryCode}`}
                    accessibilityLabel={t('quoteLabel')}
                    placeholder={t('quoteLabel')}
                    placeholderTextColor={colors.muted}
                    value={l.quoted}
                    onChangeText={(quoted) => change(i, { quoted })}
                    keyboardType="decimal-pad"
                    style={s.quote}
                  />
                  <Text style={[body(13), { color: colors.muted }]}>{t('quoteHint')}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {addable.length > 0 ? (
          <Pressable testID="add-item" accessibilityRole="button" onPress={() => setPicking(true)} style={s.add}>
            <Icon name="plus" size={18} />
            <Text style={body(15, 700)}>{t('addOtherItem')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="scale-photo"
          accessibilityRole="button"
          onPress={async () => {
            const photo = await takePhoto(lang, 'back');
            if (photo) setPhoto(photo);
          }}
          style={s.photo}
        >
          {draft.photo ? (
            <Image source={{ uri: draft.photo.uri }} style={s.thumb} accessibilityLabel={t('scalePhotoTaken')} />
          ) : (
            <Icon name="camera" size={26} />
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={body(16, 700)}>
              {draft.photo ? t('scalePhotoTaken') : reweigh ? t('newScalePhoto') : t('takeScalePhoto')}
            </Text>
            <Text style={[body(13), { color: colors.muted }]}>
              {draft.photo ? t('retake') : t('scalePhotoHint')}
            </Text>
          </View>
        </Pressable>
        {draft.photo ? (
          <Button
            testID="remove-scale-photo"
            label={t('removeScalePhoto')}
            icon="x"
            variant="link"
            onPress={() => setPhoto(null)}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : null}

        <TotalsLabelCard
          leftLabel={reweigh ? t('newTotal') : t('totalWeight')}
          left={formatKg(preview.totalKg, lang)}
          rightLabel={t('customerGets')}
          right={formatTaka(preview.totalAmount, lang)}
          rightTestID="preview-total"
        />
        {reweigh ? <Note tone="warn" icon="alert-triangle" text={t('reweighWarning')} /> : null}
      </View>

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <Pressable style={s.backdrop} onPress={() => setPicking(false)} accessibilityRole="button" accessibilityLabel={t('close')} />
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <Text style={display(21)}>{t('chooseItem')}</Text>
          {addable.map((code) => (
            <Button
              key={code}
              testID={`add-${code}`}
              label={`${categoryName(categories, code, lang)} · ${rateText(code)}`}
              icon="plus-circle"
              variant="outline"
              onPress={() => {
                setLines([...lines, { categoryCode: code, kg: 0, quoted: '' }]);
                setPicking(false);
              }}
            />
          ))}
          <Button label={t('close')} icon="x" variant="link" onPress={() => setPicking(false)} style={{ alignSelf: 'center' }} />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

/** The kg in the middle of a stepper; tap to type (Bangla digits fine), kept to 0.1 kg. */
function KgInput({ kg, label, onChange, testID }: { kg: number; label: string; onChange: (kg: number) => void; testID: string }) {
  const { lang } = useT();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? localDigits(Number.isInteger(kg) ? String(kg) : kg.toFixed(1), lang);
  return (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={shown}
      onFocus={() => setText(kg === 0 ? '' : String(kg))}
      onChangeText={(v) => {
        setText(v);
        const parsed = parseKg(v);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => setText(null)}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={s.kg}
    />
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  dispute: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: '#F6E3DA' },
  line: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  lineTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  remove: { minWidth: 32, alignItems: 'center' },
  lineBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  kg: { minWidth: 96, minHeight: 48, textAlign: 'center', ...display(24) },
  quote: { minHeight: 52, borderWidth: 2, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, ...body(16) },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tones.dashed,
  },
  photo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(19,48,74,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 10 },
});
