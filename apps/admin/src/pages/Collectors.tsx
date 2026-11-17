import type { CollectorProfile } from '@bw/shared'
import { useState } from 'react'
import { useCollectors, useDecideCollector, type VerificationStatus } from '../api/hooks'
import { Button, Empty, ErrorBox, Loading } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { formatDate, formatPhone, workAreaNames } from '../lib/format'
import { useT } from '../lib/i18n'

const TABS: { key: VerificationStatus; label: 'tabPending' | 'tabApproved' | 'tabRejected' }[] = [
  { key: 'PENDING', label: 'tabPending' },
  { key: 'APPROVED', label: 'tabApproved' },
  { key: 'REJECTED', label: 'tabRejected' },
]

/** A3: applicants oldest first; selfie, NID, work details; three checks before approving, a note to reject. */
export function CollectorsPage() {
  const { t, lang } = useT()
  const [tab, setTab] = useState<VerificationStatus>('PENDING')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const list = useCollectors(tab)
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  const selected = items.find((c) => c.userId === selectedId) ?? items[0] ?? null

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('navCollectors')}</h1>
          <p className="muted">{t('collectorsSub')}</p>
        </div>
      </div>
      <div className="chips" role="group">
        {TABS.map((x) => (
          <button key={x.key} type="button" className="chip" aria-pressed={tab === x.key} onClick={() => { setTab(x.key); setSelectedId(null) }}>
            {t(x.label)}
          </button>
        ))}
      </div>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <Empty text={t('noApplicants')} />
      ) : (
        <div className="split">
          <section className="list" aria-label={t('applicants')}>
            {items.map((c) => (
              <button key={c.userId} type="button" className="list-item" aria-current={selected?.userId === c.userId} onClick={() => setSelectedId(c.userId)}>
                <strong>{c.name ?? t('unnamed')}</strong>
                <span className="muted">{t('appliedOn', { areas: workAreaNames(c.workAreas, lang), date: formatDate(c.submittedAt, lang) })}</span>
              </button>
            ))}
            {list.hasNextPage ? (
              <Button busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                ↓ {t('showMore')}
              </Button>
            ) : null}
          </section>
          {selected ? <Applicant key={selected.userId} c={selected} /> : null}
        </div>
      )}
    </>
  )
}

export function Applicant({ c }: { c: CollectorProfile }) {
  const { t, lang } = useT()
  const decide = useDecideCollector()
  const [checks, setChecks] = useState({ nid: false, selfie: false, name: false })
  const [note, setNote] = useState('')
  const pending = c.verificationStatus === 'PENDING'
  const allChecked = checks.nid && checks.selfie && checks.name

  return (
    <section className="panel" aria-label={c.name ?? t('unnamed')}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        {c.selfieUrl ? <img className="selfie" src={c.selfieUrl} alt={t('selfie')} /> : <div className="selfie center muted">{t('noSelfie')}</div>}
        <div className="stack" style={{ flex: 1 }}>
          <div>
            <h2>{c.name ?? t('unnamed')}</h2>
            <span className="muted">{formatPhone(c.phone, lang)}</span>{' '}
            <span className={`badge ${c.verificationStatus === 'APPROVED' ? 'done' : c.verificationStatus === 'REJECTED' ? 'alert' : 'active'}`}>
              {t(`verif_${c.verificationStatus}`)}
            </span>
          </div>
          <dl className="kv">
            <dt>{t('workAreas')}</dt>
            <dd>{workAreaNames(c.workAreas, lang)}</dd>
            <dt>{t('vehicle')}</dt>
            <dd>{t(`vehicle_${c.vehicleType}`)}</dd>
            <dt>{t('ownScale')}</dt>
            <dd>{c.hasScale ? t('yes') : t('no')}</dd>
            <dt>{t('nidNumber')}</dt>
            <dd>{c.nidNumberMasked}</dd>
          </dl>
        </div>
      </div>

      {pending ? (
        <>
          <h3>{t('checks')}</h3>
          <label className="check">
            <input type="checkbox" checked={checks.nid} onChange={(e) => setChecks({ ...checks, nid: e.target.checked })} />
            {t('checkNid')}
          </label>
          <label className="check">
            <input type="checkbox" checked={checks.selfie} onChange={(e) => setChecks({ ...checks, selfie: e.target.checked })} />
            {t('checkSelfie')}
          </label>
          <label className="check">
            <input type="checkbox" checked={checks.name} onChange={(e) => setChecks({ ...checks, name: e.target.checked })} />
            {t('checkName')}
          </label>
          <label className="field">
            {t('noteForRecord')}
            <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </label>
          {decide.error ? <p className="alert" role="alert">{errorMessage(decide.error, lang)}</p> : null}
          <div className="row">
            <Button
              variant="primary"
              busy={decide.isPending && decide.variables?.decision === 'APPROVED'}
              disabled={!allChecked}
              onClick={() => decide.mutate({ userId: c.userId, decision: 'APPROVED', note: note.trim() || undefined })}
            >
              ✓ {t('approve')}
            </Button>
            <Button
              variant="danger"
              busy={decide.isPending && decide.variables?.decision === 'REJECTED'}
              disabled={note.trim().length === 0}
              onClick={() => decide.mutate({ userId: c.userId, decision: 'REJECTED', note: note.trim() })}
            >
              ✕ {t('reject')}
            </Button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {!allChecked ? t('approveNeedsChecks') : null} {note.trim() ? null : t('rejectNeedsNote')}
          </p>
        </>
      ) : (
        <p style={{ margin: 0 }}>
          {c.decidedAt ? t('decidedOn', { date: formatDate(c.decidedAt, lang) }) : null}
          {c.verificationNote ? <span className="muted"> · {t('noteValue', { note: c.verificationNote })}</span> : null}
        </p>
      )}
    </section>
  )
}
