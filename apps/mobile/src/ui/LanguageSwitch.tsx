import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUpdateMe } from '../api/hooks';
import { apiLanguage, useLang, useT } from '../i18n/lang';
import { body, colors, minTouch, radius } from './theme';

/** বাংলা | English segmented switch; the choice is kept on the phone and saved to the account (H10, C11). */
export function LanguageSwitch() {
  const { t, lang } = useT();
  const { setLang } = useLang();
  const updateMe = useUpdateMe();
  const choose = (next: 'bn' | 'en') => {
    if (next === lang) return;
    setLang(next);
    updateMe.mutate({ language: apiLanguage(next) });
  };
  return (
    <View style={s.segment} accessibilityRole="radiogroup" accessibilityLabel={t('language')}>
      {(['bn', 'en'] as const).map((l) => (
        <Pressable
          key={l}
          accessibilityRole="radio"
          accessibilityState={{ checked: lang === l }}
          onPress={() => choose(l)}
          style={[s.segBtn, lang === l && { backgroundColor: colors.ink }]}
        >
          <Text style={[body(15, 600), { color: lang === l ? colors.surface : colors.ink }]}>{t(l === 'bn' ? 'langBn' : 'langEn')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.sm, backgroundColor: colors.ground },
  segBtn: { minHeight: minTouch, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
});
