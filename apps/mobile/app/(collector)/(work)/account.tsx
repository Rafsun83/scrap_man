import { localDigits } from '@bw/shared';
import { useRouter } from 'expo-router';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../../src/auth/session';
import { useCollectorProfile } from '../../../src/collector/api';
import { KeyValue, cs, workAreaNames } from '../../../src/collector/ui';
import { SUPPORT_PHONE } from '../../../src/config';
import { useT } from '../../../src/i18n/lang';
import { formatPhone, initials } from '../../../src/lib/format';
import { Button, Divider, ErrorView, Icon, LoadingView, Screen } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { LanguageSwitch } from '../../../src/ui/LanguageSwitch';
import { body, colors, display, radius } from '../../../src/ui/theme';
import { StatCard } from '../../../src/ui/parts';

/** C11 (v1 design `collector/CProfile.dc.html`): rating, 30-day activity, work details (changeable), verification status, settings, log out. */
export default function Account() {
  const { t, lang } = useT();
  const router = useRouter();
  const { signOut } = useSession();
  const profile = useCollectorProfile();

  if (profile.isPending) return <LoadingView />;
  if (profile.isError || !profile.data) {
    return <ErrorView message={errorMessage(profile.error, lang)} onRetry={() => profile.refetch()} />;
  }
  const p = profile.data;
  const edit = <Button label={t('change')} icon="edit-2" variant="link" onPress={() => router.push('/work-details')} />;

  return (
    <Screen edges={['top']}>
      <View style={s.head}>
        {p.selfieUrl ? (
          <Image source={{ uri: p.selfieUrl }} style={s.avatar} accessibilityLabel={t('selfie')} />
        ) : (
          <View style={[s.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }]}>
            <Text style={[display(22), { color: colors.surface }]}>{initials(p.name)}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={display(22)}>{p.name}</Text>
          <Text style={[body(14), { color: colors.muted }]}>{formatPhone(p.phone, lang)}</Text>
          <View style={s.verified}>
            <Icon name="shield" size={14} color={colors.money} />
            <Text style={[body(13, 500), { color: colors.money }]}>{t('verifiedCollector')}</Text>
          </View>
        </View>
      </View>

      <View style={s.stats}>
        <StatCard
          label={t('ratingFromCustomers')}
          value={p.ratingAvg != null ? `★ ${t('ratingOutOf5', { rating: localDigits(p.ratingAvg.toFixed(1), lang) })}` : t('noRatingYet')}
        />
        <StatCard label={t('pickups30d')} value={t('countPickups', { count: localDigits(p.pickups30d, lang) })} testID="pickups-30d" />
      </View>
      {p.releases30d > 0 ? (
        <Text style={[body(14), { color: colors.muted }]}>{t('releases30d', { count: localDigits(p.releases30d, lang) })}</Text>
      ) : null}

      <Text style={cs.sectionTitle}>{t('workDetails')}</Text>
      <View style={cs.section}>
        <KeyValue label={t('workAreas')} value={workAreaNames(p.workAreas, lang)} action={edit} />
        <KeyValue label={t('vehicle')} value={t(`vehicle_${p.vehicleType}`)} action={edit} />
        <KeyValue label={t('ownScale')} value={p.hasScale ? t('yesHave') : t('noHave')} action={edit} last />
      </View>

      <Text style={cs.sectionTitle}>{t('verification')}</Text>
      <View style={cs.section}>
        <KeyValue label={t('selfie')} value={t('verifiedDone')} />
        <KeyValue label={t('nidNumber')} value={`${t('nidProvided')} · ${p.nidNumberMasked}`} />
        <KeyValue label={t('nidCardCheck')} value={p.nidVerified ? t('verifiedDone') : t('askedLater')} last />
      </View>

      <Text style={cs.sectionTitle}>{t('settings')}</Text>
      <View style={cs.section}>
        <View style={s.setting}>
          <Text style={body(15)}>{t('language')}</Text>
          <LanguageSwitch />
        </View>
        {SUPPORT_PHONE ? (
          <>
            <Divider />
            <Button
              label={t('callSupport')}
              icon="headphones"
              variant="link"
              onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
              style={{ alignSelf: 'flex-start' }}
            />
          </>
        ) : null}
      </View>

      <Button label={t('logOut')} icon="log-out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: radius.md },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stats: { flexDirection: 'row', gap: 10 },
  setting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56 },
});
