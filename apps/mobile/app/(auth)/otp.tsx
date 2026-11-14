import { localDigits } from '@bw/shared';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import type { Session } from '../../src/api/types';
import { useSession } from '../../src/auth/session';
import { useT } from '../../src/i18n/lang';
import { formatPhone } from '../../src/lib/format';
import { BackButton, Button, Icon, Note, Screen } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display } from '../../src/ui/theme';

const RESEND_AFTER_SEC = 45;

/** H9: the 6-digit code, resend timer, "never share this code". */
export default function Otp() {
  const { t, lang } = useT();
  const router = useRouter();
  const { api, signIn } = useSession();
  const params = useLocalSearchParams<{ phone: string; role: 'HOUSEHOLD' | 'COLLECTOR' }>();
  const phone = params.phone ?? '';
  const role = params.role === 'COLLECTOR' ? 'COLLECTOR' : 'HOUSEHOLD';
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(RESEND_AFTER_SEC);
  const [info, setInfo] = useState<string | null>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const verify = useMutation({
    mutationFn: (c: string) =>
      api.request<Session>('POST', '/auth/otp/verify', { body: { phone, code: c, role }, auth: false }),
    onSuccess: async (session) => {
      await signIn(session);
      router.replace('/');
    },
  });

  const resend = useMutation({
    mutationFn: () => api.request<void>('POST', '/auth/otp/request', { body: { phone }, auth: false }),
    onSuccess: () => {
      setLeft(RESEND_AFTER_SEC);
      setCode('');
      verify.reset();
      setInfo(t('otpResent'));
    },
  });

  const onChange = (v: string) => {
    const digits = v.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setInfo(null);
    verify.reset();
    if (digits.length === 6) verify.mutate(digits);
  };

  let error: string | null = null;
  if (verify.error instanceof ApiError && verify.error.code === 'OTP_INVALID') {
    const attemptsLeft = Number(verify.error.details.attemptsLeft ?? 0);
    error = attemptsLeft > 0 ? t('otpWrong', { count: localDigits(attemptsLeft, lang) }) : t('otpExpired');
  } else if (verify.error) {
    error = errorMessage(verify.error, lang);
  } else if (resend.error) {
    error = errorMessage(resend.error, lang);
  }

  const timer = `${localDigits(Math.floor(left / 60), lang)}:${localDigits(String(left % 60).padStart(2, '0'), lang)}`;

  return (
    <Screen
      footer={
        <Button
          testID="verify"
          label={t('verify')}
          icon="check"
          loading={verify.isPending}
          disabled={code.length !== 6}
          onPress={() => verify.mutate(code)}
        />
      }
    >
      <BackButton />
      <View style={s.badge}>
        <Icon name="smartphone" size={30} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={[display(32, 800), { lineHeight: 38 }]}>{t('otpTitle')}</Text>
        <Text style={[body(17), { lineHeight: 26 }]}>{t('otpSentTo', { phone: formatPhone(phone, lang) })}</Text>
        <Button label={t('changeNumber')} icon="edit-2" variant="link" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
      </View>

      <Pressable accessibilityLabel={t('otpDigits')} onPress={() => input.current?.focus()} style={s.boxes}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[s.box, i === code.length && s.boxActive, error ? { borderColor: colors.alert } : null]}>
            <Text style={display(26)}>{code[i] ? localDigits(code[i], lang) : '–'}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          testID="otp-input"
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          autoFocus
          maxLength={6}
          caretHidden
          style={s.hiddenInput}
        />
      </Pressable>
      {error ? <Text style={[body(15, 600), { color: colors.alert }]}>{error}</Text> : null}
      {info ? <Text style={[body(15, 600), { color: colors.money }]}>{info}</Text> : null}

      <View style={s.resendRow}>
        <Text style={[body(15), { color: colors.muted }]}>{t('noCode')}</Text>
        {left > 0 ? (
          <Text style={[body(15, 600), { color: colors.muted }]}>{t('resendIn', { time: timer })}</Text>
        ) : (
          <Button label={t('resend')} icon="refresh-cw" variant="link" loading={resend.isPending} onPress={() => resend.mutate()} />
        )}
      </View>
      <Note icon="shield" text={t('otpNeverShare')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  badge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxes: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 60,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.money, borderWidth: 3 },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
