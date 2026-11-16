import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LocalPhoto } from '../../src/api/hooks';
import type { VehicleType, WorkArea } from '../../src/api/types';
import { useSession } from '../../src/auth/session';
import { useCollectorProfile, useSelfieUpload, useSignUp } from '../../src/collector/api';
import { takePhoto } from '../../src/collector/camera';
import { CheckRow, VehiclePicker, WorkAreaPicker } from '../../src/collector/ui';
import { useT } from '../../src/i18n/lang';
import { formatPhone } from '../../src/lib/format';
import { Button, Field, Icon, Screen } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display, radius, tones } from '../../src/ui/theme';

const NID_RE = /^([0-9]{10}|[0-9]{13}|[0-9]{17})$/;
const asciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^0-9]/g, '');

/** C6: the collector application. After a rejection it opens again with the earlier answers filled in. */
export default function Join() {
  const { t, lang } = useT();
  const router = useRouter();
  const { user, signOut } = useSession();
  const previous = useCollectorProfile().data;
  const signUp = useSignUp();
  const uploadSelfie = useSelfieUpload();

  const [name, setName] = useState(previous?.name ?? user?.name ?? '');
  const [nid, setNid] = useState('');
  const [selfie, setSelfie] = useState<LocalPhoto | null>(null);
  const [areas, setAreas] = useState<WorkArea[]>(previous?.workAreas ?? []);
  const [vehicle, setVehicle] = useState<VehicleType | null>(previous?.vehicleType ?? null);
  const [hasScale, setHasScale] = useState(previous?.hasScale ?? false);
  const [agreed, setAgreed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const nidDigits = asciiDigits(nid);
  const nidError = nidDigits.length > 0 && !NID_RE.test(nidDigits) && nidDigits.length >= 10 ? t('nidInvalid') : null;
  const ready = name.trim().length > 0 && NID_RE.test(nidDigits) && selfie !== null && areas.length > 0 && vehicle !== null && agreed;

  const submit = async () => {
    if (!ready) {
      setProblem(t('joinMissing'));
      return;
    }
    setProblem(null);
    setUploading(true);
    let selfiePhotoId: string;
    try {
      selfiePhotoId = await uploadSelfie(selfie!);
    } catch {
      setUploading(false);
      setProblem(t('photoSendFailed'));
      return;
    }
    setUploading(false);
    signUp.mutate(
      { name: name.trim(), nidNumber: nidDigits, selfiePhotoId, workAreas: areas, vehicleType: vehicle!, hasScale, acceptedAgreement: true },
      { onSuccess: () => router.replace('/pending') },
    );
  };

  const error = problem ?? (signUp.error ? errorMessage(signUp.error, lang) : null);

  return (
    <Screen
      footer={
        <>
          {error ? <Text style={[body(15, 600), { color: colors.alert }]}>{error}</Text> : null}
          <Button testID="submit-application" label={t('submitApplication')} icon="send" loading={uploading || signUp.isPending} onPress={submit} />
        </>
      }
    >
      <View style={{ gap: 4 }}>
        <Text style={[display(28), { lineHeight: 34 }]}>{t('joinTitle')}</Text>
        <Text style={[body(15), { color: colors.muted }]}>{t('joinSub')}</Text>
      </View>

      <Field label={t('nameLabel')} value={name} onChangeText={setName} maxLength={80} autoComplete="name" testID="name-input" />

      <View style={{ gap: 6 }}>
        <Text style={body(14, 600)}>{t('phoneLabel')}</Text>
        <View style={s.phone}>
          <Text style={[body(16, 700), { flex: 1 }]}>{user?.phone ? formatPhone(user.phone, lang) : ''}</Text>
          <Icon name="check-circle" size={18} color={colors.money} />
          <Text style={[body(14, 600), { color: colors.money }]}>{t('phoneVerified')}</Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Field
          testID="nid-input"
          label={t('nidLabel')}
          value={nid}
          onChangeText={setNid}
          keyboardType="number-pad"
          maxLength={17}
          error={nidError}
        />
        <Text style={[body(13), { color: colors.muted }]}>{t('nidHint')}</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={body(14, 600)}>{t('selfieLabel')}</Text>
        <Pressable
          testID="take-selfie"
          accessibilityRole="button"
          onPress={async () => {
            const photo = await takePhoto(lang, 'front');
            if (photo) setSelfie(photo);
          }}
          style={s.selfie}
        >
          {selfie ? (
            <Image source={{ uri: selfie.uri }} style={s.selfieImg} accessibilityLabel={t('selfieTaken')} />
          ) : (
            <View style={s.selfieIcon}>
              <Icon name="camera" size={28} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={body(16, 700)}>{selfie ? t('retake') : t('takeSelfie')}</Text>
            <Text style={[body(13), { color: colors.muted }]}>{selfie ? t('selfieTaken') : t('selfieHint')}</Text>
          </View>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={display(19)}>{t('workAreasLabel')}</Text>
        <WorkAreaPicker value={areas} onChange={setAreas} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={display(19)}>{t('vehicleLabel')}</Text>
        <VehiclePicker value={vehicle} onChange={setVehicle} />
      </View>

      <View>
        <CheckRow testID="has-scale" label={t('hasScaleLabel')} checked={hasScale} onPress={() => setHasScale(!hasScale)} />
        <CheckRow testID="agreement" label={t('agreementLabel')} checked={agreed} onPress={() => setAgreed(!agreed)} />
      </View>

      <Button label={t('logOut')} icon="log-out" variant="dangerLink" onPress={signOut} style={{ alignSelf: 'center' }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
  },
  selfie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 80,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tones.dashed,
    backgroundColor: colors.surface,
  },
  selfieIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  selfieImg: { width: 56, height: 56, borderRadius: 28 },
});
