import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { VehicleType, WorkArea } from '../../src/api/types';
import { useCollectorProfile, useUpdateWork } from '../../src/collector/api';
import { CheckRow, VehiclePicker, WorkAreaPicker } from '../../src/collector/ui';
import { useT } from '../../src/i18n/lang';
import { BackButton, Button, ErrorView, LoadingView, Screen } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display } from '../../src/ui/theme';

/** C11 "বদলান": work areas, vehicle and scale. Saving does not change the verification. */
export default function WorkDetails() {
  const { t, lang } = useT();
  const router = useRouter();
  const profile = useCollectorProfile();
  const update = useUpdateWork();
  const [areas, setAreas] = useState<WorkArea[] | null>(null);
  const [vehicle, setVehicle] = useState<VehicleType | null>(null);
  const [scale, setScale] = useState<boolean | null>(null);

  if (profile.isPending) return <LoadingView />;
  if (profile.isError || !profile.data) return <ErrorView message={errorMessage(profile.error, lang)} onRetry={() => profile.refetch()} />;
  const p = profile.data;
  const currentAreas = areas ?? p.workAreas;
  const currentVehicle = vehicle ?? p.vehicleType;
  const currentScale = scale ?? p.hasScale;

  return (
    <Screen
      footer={
        <>
          {update.error ? <Text style={[body(15, 600), { color: colors.alert }]}>{errorMessage(update.error, lang)}</Text> : null}
          <Button
            testID="save-work"
            label={t('save')}
            icon="check"
            disabled={currentAreas.length === 0}
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { workAreas: currentAreas, vehicleType: currentVehicle, hasScale: currentScale },
                { onSuccess: () => router.back() },
              )
            }
          />
        </>
      }
    >
      <View style={{ gap: 6 }}>
        <BackButton />
        <Text style={[display(28), { lineHeight: 34 }]}>{t('editWorkTitle')}</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={display(19)}>{t('workAreasLabel')}</Text>
        <WorkAreaPicker value={currentAreas} onChange={setAreas} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={display(19)}>{t('vehicleLabel')}</Text>
        <VehiclePicker value={currentVehicle} onChange={setVehicle} />
      </View>
      <CheckRow label={t('hasScaleLabel')} checked={currentScale} onPress={() => setScale(!currentScale)} />
    </Screen>
  );
}
