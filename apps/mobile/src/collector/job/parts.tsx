import { StyleSheet, View } from 'react-native';
import { StatCard } from '../../ui/parts';

/** Two white totals cards: a figure on the left, the money on the right (C4, C10 and C5). */
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
      <StatCard label={leftLabel} value={left} />
      <StatCard label={rightLabel} value={right} tone="money" testID={rightTestID} />
    </View>
  );
}

const s = StyleSheet.create({
  totals: { flexDirection: 'row', gap: 10 },
});
