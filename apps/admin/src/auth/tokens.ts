const REFRESH_KEY = 'bw.admin.refresh'

/**
 * Where the admin's tokens live: the access token only in memory, the refresh token also in this browser so a
 * reload signs straight back in (refresh tokens rotate, and signing out revokes it).
 */
export type TokenHolder = {
  access: string | null
  refresh: string | null
  set: (access: string | null, refresh: string | null) => void
}

export function createTokenHolder(): TokenHolder {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(REFRESH_KEY)
  } catch {
    saved = null
  }
  const holder: TokenHolder = {
    access: null,
    refresh: saved,
    set(access, refresh) {
      holder.access = access
      holder.refresh = refresh
      try {
        if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
        else localStorage.removeItem(REFRESH_KEY)
      } catch {
        // Private mode: the session lasts until the tab closes.
      }
    },
  }
  return holder
}
