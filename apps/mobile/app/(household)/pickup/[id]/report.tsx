import { formatKg, formatTaka, localDigits } from '@bw/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOpenDispute, usePhotoUpload, usePickup } from '../../../../src/api/hooks';
import type { DisputeType } from '../../../../src/api/types';
import { choosePhoto } from '../../../../src/household/photoPicker';
import type { DraftPhoto } from '../../../../src/household/sellDraft';
import { collectorName } from '../../../../src/household/pickup/shared';
import { useT } from '../../../../src/i18n/lang';
import { formatDate } from '../../../../src/lib/dhaka';
import { allowedDisputeTypes } from '../../../../src/lib/pickupView';
import { BackButton, Button, ErrorView, Field, Icon, LoadingView, Note, RadioRow, Screen } from '../../../../src/ui/components';
import { errorMessage } from '../../../../src/ui/errors';
import { body, borderWidth, colors, display, radius, tones } from '../../../../src/ui/theme';
import { SectionLabel } from '../../../../src/ui/parts';

const MAX_PHOTOS = 5;

/** H14 (v1 design `household/ReportProblem.dc.html`): weight, payment not received, behaviour, other; details; optional photos. */
export default function ReportProblem() {
  const { id, type: wanted } = useLocalSearchParams<{ id: string; type?: DisputeType }>();
  const { t, lang } = useT();
  const router = useRouter();
  const pickup = usePickup(id);
  const open = useOpenDispute(id);
  const upload = usePhotoUpload();
  const [type, setType] = useState<DisputeType | null>(null);
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = pickup.data ? allowedDisputeTypes(pickup.data) : [];

  useEffect(() => {
    if (type === null && allowed.length) setType(wanted && allowed.includes(wanted) ? wanted : allowed[0]);
  }, [allowed, type, wanted]);

  if (pickup.isPending) return <LoadingView />;
  if (pickup.isError) return <ErrorView message={errorMessage(pickup.error, lang)} onRetry={() => pickup.refetch()} />;
  const p = pickup.data;

  const summary = [
    formatDate(p.requestedAt, lang),
    p.collector ? collectorName(p, t('collectorFallbackName')) : null,
    p.totalKg != null ? formatKg(p.totalKg, lang) : null,
    p.totalAmount != null ? formatTaka(p.totalAmount, lang) : null,
  ]
    .filter(Boolean)
    .join(', ');

  const submit = async () => {
    if (!type) return;
    setSending(true);
    setError(null);
    try {
      const photoIds: string[] = [];
      for (const photo of photos) photoIds.push(await upload(id, photo));
      await open.mutateAsync({
        type,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(photoIds.length ? { photoIds } : {}),
      });
      Alert.alert(t('reportSent'));
      router.back();
    } catch (e) {
      setError(errorMessage(e, lang));
    } finally {
      setSending(false);
    }
  };

  if (!allowed.length) {
    return (
      <Screen>
        <BackButton />
        <Text style={display(24)}>{t('reportProblem')}</Text>
        <Note tone="warn" icon="info" text={t(p.openDispute ? 'disputeAlreadyOpen' : 'disputeNotAllowed')} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {error ? <Text style={[body(14, 600), { color: colors.alert }]}>{error}</Text> : null}
          <Button testID="submit-report" label={t('submit')} icon="send" loading={sending} disabled={!type} onPress={submit} />
        </>
      }
    >
      <View style={{ gap: 6 }}>
        <BackButton />
        <Text style={[display(24), { lineHeight: 30 }]}>{t('reportProblem')}</Text>
        <Text style={[body(13), { color: colors.muted }]}>{summary}</Text>
      </View>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        <SectionLabel>{t('whatProblem')}</SectionLabel>
        {allowed.map((d) => (
          <RadioRow key={d} testID={`type-${d}`} label={t(`dispute_${d}`)} selected={type === d} onPress={() => setType(d)} />
        ))}
      </View>

      <Field
        label={t('details')}
        value={reason}
        onChangeText={setReason}
        placeholder={t('detailsPlaceholder')}
        multiline
        maxLength={500}
      />

      {photos.length ? (
        <View style={s.thumbs}>
          {photos.map((ph, i) => (
            <Pressable
              key={ph.uri}
              accessibilityRole="button"
              accessibilityLabel={t('removePhoto')}
              onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))}
            >
              <Image source={{ uri: ph.uri }} style={s.thumb} />
              <View style={s.remove}>
                <Icon name="x" size={14} color={colors.surface} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {photos.length < MAX_PHOTOS ? (
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            const ph = await choosePhoto(lang);
            if (ph) setPhotos((list) => [...list, ph]);
          }}
          style={s.photoBtn}
        >
          <View style={s.photoTile}>
            <Icon name="camera" size={20} />
          </View>
          <Text style={body(15, 600)}>
            {photos.length ? t('photosAdded', { count: localDigits(photos.length, lang) }) : t('addPhoto')}
          </Text>
        </Pressable>
      ) : null}

      {type ? <Note tone="warn" icon="info" text={t(`disputeHelp_${type}`)} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth,
    borderStyle: 'dashed',
    borderColor: tones.dashed,
  },
  photoTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
