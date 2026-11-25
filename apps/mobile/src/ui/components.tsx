import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../i18n/lang';
import { body, borderWidth, cardShadow, colors, display, minTouch, radius, tones } from './theme';

/*
 * Version 1 building blocks (docs/version-1/design/README.md):
 * - no animation and no press effect: a control looks the same while it is touched;
 * - a selected card, chip or radio row, and an input being typed in, get a plain grey border (colors.selected);
 * - corners of 4-6 px; white cards with a light shadow on the ground colour.
 */

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** A full screen on the ground colour, with optional sticky footer. */
export function Screen({
  children,
  footer,
  scroll = true,
  style,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, style]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** Back action with icon and text; falls back to home when there is nothing to go back to. */
export function BackButton({ label }: { label?: string }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={styles.back}
      hitSlop={8}
    >
      <Icon name="chevron-left" size={24} />
      <Text style={body(15, 600)}>{label ?? t('back')}</Text>
    </Pressable>
  );
}

/**
 * - primary: ink, the main action of a screen
 * - key: signal yellow, the one action the eye must find (sell, accept); at most one per screen
 * - outline: quiet white button with a grey border
 * - danger: quiet button with alert text (cancel, reject, log out)
 * - link / dangerLink: text only, still 48 px tall
 */
type ButtonVariant = 'primary' | 'key' | 'outline' | 'danger' | 'link' | 'dangerLink';

export function Button({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  testID,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  const textLike = variant === 'link' || variant === 'dangerLink';
  const fg = off && !textLike ? colors.muted : v.fg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={[styles.button, v.box, off && !textLike && styles.buttonOff, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : icon ? (
        <Icon name={icon} size={20} color={fg} />
      ) : null}
      <Text style={[v.text, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const buttonText = body(16, 600);

const buttonVariants: Record<ButtonVariant, { box: ViewStyle; text: object; fg: string }> = {
  primary: {
    box: { minHeight: 56, backgroundColor: colors.ink },
    text: buttonText,
    fg: colors.surface,
  },
  key: { box: { minHeight: 56, backgroundColor: colors.signal }, text: buttonText, fg: colors.ink },
  outline: {
    box: { minHeight: 52, backgroundColor: colors.surface, borderWidth, borderColor: colors.line },
    text: buttonText,
    fg: colors.ink,
  },
  danger: {
    box: { minHeight: 52, backgroundColor: colors.surface, borderWidth, borderColor: colors.line },
    text: buttonText,
    fg: colors.alert,
  },
  link: { box: { minHeight: minTouch, paddingHorizontal: 4 }, text: body(15, 600), fg: colors.ink },
  dangerLink: {
    box: { minHeight: minTouch, paddingHorizontal: 4 },
    text: body(15, 600),
    fg: colors.alert,
  },
};

/** White card with a light shadow. */
export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
}

/** Choice chip (weight band, filters, work areas). Selected: grey border and bolder text, no fill. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.selected : colors.line }]}
    >
      <Text style={body(15, selected ? 600 : 500)}>{label}</Text>
    </Pressable>
  );
}

/** Radio row (time slot, payment method, problem type). Selected: grey border and a filled ring. */
export function RadioRow({
  label,
  sub,
  selected,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.radio,
        { borderColor: selected ? colors.selected : colors.line },
        disabled && styles.buttonOff,
      ]}
    >
      <View style={[styles.dot, selected ? styles.dotOn : styles.dotOff]} />
      <View style={styles.flex}>
        <Text style={[body(16, 600), disabled && { color: colors.muted }]}>{label}</Text>
        {sub ? <Text style={[body(13), { color: colors.muted }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Labelled text input. While typing the border turns grey; an error turns it alert and shows the message. */
export function Field({
  label,
  error,
  ...input
}: TextInputProps & { label: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[body(14, 500), { color: colors.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.selected}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        accessibilityLabel={label}
        style={[
          styles.input,
          input.multiline && styles.inputMulti,
          focused && { borderColor: colors.selected },
          error ? styles.inputError : null,
          input.style,
        ]}
      />
      {error ? <Text style={[body(13, 500), { color: colors.alert }]}>{error}</Text> : null}
    </View>
  );
}

/**
 * Row of digit boxes over one hidden input (6 for the sign-in code, 4 for the pickup code).
 * The next empty box gets the grey border; an error turns every box alert.
 */
export function CodeBoxes({
  value,
  onChange,
  length,
  label,
  testID,
  error,
  autoFocus,
  oneTimeCode,
  renderDigit = (d) => d,
}: {
  value: string;
  onChange: (next: string) => void;
  length: number;
  label: string;
  testID?: string;
  error?: boolean;
  autoFocus?: boolean;
  /** Let the keyboard offer the code from an SMS. */
  oneTimeCode?: boolean;
  /** How a typed digit is shown, e.g. as a Bangla digit. */
  renderDigit?: (digit: string) => string;
}) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(!!autoFocus);
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => input.current?.focus()}
      style={styles.codeRow}
    >
      {Array.from({ length }, (_, i) => {
        const active = focused && i === Math.min(value.length, length - 1);
        return (
          <View
            key={i}
            style={[
              styles.codeBox,
              active && { borderColor: colors.selected },
              error ? { borderColor: colors.alert } : null,
            ]}
          >
            <Text style={display(26)}>{value[i] ? renderDigit(value[i]) : ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoComplete={oneTimeCode ? 'sms-otp' : 'off'}
        textContentType={oneTimeCode ? 'oneTimeCode' : 'none'}
        autoFocus={autoFocus}
        maxLength={length}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

/** − value + control (kg per item). The middle is any node, usually a typed kg input. */
export function Stepper({
  children,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  testIDs,
}: {
  children: ReactNode;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  testIDs?: { decrease?: string; increase?: string };
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        testID={testIDs?.decrease}
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        onPress={onDecrease}
        style={styles.step}
      >
        <Icon name="minus" size={20} />
      </Pressable>
      <View style={styles.stepValue}>{children}</View>
      <Pressable
        testID={testIDs?.increase}
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
        onPress={onIncrease}
        style={styles.step}
      >
        <Icon name="plus" size={20} />
      </Pressable>
    </View>
  );
}

/** Info note with an icon (rate-lock note, help text, warnings). */
export function Note({
  text,
  icon = 'info',
  tone = 'plain',
}: {
  text: string;
  icon?: IconName;
  tone?: 'plain' | 'warn' | 'alert';
}) {
  const look =
    tone === 'warn'
      ? {
          box: { backgroundColor: tones.warnBg, borderColor: tones.warnLine },
          ink: tones.warnInk,
          icon: '#8A5A00',
        }
      : tone === 'alert'
        ? {
            box: { backgroundColor: tones.alertBg, borderColor: tones.alertLine },
            ink: colors.alert,
            icon: colors.alert,
          }
        : {
            box: { backgroundColor: colors.surface, borderColor: colors.line },
            ink: colors.muted,
            icon: colors.muted,
          };
  return (
    <View style={[styles.note, look.box]}>
      <Icon name={icon} size={20} color={look.icon} />
      <Text style={[body(14), styles.flex, { lineHeight: 22, color: look.ink }]}>{text}</Text>
    </View>
  );
}

export function LoadingView() {
  const { t } = useT();
  return (
    <View style={styles.center} accessibilityLabel={t('loading')}>
      <ActivityIndicator size="large" color={colors.ink} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <View style={styles.center}>
      <Icon name="alert-triangle" size={36} color={colors.alert} />
      <Text style={[display(20), styles.centerText]}>{t('errorTitle')}</Text>
      <Text style={[body(15), styles.centerText, { color: colors.muted }]}>{message}</Text>
      {onRetry ? (
        <Button label={t('retry')} icon="refresh-cw" variant="outline" onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function EmptyView({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[body(16, 600), styles.centerText]}>{title}</Text>
      {hint ? (
        <Text style={[body(14), styles.centerText, { color: colors.muted, lineHeight: 21 }]}>
          {hint}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 18, flexGrow: 1 },
  footer: {
    padding: 20,
    paddingTop: 12,
    gap: 6,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: minTouch,
    alignSelf: 'flex-start',
    marginLeft: -6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 18,
  },
  buttonOff: { opacity: 0.55 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...cardShadow,
  },
  chip: {
    minHeight: minTouch,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth,
    backgroundColor: colors.surface,
  },
  dot: { width: 22, height: 22, borderRadius: radius.round },
  dotOn: { borderWidth: 6, borderColor: colors.muted },
  dotOff: { borderWidth: 2, borderColor: tones.ring },
  field: { gap: 6 },
  input: {
    minHeight: 56,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    ...body(16),
  },
  inputMulti: { minHeight: 88, paddingTop: 14, textAlignVertical: 'top' },
  inputError: { borderColor: colors.alert, backgroundColor: tones.alertBg },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeBox: {
    flex: 1,
    height: 60,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: minTouch,
    height: minTouch,
    borderRadius: radius.md,
    borderWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 96,
    minHeight: minTouch,
    borderRadius: radius.md,
    backgroundColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { textAlign: 'center' },
  empty: {
    alignItems: 'center',
    gap: 10,
    padding: 28,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  divider: { height: 1, backgroundColor: colors.divider },
});
