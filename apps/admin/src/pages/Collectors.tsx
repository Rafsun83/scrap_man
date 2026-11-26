import { PageHead } from '../components/PageHead'
import { localDigits, type CollectorProfile } from '@bw/shared'
import { useState } from 'react'
import { useCollectors, useDecideCollector, type VerificationStatus } from '../api/hooks'
import { Icon } from '../components/Icon'
import { Banner, Button, Empty, ErrorBox, Loading } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { formatDate, formatPhone, initials, workAreaNames } from '../lib/format'
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
      <PageHead title={t('navCollectors')} sub={t('collectorsSub')} />
      <div className="tabs" role="group">
        {TABS.map((x) => (
          <button key={x.key} type="button" className="tab" aria-pressed={tab === x.key} onClick={() => { setTab(x.key); setSelectedId(null) }}>
            {t(x.label)}
          </button>
        ))}
      </div>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <section className="panel">
          <Empty text={t('noApplicants')} />
        </section>
      ) : (
        <div className="split">
          <section className="list" aria-label={t('applicants')}>
            <div className="list-head">
              {t('applicants')} · {localDigits(items.length, lang)}
              {list.hasNextPage ? '+' : ''}
            </div>
            {items.map((c) => (
              <button key={c.userId} type="button" className="list-item" aria-current={selected?.userId === c.userId} onClick={() => setSelectedId(c.userId)}>
                <span className="tile" aria-hidden="true">{initials(c.name, c.phone)}</span>
                <span className="body">
                  <span className="title">{c.name ?? t('unnamed')}</span>
                  <span className="meta">{t('appliedOn', { areas: workAreaNames(c.workAreas, lang), date: formatDate(c.submittedAt, lang) })}</span>
                </span>
              </button>
            ))}
            {list.hasNextPage ? (
              <Button icon="arrowDown" busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                {t('showMore')}
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
    <section className="panel detail" aria-label={c.name ?? t('unnamed')} style={{ padding: 24, gap: 20 }}>
      <div className="detail-top">
        {c.selfieUrl ? (
          <img className="selfie" src={c.selfieUrl} alt={t('selfie')} />
        ) : (
          <div className="selfie">
            <Icon name="camera" size={28} />
            {t('noSelfie')}
          </div>
        )}
        <div className="info">
          <div className="titles" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2>{c.name ?? t('unnamed')}</h2>
            <span className="row" style={{ gap: 8, fontSize: 14 }}>
              <span className="muted">{formatPhone(c.phone, lang)} · {formatDate(c.submittedAt, lang)}</span>
              <span className={`badge ${c.verificationStatus === 'APPROVED' ? 'done' : c.verificationStatus === 'REJECTED' ? 'alert' : 'active'}`}>
                {t(`verif_${c.verificationStatus}`)}
              </span>
            </span>
          </div>
          <dl className="facts">
            <div>
              <dt>{t('workAreas')}</dt>
              <dd>{workAreaNames(c.workAreas, lang)}</dd>
            </div>
            <div>
              <dt>{t('vehicle')}</dt>
              <dd>{t(`vehicle_${c.vehicleType}`)}</dd>
            </div>
            <div>
              <dt>{t('ownScale')}</dt>
              <dd>{c.hasScale ? t('yes') : t('no')}</dd>
            </div>
            <div>
              <dt>{t('nidNumber')}</dt>
              <dd style={{ letterSpacing: '0.04em' }}>{c.nidNumberMasked}</dd>
            </div>
          </dl>
        </div>
      </div>

      {pending ? (
        <>
          <fieldset className="checks">
            <legend>{t('checks')}</legend>
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
          </fieldset>
          <label className="field">
            {t('noteForRecord')}
            <textarea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </label>
          {decide.error ? <Banner tone="alert" role="alert">{errorMessage(decide.error, lang)}</Banner> : null}
          <div className="actions-end">
            <span className="muted" style={{ fontSize: 14, marginRight: 'auto' }}>
              {!allChecked ? t('approveNeedsChecks') : null} {note.trim() ? null : t('rejectNeedsNote')}
            </span>
            <Button
              variant="danger"
              large
              icon="x"
              busy={decide.isPending && decide.variables?.decision === 'REJECTED'}
              disabled={note.trim().length === 0}
              onClick={() => decide.mutate({ userId: c.userId, decision: 'REJECTED', note: note.trim() })}
            >
              {t('reject')}
            </Button>
            <Button
              variant="primary"
              large
              icon="check"
              busy={decide.isPending && decide.variables?.decision === 'APPROVED'}
              disabled={!allChecked}
              onClick={() => decide.mutate({ userId: c.userId, decision: 'APPROVED', note: note.trim() || undefined })}
            >
              {t('approve')}
            </Button>
          </div>
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
