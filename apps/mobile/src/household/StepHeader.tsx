import { localDigits } from '@bw/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/lang';
import { BackButton } from '../ui/components';
import { ProgressBar } from '../ui/parts';
import { body, colors } from '../ui/theme';

/** Back, "ধাপ ১ / ২" and a thin progress bar for the request flow (H3, H4). */
export function StepHeader({ step }: { step: 1 | 2 }) {
  const { t, lang } = useT();
  return (
    <View style={{ gap: 10 }}>
      <View style={s.stepRow}>
        <BackButton />
        <Text style={[body(13, 500), { color: colors.muted }]}>
          {t('stepOf', { step: localDigits(step, lang), total: localDigits(2, lang) })}
        </Text>
      </View>
      <ProgressBar value={step / 2} />
    </View>
  );
}

const s = StyleSheet.create({
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
