import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, minTouch, radius, t, type Lang } from '@bw/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';

type Health = 'checking' | 'up' | 'down';

function useServerHealth(): [Health, () => void] {
  const [health, setHealth] = useState<Health>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setHealth('checking');
    const timer = setTimeout(() => !cancelled && setHealth('down'), 5000);
    fetch(`${API_URL}/health`)
      .then((res) => !cancelled && setHealth(res.ok ? 'up' : 'down'))
      .catch(() => !cancelled && setHealth('down'))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt]);
  return [health, () => setAttempt((n) => n + 1)];
}

export default function App() {
  const [lang, setLang] = useState<Lang>('bn');
  const [health, retry] = useServerHealth();

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Pressable
        accessibilityRole="button"
        onPress={() => setLang(lang === 'bn' ? 'en' : 'bn')}
        style={styles.langToggle}
      >
        <Text style={styles.langText}>{lang === 'bn' ? 'English' : 'বাংলা'}</Text>
      </Pressable>

      <Image
        source={require('./assets/logo-circle.png')}
        style={styles.logo}
        accessibilityLabel={t('appName', lang)}
      />
      <Text style={styles.title}>{t('appName', lang)}</Text>
      <Text style={styles.tagline}>{t('tagline', lang)}</Text>

      <Pressable accessibilityRole="button" onPress={retry} style={styles.statusCard}>
        {health === 'checking' && <ActivityIndicator color={colors.ink} />}
        <Text style={[styles.statusText, health === 'down' && { color: colors.alert }]}>
          {health === 'checking' ? t('checking', lang) : health === 'up' ? t('serverOk', lang) : t('serverDown', lang)}
        </Text>
      </Pressable>
      <Text style={styles.hint}>{API_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.signal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  langToggle: {
    position: 'absolute',
    top: 56,
    right: 20,
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  langText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  logo: { width: 220, height: 220 },
  title: { color: colors.ink, fontSize: 40, fontWeight: '800' },
  tagline: { color: colors.ink, fontSize: 18 },
  statusCard: {
    marginTop: 24,
    minHeight: minTouch,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.ink, fontSize: 12, opacity: 0.7 },
});
