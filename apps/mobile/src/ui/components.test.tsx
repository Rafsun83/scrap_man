import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderScreen } from '../test/render';
import { Button, Chip, CodeBoxes, Field, RadioRow, Stepper } from './components';
import { colors } from './theme';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

describe('v1 building blocks', () => {
  it('Button: primary is ink, key is signal yellow, and no style depends on being pressed', async () => {
    await renderScreen(
      <>
        <Button testID="main" label="Main" />
        <Button testID="key" label="Sell" variant="key" />
      </>,
    );
    expect(flat(screen.getByTestId('main')).backgroundColor).toBe(colors.ink);
    expect(flat(screen.getByTestId('key')).backgroundColor).toBe(colors.signal);
    expect(typeof screen.getByTestId('main').props.style).not.toBe('function');
  });

  it('Chip and RadioRow: selected gets the grey border and no fill', async () => {
    await renderScreen(
      <>
        <Chip label="On" selected onPress={() => {}} />
        <Chip label="Off" selected={false} onPress={() => {}} />
        <RadioRow testID="radio" label="Morning" selected onPress={() => {}} />
      </>,
    );
    const on = flat(screen.getByRole('button', { name: 'On' }));
    const off = flat(screen.getByRole('button', { name: 'Off' }));
    expect(on.borderColor).toBe(colors.selected);
    expect(on.backgroundColor).toBe(colors.surface);
    expect(off.borderColor).toBe(colors.line);
    expect(flat(screen.getByTestId('radio')).borderColor).toBe(colors.selected);
  });

  it('Field: the border turns grey while typing and alert on error', async () => {
    const { rerender } = await renderScreen(<Field label="Name" testID="name" />);
    expect(flat(screen.getByTestId('name')).borderColor).toBe(colors.line);
    await fireEvent(screen.getByTestId('name'), 'focus');
    expect(flat(screen.getByTestId('name')).borderColor).toBe(colors.selected);
    await fireEvent(screen.getByTestId('name'), 'blur');
    await rerender(<Field label="Name" testID="name" error="Required" />);
    expect(flat(screen.getByTestId('name')).borderColor).toBe(colors.alert);
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('CodeBoxes: shows each typed digit in its own box, mapped for display', async () => {
    const onChange = jest.fn();
    await renderScreen(
      <CodeBoxes testID="code" label="Pickup code" length={4} value="48" onChange={onChange} renderDigit={(d) => `<${d}>`} />,
    );
    expect(screen.getByText('<4>')).toBeTruthy();
    expect(screen.getByText('<8>')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('code'), '482');
    expect(onChange).toHaveBeenCalledWith('482');
    expect(screen.getByTestId('code').props.maxLength).toBe(4);
  });

  it('Stepper: minus and plus call back, with labels for screen readers', async () => {
    const dec = jest.fn();
    const inc = jest.fn();
    await renderScreen(
      <Stepper onDecrease={dec} onIncrease={inc} decreaseLabel="Less iron" increaseLabel="More iron" testIDs={{ decrease: 'dec', increase: 'inc' }}>
        <></>
      </Stepper>,
    );
    await fireEvent.press(screen.getByLabelText('Less iron'));
    await fireEvent.press(screen.getByTestId('inc'));
    expect(dec).toHaveBeenCalledTimes(1);
    expect(inc).toHaveBeenCalledTimes(1);
  });
});
