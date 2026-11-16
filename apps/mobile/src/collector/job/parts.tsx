import { StyleSheet, Text, View } from 'react-native';
import { body, colors, display, tones } from '../../ui/theme';

/** Navy totals card with two labelled figures (C4, C10 and C5). */
export function TotalsLabelCard({
  leftLabel,
  left,
  rightLabel,
  right,
  rightTestID,
}: {
  leftLabel: string;
  left: string;
  rightLabel: string;
  right: string;
  rightTestID?: string;
}) {
  return (
    <View style={s.totals}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[body(14), { color: tones.ink200 }]}>{leftLabel}</Text>
        <Text style={[display(28, 800), { color: colors.signal }]}>{left}</Text>
      </View>
      <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
        <Text style={[body(14), { color: tones.ink200 }]}>{rightLabel}</Text>
        <Text testID={rightTestID} style={[display(28, 800), { color: colors.signal }]}>
          {right}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  totals: { flexDirection: 'row', gap: 12, backgroundColor: colors.ink, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14 },
});
