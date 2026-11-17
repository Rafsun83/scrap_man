import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ApiError } from './api/client'
import { SessionProvider } from './auth/SessionProvider'
import { LangProvider } from './components/LangProvider'
import { RealtimeProvider } from './components/RealtimeProvider'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Retry network blips, never client errors like NOT_FOUND.
      retry: (count, error) => count < 2 && (!(error instanceof ApiError) || error.code === 'NETWORK' || error.status >= 500),
    },
    mutations: { retry: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RealtimeProvider>
            <RouterProvider router={router} />
          </RealtimeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </LangProvider>
  </StrictMode>,
)
