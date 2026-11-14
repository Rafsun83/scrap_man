import { Text, View } from 'react-native';
import { useSession } from '../../src/auth/session';
import { useT } from '../../src/i18n/lang';
import { Button, Icon, Screen } from '../../src/ui/components';
import { body, colors, display } from '../../src/ui/theme';

/** Collector screens arrive in M4; until then a collector who signs in sees this. */
export default function CollectorSoon() {
  const { t } = useT();
  const { signOut } = useSession();
  return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          backgroundColor: colors.signal,
          borderWidth: 2,
          borderColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="truck" size={32} />
      </View>
      <Text style={[display(26), { textAlign: 'center' }]}>{t('collectorSoonTitle')}</Text>
      <Text style={[body(16), { textAlign: 'center', color: colors.muted }]}>{t('collectorSoonBody')}</Text>
      <Button label={t('logOut')} icon="log-out" variant="danger" onPress={signOut} style={{ alignSelf: 'stretch' }} />
    </Screen>
  );
}
