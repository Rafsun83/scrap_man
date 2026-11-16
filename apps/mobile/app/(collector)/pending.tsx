import { localDigits } from '@bw/shared';
import { Redirect, useRouter } from 'expo-router';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/auth/session';
import { useCollectorProfile } from '../../src/collector/api';
import { collectorRoute } from '../../src/collector/collectorView';
import { workAreaNames } from '../../src/collector/ui';
import { SUPPORT_PHONE } from '../../src/config';
import { useT } from '../../src/i18n/lang';
import { Button, Card, ErrorView, Icon, LoadingView, Note } from '../../src/ui/components';
import { errorMessage } from '../../src/ui/errors';
import { body, colors, display, tones } from '../../src/ui/theme';

/**
 * C7: the application is being checked, or was rejected with the admin's note. An approval arrives as the
 * `collector.verification` event (and an SMS) and moves the collector on to the work tabs.
 */
export default function Pending() {
  const { t, lang } = useT();
  const router = useRouter();
  const { signOut } = useSession();
  const profile = useCollectorProfile();

  if (profile.isPending) return <LoadingView />;
  if (profile.isError) return <ErrorView message={errorMessage(profile.error, lang)} onRetry={() => profile.refetch()} />;
  const route = collectorRoute(profile.data);
  if (route === 'JOIN') return <Redirect href="/join" />;
  if (route === 'WORK') return <Redirect href="/requests" />;

  const p = profile.data!;
  const rejected = p.verificationStatus === 'REJECTED';
  const steps = [
    { label: t('stepSubmitted'), state: 'done' as const },
    { label: t('stepChecking'), state: rejected ? ('failed' as const) : ('current' as const) },
    { label: t('stepApproval'), state: 'todo' as const },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} />}
      >
        <View style={[s.badge, rejected && { backgroundColor: '#F6E3DA' }]}>
          <Icon name={rejected ? 'x-circle' : 'clock'} size={34} color={rejected ? colors.alert : colors.ink} />
        </View>
        <Text style={[display(26), { lineHeight: 32 }]}>{rejected ? t('rejectedTitle') : t('pendingTitle')}</Text>
        <Text style={[body(16), { color: colors.muted, lineHeight: 24 }]}>{rejected ? t('rejectedBody') : t('pendingBody')}</Text>

        {rejected && p.verificationNote ? (
          <Note tone="alert" icon="message-square" text={`${t('rejectedReason')}: ${p.verificationNote}`} />
        ) : null}

        <Card style={{ paddingVertical: 12, gap: 4 }}>
          <Text style={[display(18), { marginBottom: 4 }]}>{t('stepsTitle')}</Text>
          {steps.map((step, i) => (
            <View key={step.label} style={s.step}>
              <View
                style={[
                  s.dot,
                  step.state === 'done' && { backgroundColor: colors.money },
                  step.state === 'current' && { backgroundColor: colors.signal, borderWidth: 2, borderColor: colors.ink },
                  step.state === 'failed' && { backgroundColor: colors.alert },
                  step.state === 'todo' && { borderWidth: 2, borderColor: tones.dashed },
                ]}
              >
                {step.state === 'done' ? (
                  <Icon name="check" size={14} color={colors.surface} />
                ) : step.state === 'failed' ? (
                  <Icon name="x" size={14} color={colors.surface} />
                ) : (
                  <Text style={body(13, 700)}>{localDigits(i + 1, lang)}</Text>
                )}
              </View>
              <Text style={[body(16, step.state === 'current' ? 700 : 400), { flex: 1 }, step.state === 'todo' && { color: colors.muted }]}>
                {step.label}
              </Text>
              {step.state === 'current' ? <Text style={[body(14, 700), { color: colors.money }]}>{t('stepInProgress')}</Text> : null}
            </View>
          ))}
        </Card>

        <Card style={{ paddingVertical: 12, gap: 4 }}>
          <Text style={[display(18), { marginBottom: 4 }]}>{t('yourApplication')}</Text>
          <Text style={body(15)}>{t('areasValue', { areas: workAreaNames(p.workAreas, lang) })}</Text>
          <Text style={body(15)}>{t('vehicleValue', { vehicle: t(`vehicle_${p.vehicleType}`) })}</Text>
        </Card>

        {rejected ? (
          <Button testID="apply-again" label={t('applyAgain')} icon="edit-3" onPress={() => router.push('/join')} />
        ) : (
          <Button label={t('checkStatus')} icon="refresh-cw" variant="outline" loading={profile.isRefetching} onPress={() => profile.refetch()} />
        )}
        {SUPPORT_PHONE ? (
          <Button label={t('callSupport')} icon="phone" variant="outline" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
        ) : null}
        <Button label={t('logOut')} icon="log-out" variant="dangerLink" onPress={signOut} style={{ alignSelf: 'center' }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, gap: 16, flexGrow: 1 },
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.selectedTint, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
