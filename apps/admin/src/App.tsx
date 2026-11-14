import { useEffect, useState } from 'react'
import { colors } from '@bw/shared'

const SECTIONS = [
  { id: 'pickups', label: 'Live pickups', blurb: 'Every pickup with its status, a map of open requests and online collectors, and the ones that need attention.' },
  { id: 'rates', label: 'Daily rates', blurb: 'Set and publish today\u2019s rate per category. Accepted pickups keep the rate that was live when they were accepted.' },
  { id: 'collectors', label: 'Collector approvals', blurb: 'Check each applicant\u2019s selfie and NID number, then approve or reject.' },
  { id: 'disputes', label: 'Disputes', blurb: 'Weight and payment disputes, with the timeline, both weigh rounds and the resolution options.' },
  { id: 'users', label: 'Users', blurb: 'Households and collectors, with status, pickups and release counts.' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']
type Health = { state: 'checking' } | { state: 'up' } | { state: 'down'; detail: string }

function useApiHealth(): Health {
  const [health, setHealth] = useState<Health>({ state: 'checking' })
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/health', { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) return setHealth({ state: 'up' })
        const body = await res.json().catch(() => null)
        setHealth({ state: 'down', detail: body ? JSON.stringify(body.checks ?? body) : `HTTP ${res.status}` })
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setHealth({ state: 'down', detail: String(err) })
      })
    return () => controller.abort()
  }, [])
  return health
}

function BrandMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 200 200" aria-hidden="true">
      <rect width="200" height="200" rx="44" fill={colors.signal} />
      <circle cx="100" cy="90" r="52" fill="#E0A872" stroke={colors.ink} strokeWidth="6" />
      <path d="M48 86 C46 50 72 36 100 36 C130 36 156 52 152 86 C142 70 122 64 104 66 C84 64 62 72 48 86 Z" fill={colors.ink} />
      <line x1="24" y1="114" x2="176" y2="114" stroke={colors.ink} strokeWidth="9" strokeLinecap="round" />
      <path d="M8 150 Q24 166 40 150 Z M160 150 Q176 166 192 150 Z" fill="#fff" stroke={colors.ink} strokeWidth="5" />
      <path d="M24 114 L12 150 M24 114 L36 150 M176 114 L164 150 M176 114 L188 150" stroke={colors.ink} strokeWidth="4" />
    </svg>
  )
}

export default function App() {
  const [active, setActive] = useState<SectionId>('pickups')
  const section = SECTIONS.find((s) => s.id === active)!
  const health = useApiHealth()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">BhangariWala</div>
            <div className="brand-sub">Admin</div>
          </div>
        </div>
        <nav className="nav" aria-label="Admin">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === active ? 'page' : undefined}
              onClick={() => setActive(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="main-inner">
          <h1>{section.label}</h1>
          <p className="lead">{section.blurb} This page is built in milestone M5.</p>

          <section className="panel" aria-labelledby="api-title">
            <h2 id="api-title">API connection</h2>
            {health.state === 'checking' && <span className="status">Checking the API…</span>}
            {health.state === 'up' && (
              <span className="status" data-state="up">The API, database and Redis are answering</span>
            )}
            {health.state === 'down' && (
              <>
                <span className="status" data-state="down">The API is not reachable or not healthy</span>
                <span>
                  Start the services with <code>pnpm db:up</code>, then the API with <code>pnpm dev</code>. Details:{' '}
                  <code>{health.detail}</code>
                </span>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
