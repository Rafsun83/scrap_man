import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { ApiClient } from '../api/client'
import { SessionContext, type SessionValue } from '../auth/session-context'
import { LangProvider } from '../components/LangProvider'

/** Renders with a fake signed-in admin whose API calls go to `request`. */
export function renderWithApi(ui: ReactElement, request: ApiClient['request'], lang: 'en' | 'bn' = 'en') {
  const api: ApiClient = { request, refresh: vi.fn(async () => true) }
  const session: SessionValue = {
    status: 'signedIn',
    user: { id: 'a1', phone: '+8801700000000', role: 'ADMIN', name: 'Ops', language: 'EN', status: 'ACTIVE', createdAt: '' },
    api,
    accessToken: () => 'token',
    signIn: vi.fn(),
    signOut: vi.fn(),
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <LangProvider initial={lang}>
      <QueryClientProvider client={qc}>
        <SessionContext.Provider value={session}>
          <MemoryRouter>{ui}</MemoryRouter>
        </SessionContext.Provider>
      </QueryClientProvider>
    </LangProvider>,
  )
}
