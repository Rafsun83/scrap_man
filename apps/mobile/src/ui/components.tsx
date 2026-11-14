import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
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
import { body, colors, display, minTouch, radius, tones } from './theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 22, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
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
        <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
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
      <Icon name="arrow-left" size={24} />
      <Text style={body(15, 600)}>{label ?? t('back')}</Text>
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'danger' | 'link' | 'dangerLink';

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
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        v.box,
        off && variant !== 'link' && variant !== 'dangerLink' && styles.buttonOff,
        pressed && !off && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Icon name={icon} color={off ? colors.muted : v.fg} /> : null}
      <Text style={[v.text, { color: off && variant !== 'link' ? colors.muted : v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { box: ViewStyle; text: object; fg: string }> = {
  primary: {
    box: { minHeight: 56, backgroundColor: colors.signal, borderWidth: 2, borderColor: colors.ink },
    text: display(20),
    fg: colors.ink,
  },
  dark: { box: { minHeight: 56, backgroundColor: colors.ink }, text: display(20), fg: colors.surface },
  outline: {
    box: { minHeight: 52, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line },
    text: body(16, 700),
    fg: colors.ink,
  },
  danger: {
    box: { minHeight: 52, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line },
    text: body(17, 700),
    fg: colors.alert,
  },
  link: { box: { minHeight: minTouch, paddingHorizontal: 4 }, text: body(15, 700), fg: colors.money },
  dangerLink: { box: { minHeight: minTouch, paddingHorizontal: 4 }, text: body(15, 700), fg: colors.alert },
};

export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
}

/** Pill toggle (weight band, filters). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text style={[body(15, 600), { color: selected ? colors.surface : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** Radio row (time slot, payment method, problem type). */
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
        { borderColor: selected ? colors.ink : colors.line, backgroundColor: selected ? colors.selectedTint : colors.surface },
        disabled && styles.buttonOff,
      ]}
    >
      <View style={styles.flex}>
        <Text style={[body(16, 700), disabled && { color: colors.muted }]}>{label}</Text>
        {sub ? <Text style={[body(13), { color: colors.muted }]}>{sub}</Text> : null}
      </View>
      <View
        style={[styles.dot, selected ? { borderWidth: 7, borderColor: colors.ink } : { borderWidth: 2, borderColor: tones.dashed }]}
      />
    </Pressable>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={body(14, 600)}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...input}
        accessibilityLabel={label}
        style={[styles.input, input.multiline && styles.inputMulti, error ? { borderColor: colors.alert } : null, input.style]}
      />
      {error ? <Text style={[body(14, 600), { color: colors.alert }]}>{error}</Text> : null}
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
  const bg = tone === 'warn' ? colors.selectedTint : tone === 'alert' ? '#F6E3DA' : colors.surface;
  return (
    <View style={[styles.note, { backgroundColor: bg }]}>
      <Icon name={icon} size={20} color={tone === 'alert' ? colors.alert : colors.ink} />
      <Text style={[body(15), styles.flex, { lineHeight: 22 }, tone === 'alert' && { color: colors.alert }]}>{text}</Text>
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
      {onRetry ? <Button label={t('retry')} icon="refresh-cw" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyView({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={[body(17, 700), styles.centerText]}>{title}</Text>
      {hint ? <Text style={[body(15), styles.centerText, { color: colors.muted }]}>{hint}</Text> : null}
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
  footer: { padding: 20, paddingTop: 12, gap: 6, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: minTouch, alignSelf: 'flex-start', marginLeft: -4 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 18,
  },
  buttonOff: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 4 },
  chip: { minHeight: minTouch, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 2, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.line },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
  },
  dot: { width: 22, height: 22, borderRadius: 11 },
  field: { gap: 6 },
  input: {
    minHeight: 52,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    ...body(16),
  },
  inputMulti: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: radius.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: 12, padding: 32, borderRadius: radius.md, backgroundColor: colors.surface },
  divider: { height: 1, backgroundColor: colors.line },
});
