import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAddresses, useUpdateMe } from '../../../src/api/hooks';
import { useSession } from '../../../src/auth/session';
import { apiLanguage, useLang, useT } from '../../../src/i18n/lang';
import { formatPhone, initials } from '../../../src/lib/format';
import { Button, Card, Divider, ErrorView, Icon, LoadingView, Screen } from '../../../src/ui/components';
import { errorMessage } from '../../../src/ui/errors';
import { LanguageSwitch } from '../../../src/ui/LanguageSwitch';
import { body, colors, display, minTouch, radius } from '../../../src/ui/theme';

/**
 * H10: name, saved addresses, language, notifications, log out. The prototype's help and terms rows wait
 * for approved help/terms content.
 */
export default function Profile() {
  const { t, lang } = useT();
  const { setLang } = useLang();
  const router = useRouter();
  const { user, signOut } = useSession();
  const addresses = useAddresses();
  const updateMe = useUpdateMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');

  const saveName = () =>
    updateMe.mutate({ name: name.trim() }, { onSuccess: () => setEditing(false) });

  return (
    <Screen edges={['top']}>
      <View style={s.head}>
        <View style={s.avatar}>
          <Text style={display(28, 800)}>{initials(user?.name)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {editing ? (
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={80}
              accessibilityLabel={t('yourName')}
              placeholder={t('yourName')}
              placeholderTextColor={colors.muted}
              style={s.nameInput}
              onSubmitEditing={saveName}
            />
          ) : (
            <Text style={[display(24), { lineHeight: 30 }]}>{user?.name || t('nameUnset')}</Text>
          )}
          <Text style={[body(15), { color: colors.muted }]}>{user?.phone ? formatPhone(user.phone, lang) : ''}</Text>
        </View>
      </View>
      {editing ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label={t('cancel')} icon="x" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
          <Button label={t('save')} icon="check" loading={updateMe.isPending} disabled={!name.trim()} onPress={saveName} style={{ flex: 1 }} />
        </View>
      ) : (
        <Button label={t('editProfile')} icon="edit-2" variant="outline" onPress={() => setEditing(true)} />
      )}
      {updateMe.error ? <Text style={[body(15, 600), { color: colors.alert }]}>{errorMessage(updateMe.error, lang)}</Text> : null}

      <View style={{ gap: 8 }}>
        <Text style={display(20)}>{t('savedAddresses')}</Text>
        {addresses.isPending ? (
          <LoadingView />
        ) : addresses.isError ? (
          <ErrorView message={errorMessage(addresses.error, lang)} onRetry={() => addresses.refetch()} />
        ) : (
          <Card>
            {addresses.data.length === 0 ? <Text style={[body(15), s.emptyAddr]}>{t('noAddresses')}</Text> : null}
            {addresses.data.map((a) => (
              <View key={a.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('editAddressOf', { label: a.label })}
                  onPress={() => router.push({ pathname: '/address', params: { id: a.id } })}
                  style={s.addr}
                >
                  <Icon name={a.isDefault ? 'home' : 'map-pin'} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={body(16, 700)}>{a.label}</Text>
                      {a.isDefault ? <Text style={[body(12, 600), s.defaultPill]}>{t('defaultAddress')}</Text> : null}
                    </View>
                    <Text style={[body(14), { color: colors.muted, lineHeight: 20 }]}>
                      {a.line}, {a.area}
                    </Text>
                  </View>
                  <Icon name="edit-2" size={18} />
                </Pressable>
                <Divider />
              </View>
            ))}
            <Button label={t('addAddress')} icon="plus" variant="link" onPress={() => router.push('/address')} style={{ alignSelf: 'flex-start' }} />
          </Card>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={display(20)}>{t('settings')}</Text>
        <Card>
          <View style={s.setting}>
            <Text style={body(16, 600)}>{t('language')}</Text>
            <LanguageSwitch />
          </View>
          <Divider />
          <Pressable accessibilityRole="button" onPress={() => router.push('/notifications')} style={s.setting}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="bell" size={20} />
              <Text style={body(16, 600)}>{t('notifications')}</Text>
            </View>
            <Icon name="chevron-right" size={20} />
          </Pressable>
        </Card>
      </View>

      <Button label={t('logOut')} icon="log-out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: { ...body(20, 600), minHeight: minTouch, borderBottomWidth: 2, borderBottomColor: colors.ink },
  addr: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, minHeight: minTouch },
  emptyAddr: { color: colors.muted, paddingVertical: 14 },
  defaultPill: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    color: colors.surface,
    overflow: 'hidden',
  },
  setting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56 },
});
