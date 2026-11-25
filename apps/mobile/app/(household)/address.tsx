import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useAddresses, useDeleteAddress, useSaveAddress } from '../../src/api/hooks';
import type { AddressInput } from '../../src/api/types';
import { useT } from '../../src/i18n/lang';
import { insideBangladesh } from '../../src/lib/format';
import { BackButton, Button, Card, Field, LoadingView, Note, Screen } from '../../src/ui/components';
import { mapsEnabled, PinPicker } from '../../src/ui/maps';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display, minTouch } from '../../src/ui/theme';
import { SectionLabel, Toggle } from '../../src/ui/parts';

/**
 * Add or edit a saved address (opened from H10 and H4). The location starts from the phone's GPS; with a maps
 * key the household can drag the pin to the exact spot.
 */
export default function AddressForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, lang } = useT();
  const router = useRouter();
  const addresses = useAddresses();
  const save = useSaveAddress();
  const remove = useDeleteAddress();
  const existing = id ? addresses.data?.find((a) => a.id === id) : undefined;

  const [label, setLabel] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  if (id && addresses.isPending) return <LoadingView />;

  // Form values fall back to the saved address until edited.
  const v = {
    label: label ?? existing?.label ?? '',
    line: line ?? existing?.line ?? '',
    area: area ?? existing?.area ?? '',
    note: note ?? existing?.note ?? '',
    isDefault: isDefault ?? existing?.isDefault ?? (addresses.data?.length ?? 0) === 0,
    location: location ?? existing?.location ?? null,
  };
  const missing = (s: string) => (tried && !s.trim() ? t('fieldRequired') : null);

  const locate = async () => {
    setLocError(null);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocError(t('locationPermission'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!insideBangladesh(p)) setLocError(t('locationOutside'));
      else setLocation(p);
    } catch {
      setLocError(t('errGeneric'));
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    setTried(true);
    if (!v.label.trim() || !v.line.trim() || !v.area.trim() || !v.location) return;
    const input: AddressInput = {
      label: v.label.trim(),
      line: v.line.trim(),
      area: v.area.trim(),
      city: existing?.city ?? 'Dhaka',
      location: v.location,
      isDefault: v.isDefault,
      ...(v.note.trim() ? { note: v.note.trim() } : {}),
    };
    save.mutate({ id, input }, { onSuccess: () => router.back() });
  };

  const confirmDelete = () =>
    Alert.alert(t('deleteAddressTitle'), existing ? `${existing.line}, ${existing.area}` : undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => remove.mutate(id!, { onSuccess: () => router.back() }) },
    ]);

  const error = save.error ?? remove.error;

  return (
    <Screen
      footer={
        <>
          {error ? <Text style={[body(14, 600), { color: colors.alert }]}>{errorMessage(error, lang)}</Text> : null}
          <Button testID="save-address" label={t('save')} icon="check" loading={save.isPending} onPress={submit} />
          {existing ? (
            <Button label={t('delete')} icon="trash-2" variant="dangerLink" loading={remove.isPending} onPress={confirmDelete} />
          ) : null}
        </>
      }
    >
      <BackButton />
      <Text style={display(24)}>{t(existing ? 'editAddress' : 'newAddress')}</Text>
      <Field label={t('addressLabel')} value={v.label} onChangeText={setLabel} maxLength={40} error={missing(v.label)} />
      <Field label={t('addressLine')} value={v.line} onChangeText={setLine} maxLength={200} error={missing(v.line)} />
      <Field label={t('addressArea')} value={v.area} onChangeText={setArea} maxLength={80} error={missing(v.area)} />
      <Field label={t('addressNote')} value={v.note} onChangeText={setNote} maxLength={200} multiline />

      <Card style={{ paddingVertical: 14, gap: 10 }}>
        <SectionLabel>{t('location')}</SectionLabel>
        {v.location ? (
          <Note icon="check-circle" text={t('locationSet')} />
        ) : (
          <Text style={[body(14), { color: tried ? colors.alert : colors.muted }]}>{t('locationNeeded')}</Text>
        )}
        {locError ? <Text style={[body(14, 600), { color: colors.alert }]}>{locError}</Text> : null}
        {v.location ? (
          <>
            <PinPicker value={v.location} onChange={(p) => insideBangladesh(p) && setLocation(p)} label={t('pinHint')} />
            {mapsEnabled ? <Text style={[body(14), { color: colors.muted }]}>{t('pinHint')}</Text> : null}
          </>
        ) : null}
        <Button label={t('useCurrentLocation')} icon="crosshair" variant="outline" loading={locating} onPress={locate} />
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: minTouch }}>
        <Text style={body(15)}>{t('makeDefault')}</Text>
        <Toggle value={v.isDefault} onChange={setIsDefault} label={t('makeDefault')} />
      </View>
    </Screen>
  );
}
