import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createApiClient, type ApiClient, type Tokens } from '../api/client';
import type { Session, User } from '../api/types';
import { API_URL } from '../config';
import { fromApiLanguage, useLang } from '../i18n/lang';
import { forgetPushToken } from '../push/registration';

const SESSION_KEY = 'bw.session';

type Stored = Tokens & { user: User };

export type SessionValue = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  api: ApiClient;
  /** Current access token, for the socket handshake. */
  accessToken: () => string | null;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

function persist(stored: Stored | null) {
  const op = stored
    ? SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(stored))
    : SecureStore.deleteItemAsync(SESSION_KEY);
  op.catch(() => {});
}

export function SessionProvider({ children, baseUrl = API_URL }: { children: ReactNode; baseUrl?: string }) {
  const { setLang } = useLang();
  const [status, setStatus] = useState<SessionValue['status']>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const stored = useRef<Stored | null>(null);

  const save = useCallback((next: Stored | null) => {
    stored.current = next;
    persist(next);
    setUserState(next?.user ?? null);
    setStatus(next ? 'signedIn' : 'signedOut');
  }, []);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl,
        getAccessToken: () => stored.current?.accessToken ?? null,
        getRefreshToken: () => stored.current?.refreshToken ?? null,
        onSession: (s) => save({ accessToken: s.accessToken!, refreshToken: s.refreshToken!, user: s.user! }),
        onSignedOut: () => save(null),
      }),
    [baseUrl, save],
  );

  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then((raw) => {
        const parsed = raw ? (JSON.parse(raw) as Stored) : null;
        stored.current = parsed;
        setUserState(parsed?.user ?? null);
        setStatus(parsed ? 'signedIn' : 'signedOut');
      })
      .catch(() => setStatus('signedOut'));
  }, []);

  const signIn = useCallback(
    async (session: Session) => {
      save({ accessToken: session.accessToken!, refreshToken: session.refreshToken!, user: session.user! });
      setLang(fromApiLanguage(session.user?.language));
    },
    [save, setLang],
  );

  const signOut = useCallback(async () => {
    const refreshToken = stored.current?.refreshToken;
    await forgetPushToken(api);
    save(null);
    if (refreshToken) {
      await api.request('POST', '/auth/logout', { body: { refreshToken }, auth: false }).catch(() => {});
    }
  }, [api, save]);

  const setUser = useCallback(
    (next: User) => {
      if (stored.current) save({ ...stored.current, user: next });
    },
    [save],
  );

  const value = useMemo<SessionValue>(
    () => ({ status, user, api, accessToken: () => stored.current?.accessToken ?? null, signIn, signOut, setUser }),
    [status, user, api, signIn, signOut, setUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
