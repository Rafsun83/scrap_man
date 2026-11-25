import { localDigits } from '@bw/shared';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/session';
import { useLang, useT } from '../../src/i18n/lang';
import { normalizePhone } from '../../src/lib/format';
import { Button, Icon } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { IconTile, SectionLabel, SelectCard } from '../../src/ui/parts';
import { body, borderWidth, colors, display, minTouch, radius, tones } from '../../src/ui/theme';

type Role = 'HOUSEHOLD' | 'COLLECTOR';

/** H1 (v1 design `household/SignIn.dc.html`): phone number and role, sends the OTP. */
export default function SignIn() {
  const { t, lang } = useT();
  const { setLang } = useLang();
  const { api } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<Role>('HOUSEHOLD');
  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
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

  const roles: { role: Role; label: string; sub: string; icon: 'shopping-bag' | 'truck'; tint: string }[] = [
    { role: 'HOUSEHOLD', label: t('roleHousehold'), sub: t('roleHouseholdSub'), icon: 'shopping-bag', tint: '#FFF4D6' },
    { role: 'COLLECTOR', label: t('roleCollector'), sub: t('roleCollectorSub'), icon: 'truck', tint: tones.doneBg },
  ];

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.topRow}>
            <Pressable accessibilityRole="button" onPress={() => setLang(lang === 'bn' ? 'en' : 'bn')} style={s.langToggle}>
              <Icon name="globe" size={18} />
              <Text style={body(15, 600)}>{t('langSwitch')}</Text>
            </Pressable>
          </View>

          <View style={{ gap: 18 }}>
            <Image source={require('../../assets/icon.png')} style={s.logo} accessibilityLabel={t('appName')} />
            <View style={{ gap: 8 }}>
              <Text style={[display(30), { lineHeight: 36 }]}>{t('signInWelcome')}</Text>
              <Text style={[body(16), { color: colors.muted, lineHeight: 25 }]}>{t('signInPitch')}</Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <SectionLabel>{t('phoneLabel')}</SectionLabel>
            <View style={[s.phoneBox, focused && { borderColor: colors.selected }, error ? s.phoneError : null]}>
              <Text style={[body(16, 500), s.prefix]}>{lang === 'bn' ? '+৮৮০' : '+880'}</Text>
              <TextInput
                testID="phone-input"
                accessibilityLabel={t('phoneLabel')}
                value={input}
                onChangeText={(v) => {
                  setInput(v);
                  send.reset();
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                  setFocused(false);
                  setTouched(input.length > 0);
                }}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={14}
                placeholder={t('phonePlaceholder')}
                placeholderTextColor={colors.selected}
                style={[body(16), s.phoneInput]}
              />
            </View>
            <Text style={[body(13), { color: error ? colors.alert : colors.muted }]}>{error ?? t('phoneHint')}</Text>
          </View>

          <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel={t('roleQuestion')}>
            <SectionLabel>{t('roleQuestion')}</SectionLabel>
            <View style={s.roles}>
              {roles.map((r) => (
                <SelectCard
                  key={r.role}
                  testID={`role-${r.role}`}
                  role="radio"
                  selected={role === r.role}
                  onPress={() => setRole(r.role)}
                  style={s.roleCard}
                >
                  <IconTile icon={r.icon} tint={r.tint} />
                  <View style={{ gap: 1 }}>
                    <Text style={body(16, 600)}>{r.label}</Text>
                    <Text style={[body(13), { color: colors.muted }]}>{r.sub}</Text>
                  </View>
                </SelectCard>
              ))}
            </View>
          </View>

          <View style={s.flex} />

          <Button
            testID="send-code"
            label={t('sendCode')}
            icon="arrow-right"
            loading={send.isPending}
            disabled={!phone}
            onPress={() => phone && send.mutate(phone)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.ground },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 28, gap: 28 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 12 },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: minTouch,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  logo: { width: 64, height: 64, borderRadius: radius.md },
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  phoneError: { borderColor: colors.alert, backgroundColor: tones.alertBg },
  prefix: { paddingLeft: 16, paddingRight: 14, borderRightWidth: borderWidth, borderRightColor: colors.line },
  phoneInput: { flex: 1, minHeight: 54, paddingHorizontal: 14 },
  roles: { flexDirection: 'row', gap: 12 },
  roleCard: { flex: 1, minHeight: 128, padding: 14, justifyContent: 'space-between' },
});
