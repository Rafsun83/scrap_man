import { localDigits } from '@bw/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/lang';
import { BackButton } from '../ui/components';
import { body, colors } from '../ui/theme';

/** Back, "ধাপ ১/২" and the two-part progress bar of the request flow (H3, H4). */
export function StepHeader({ step }: { step: 1 | 2 }) {
  const { t, lang } = useT();
  return (
    <View style={{ gap: 10 }}>
      <View style={s.stepRow}>
        <BackButton />
        <Text style={[body(14, 600), { color: colors.muted }]}>
          {t('stepOf', { step: localDigits(step, lang), total: localDigits(2, lang) })}
        </Text>
      </View>
      <View style={s.bars}>
        <View style={[s.bar, { backgroundColor: colors.ink }]} />
        <View style={[s.bar, { backgroundColor: step === 2 ? colors.ink : colors.line }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
});
