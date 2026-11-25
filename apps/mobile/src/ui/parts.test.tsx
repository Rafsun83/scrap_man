import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { renderScreen } from '../test/render';
import { ProgressBar, SelectCard, Toggle } from './parts';
import { colors } from './theme';

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

describe('v1 parts', () => {
  it('SelectCard: grey border when selected, light border otherwise, reports checked for radios', async () => {
    const onPress = jest.fn();
    await renderScreen(
      <>
        <SelectCard testID="on" role="radio" selected onPress={onPress}>
          <Text>Morning</Text>
        </SelectCard>
        <SelectCard testID="off" role="radio" selected={false} onPress={onPress}>
          <Text>Noon</Text>
        </SelectCard>
      </>,
    );
    expect(flat(screen.getByTestId('on')).borderColor).toBe(colors.selected);
    expect(flat(screen.getByTestId('off')).borderColor).toBe(colors.line);
    expect(screen.getByTestId('on').props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByTestId('off'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Toggle: flips the value, green when on, and is announced as a switch', async () => {
    const onChange = jest.fn();
    await renderScreen(<Toggle testID="t" value onChange={onChange} label="Default address" />);
    const node = screen.getByTestId('t');
    expect(node.props.accessibilityRole).toBe('switch');
    expect(flat(node).backgroundColor).toBe(colors.money);
    await fireEvent.press(node);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('ProgressBar: exposes its value', async () => {
    await renderScreen(<ProgressBar value={0.5} />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 50 });
  });
});
