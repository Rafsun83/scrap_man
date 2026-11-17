import { ADMIN_ATTENTION, localDigits, USER_STATUSES, type AdminUserRow } from '@bw/shared'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { usePickups, useSetUserStatus, useUsers, type UserStatus } from '../api/hooks'
import { PickupDrawer } from '../components/PickupDrawer'
import { Button, Drawer, Empty, ErrorBox, Loading, StatusBadge } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { formatDate, formatPhone, formatWhen, money, workAreaNames } from '../lib/format'
import { useT } from '../lib/i18n'

type Role = 'HOUSEHOLD' | 'COLLECTOR'

const STATUS_TONE: Record<UserStatus, string> = { ACTIVE: 'done', FLAGGED: 'active', SUSPENDED: 'alert' }

/** A5: households and collectors with their figures; collectors with many releases are highlighted. */
export function UsersPage() {
  const { t, lang } = useT()
  const [params, setParams] = useSearchParams()
  const role: Role = params.get('role') === 'COLLECTOR' ? 'COLLECTOR' : 'HOUSEHOLD'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [search, setSearch] = useState(q)
  const [viewing, setViewing] = useState<AdminUserRow | null>(null)
  useEffect(() => {
    const id = setTimeout(() => setSearch(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])
  const users = useUsers(role, search)
  const rows = users.data?.pages.flatMap((p) => p.items) ?? []
  const setRole = (r: Role) => setParams(search ? { role: r, q: search } : { role: r })

  return (
    <>
      <div className="page-head">
        <h1>{t('navUsers')}</h1>
        <span className="spacer" />
        <input type="search" aria-label={t('searchUsers')} placeholder={t('searchUsers')} value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
      </div>
      <div className="chips" role="group">
        {(['HOUSEHOLD', 'COLLECTOR'] as const).map((r) => (
          <button key={r} type="button" className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>
            {t(r === 'HOUSEHOLD' ? 'tabHouseholds' : 'tabCollectors')}
          </button>
        ))}
      </div>
      <section className="panel">
        {users.isPending ? (
          <Loading />
        ) : users.isError ? (
          <ErrorBox error={users.error} onRetry={() => void users.refetch()} />
        ) : rows.length === 0 ? (
          <Empty text={t('noUsers')} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                {role === 'HOUSEHOLD' ? (
                  <tr>
                    <th>{t('colName')}</th>
                    <th>{t('colPhone')}</th>
                    <th>{t('colArea')}</th>
                    <th className="num">{t('colPickups')}</th>
                    <th className="num">{t('colTotalReceived')}</th>
                    <th>{t('colJoined')}</th>
                    <th>{t('colStatus')}</th>
                    <th>{t('colActions')}</th>
                  </tr>
                ) : (
                  <tr>
                    <th>{t('colName')}</th>
                    <th>{t('colPhone')}</th>
                    <th>{t('colAreas')}</th>
                    <th className="num">{t('colRating')}</th>
                    <th className="num">{t('colPickups30')}</th>
                    <th className="num">{t('colReleases30')}</th>
                    <th>{t('colStatus')}</th>
                    <th>{t('colActions')}</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={u.releaseFlag ? 'flagged' : undefined} data-testid={`user-${u.id}`}>
                    <td>{u.name ?? <span className="muted">{t('unnamed')}</span>}</td>
                    <td>{formatPhone(u.phone, lang)}</td>
                    {role === 'HOUSEHOLD' ? (
                      <>
                        <td>{u.household?.area ?? '—'}</td>
                        <td className="num">{localDigits(u.household?.completedCount ?? 0, lang)}</td>
                        <td className="num">{money(u.household?.totalReceived ?? 0, lang)}</td>
                        <td>{formatDate(u.createdAt, lang)}</td>
                      </>
                    ) : u.collector ? (
                      <>
                        <td>{workAreaNames(u.collector.workAreas, lang)}</td>
                        <td className="num">{u.collector.ratingAvg != null ? localDigits(u.collector.ratingAvg.toFixed(1), lang) : t('noRating')}</td>
                        <td className="num">{localDigits(u.collector.pickups30d, lang)}</td>
                        <td className="num">
                          {localDigits(u.collector.releases30d, lang)}
                          {u.releaseFlag ? <> <span className="badge alert">{t('releaseFlag')}</span></> : null}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="muted">{t('notApplied')}</td>
                    )}
                    <td>
                      <span className={`badge ${STATUS_TONE[u.status]}`}>{t(`ustatus_${u.status}`)}</span>
                    </td>
                    <td>
                      <Button small onClick={() => setViewing(u)}>
                        → {t('view')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {users.hasNextPage ? (
          <Button busy={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
            ↓ {t('showMore')}
          </Button>
        ) : null}
        {role === 'COLLECTOR' ? (
          <p className="muted" style={{ margin: 0 }}>{t('releasesNote', { count: localDigits(ADMIN_ATTENTION.maxReleases30d, lang) })}</p>
        ) : null}
      </section>
      {viewing ? <UserDrawer user={viewing} onClose={() => setViewing(null)} /> : null}
    </>
  )
}

/** One user: their pickups and the status change (with a warning about suspending a collector mid-pickup). */
export function UserDrawer({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const { t, lang } = useT()
  const pickups = usePickups({ userId: user.id })
  const active = usePickups({ userId: user.id, group: 'ACTIVE' })
  const setStatus = useSetUserStatus()
  const [status, setStatusValue] = useState<UserStatus>(user.status)
  const [note, setNote] = useState(user.statusNote ?? '')
  const [openPickup, setOpenPickup] = useState<string | null>(null)
  const rows = pickups.data?.pages.flatMap((p) => p.items ?? []) ?? []
  const activeCount = active.data?.pages[0]?.items?.length ?? 0

  if (openPickup) return <PickupDrawer pickupId={openPickup} onClose={() => setOpenPickup(null)} />

  return (
    <Drawer title={user.name ?? formatPhone(user.phone, lang)} onClose={onClose}>
      <section className="panel">
        <dl className="kv">
          <dt>{t('colPhone')}</dt>
          <dd>
            {formatPhone(user.phone, lang)} <a href={`tel:${user.phone}`}>☎ {t('call')}</a>
          </dd>
          <dt>{t('colJoined')}</dt>
          <dd>{formatDate(user.createdAt, lang)}</dd>
          {user.collector ? (
            <>
              <dt>{t('workAreas')}</dt>
              <dd>{workAreaNames(user.collector.workAreas, lang)}</dd>
              <dt>{t('colStatus')}</dt>
              <dd>
                {t(`verif_${user.collector.verificationStatus}`)}
                {user.collector.isOnline ? ` · ${t('online')}` : ''}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="panel">
        <h3>{t('changeStatus')}</h3>
        <div className="chips" role="radiogroup">
          {USER_STATUSES.map((s) => (
            <button key={s} type="button" className="chip" role="radio" aria-checked={status === s} aria-pressed={status === s} onClick={() => setStatusValue(s)}>
              {t(`ustatus_${s}`)}
            </button>
          ))}
        </div>
        {status === 'SUSPENDED' ? <div className="banner warn">{t('suspendWarning')}</div> : null}
        {status === 'SUSPENDED' && user.role === 'COLLECTOR' && activeCount > 0 ? (
          <div className="banner alert">{t('activeJobsWarning', { count: localDigits(activeCount, lang) })}</div>
        ) : null}
        <label className="field">
          {t('statusNote')}
          <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </label>
        {setStatus.error ? <p className="alert" role="alert">{errorMessage(setStatus.error, lang)}</p> : null}
        {setStatus.isSuccess ? <div className="banner ok" role="status">{t('statusSaved')}</div> : null}
        <Button variant="primary" busy={setStatus.isPending} onClick={() => setStatus.mutate({ userId: user.id, status, note: note.trim() || undefined })}>
          ✓ {t('saveStatus')}
        </Button>
      </section>

      <section className="panel">
        <h3>{t('colPickups')}</h3>
        {pickups.isPending ? (
          <Loading />
        ) : pickups.isError ? (
          <ErrorBox error={pickups.error} onRetry={() => void pickups.refetch()} />
        ) : rows.length === 0 ? (
          <Empty text={t('noPickups')} />
        ) : (
          <table>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setOpenPickup(p.id)}>
                  <td>{p.displayNo}</td>
                  <td>{p.area}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="num">{money(p.totalAmount, lang)}</td>
                  <td>{formatWhen(p.updatedAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Drawer>
  )
}
