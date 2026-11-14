import { localDigits } from '@bw/shared';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useLang, useT } from '../../src/i18n/lang';
import { normalizePhone } from '../../src/lib/format';
import { Button, Icon, type IconName } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display, minTouch, radius } from '../../src/ui/theme';

type Role = 'HOUSEHOLD' | 'COLLECTOR';

/** H1: phone number and role, sends the OTP. */
export default function SignIn() {
  const { t, lang } = useT();
  const { setLang } = useLang();
  const { api } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<Role>('HOUSEHOLD');
  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  const phone = normalizePhone(input);

  const send = useMutation({
    mutationFn: (p: string) => api.request<void>('POST', '/auth/otp/request', { body: { phone: p }, auth: false }),
    onSuccess: (_, p) => router.push({ pathname: '/otp', params: { phone: p, role } }),
  });

  const error =
    send.error instanceof ApiError && send.error.code === 'OTP_RATE_LIMIT'
      ? t('otpRateLimit', {
          minutes: localDigits(Math.ceil(Number(send.error.details.retryAfterSec ?? 60) / 60), lang),
        })
      : send.error
        ? errorMessage(send.error, lang)
        : touched && !phone
          ? t('phoneInvalid')
          : null;

  const points: [IconName, string][] = [
    ['trending-up', t('signInPoint1')],
    ['check-square', t('signInPoint2')],
    ['credit-card', t('signInPoint3')],
  ];

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.topRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLang(lang === 'bn' ? 'en' : 'bn')}
              style={s.langToggle}
            >
              <Icon name="globe" size={18} />
              <Text style={body(15, 600)}>{t('langSwitch')}</Text>
            </Pressable>
          </View>
          <View style={s.hero}>
            <View style={s.logo}>
              <Icon name="package" size={32} />
            </View>
            <Text style={[display(46, 800), { lineHeight: 52 }]}>{t('appName')}</Text>
            <Text style={[body(19), { lineHeight: 28 }]}>{t('signInPitch')}</Text>
            <View style={{ gap: 12 }}>
              {points.map(([icon, text]) => (
                <View key={text} style={s.point}>
                  <View style={s.pointIcon}>
                    <Icon name={icon} size={20} color={colors.money} />
                  </View>
                  <Text style={[body(16), s.flex]}>{text}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={s.sheet}>
            <View style={{ gap: 8 }}>
              <Text style={body(15, 600)}>{t('roleQuestion')}</Text>
              <View style={s.segment} accessibilityRole="radiogroup">
                {(['HOUSEHOLD', 'COLLECTOR'] as const).map((r) => {
                  const on = role === r;
                  return (
                    <Pressable
                      key={r}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setRole(r)}
                      style={[s.segmentBtn, on && { backgroundColor: colors.ink }]}
                    >
                      <Icon name={r === 'HOUSEHOLD' ? 'home' : 'truck'} size={18} color={on ? colors.surface : colors.ink} />
                      <Text style={[body(16, 600), { color: on ? colors.surface : colors.ink }]}>
                        {t(r === 'HOUSEHOLD' ? 'roleHousehold' : 'roleCollector')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={body(15, 600)}>{t('phoneLabel')}</Text>
              <View style={[s.phoneBox, error ? { borderColor: colors.alert } : null]}>
                <Text style={[body(17, 600), s.prefix]}>{lang === 'bn' ? '+৮৮০' : '+880'}</Text>
                <TextInput
                  testID="phone-input"
                  accessibilityLabel={t('phoneLabel')}
                  value={input}
                  onChangeText={(v) => {
                    setInput(v);
                    send.reset();
                  }}
                  onBlur={() => setTouched(input.length > 0)}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={14}
                  placeholder={t('phonePlaceholder')}
                  placeholderTextColor={colors.muted}
                  style={[body(18), s.phoneInput]}
                />
              </View>
              <Text style={[body(14), { color: error ? colors.alert : colors.muted }]}>{error ?? t('phoneHint')}</Text>
            </View>

            <Button
              testID="send-code"
              label={t('sendCode')}
              icon="message-square"
              loading={send.isPending}
              disabled={!phone}
              onPress={() => phone && send.mutate(phone)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.ground },
  scroll: { flexGrow: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 16 },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: minTouch,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  hero: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 16 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    marginTop: 'auto',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 28,
    gap: 18,
  },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.ground },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: minTouch,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBox: { flexDirection: 'row', minHeight: 56, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md, overflow: 'hidden' },
  prefix: { paddingHorizontal: 14, alignSelf: 'center' },
  phoneInput: { flex: 1, paddingHorizontal: 14, borderLeftWidth: 2, borderLeftColor: colors.line },
});
