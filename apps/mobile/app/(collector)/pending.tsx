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
import { body, colors, display, radius, tones } from '../../src/ui/theme';
import { Badge, IconTile } from '../../src/ui/parts';

/**
 * C7 (v1 design `collector/CPending.dc.html`): the application is being checked, or was rejected with the admin's note. An approval arrives as the
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
        <IconTile
          icon={rejected ? 'x-circle' : 'clock'}
          tint={rejected ? tones.alertBg : '#FFF4D6'}
          color={rejected ? colors.alert : '#8A5A00'}
          size={64}
        />
        <Text style={[display(26), { lineHeight: 32 }]}>{rejected ? t('rejectedTitle') : t('pendingTitle')}</Text>
        <Text style={[body(15), { color: colors.muted, lineHeight: 23 }]}>{rejected ? t('rejectedBody') : t('pendingBody')}</Text>

        {rejected && p.verificationNote ? (
          <Note tone="alert" icon="message-square" text={`${t('rejectedReason')}: ${p.verificationNote}`} />
        ) : null}

        <Card style={{ paddingVertical: 12, gap: 4 }}>
          <Text style={[body(14, 600), { marginBottom: 4 }]}>{t('stepsTitle')}</Text>
          {steps.map((step, i) => (
            <View key={step.label} style={s.step}>
              <View
                style={[
                  s.dot,
                  step.state === 'done' && { backgroundColor: colors.money },
                  step.state === 'current' && { borderWidth: 2, borderColor: colors.ink },
                  step.state === 'failed' && { backgroundColor: colors.alert },
                  step.state === 'todo' && { borderWidth: 1.5, borderColor: tones.ring },
                ]}
              >
                {step.state === 'done' ? (
                  <Icon name="check" size={14} color={colors.surface} />
                ) : step.state === 'failed' ? (
                  <Icon name="x" size={14} color={colors.surface} />
                ) : (
                  <Text style={[body(12, 600), step.state === 'todo' && { color: colors.muted }]}>{localDigits(i + 1, lang)}</Text>
                )}
              </View>
              <Text style={[body(15, step.state === 'current' ? 600 : 400), { flex: 1 }, step.state === 'todo' && { color: colors.muted }]}>
                {step.label}
              </Text>
              {step.state === 'current' ? <Badge label={t('stepInProgress')} tone="warn" /> : null}
            </View>
          ))}
        </Card>

        <Card style={{ paddingVertical: 12, gap: 4 }}>
          <Text style={[body(14, 600), { marginBottom: 4 }]}>{t('yourApplication')}</Text>
          <Text style={[body(14), { color: colors.muted }]}>{t('areasValue', { areas: workAreaNames(p.workAreas, lang) })}</Text>
          <Text style={[body(14), { color: colors.muted }]}>{t('vehicleValue', { vehicle: t(`vehicle_${p.vehicleType}`) })}</Text>
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
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  dot: { width: 24, height: 24, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
});
