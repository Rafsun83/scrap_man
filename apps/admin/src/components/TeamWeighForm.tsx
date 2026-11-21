import type { Category, Pickup } from '@bw/shared'
import { useMemo, useState } from 'react'
import { uploadPhoto } from '../api/client'
import { useTeamWeights } from '../api/hooks'
import { useSession } from '../auth/session-context'
import { useT } from '../lib/i18n'
import { categoryName } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { teamLines } from '../lib/weights'
import { Button } from './ui'

/** After TEAM_REWEIGH: the team's weights, with an optional scale photo (POST /pickups/{id}/weights as admin). */
export function TeamWeighForm({ pickup, categories }: { pickup: Pickup; categories: Category[] | undefined }) {
  const { t, lang } = useT()
  const { api } = useSession()
  const save = useTeamWeights()
  const codes = useMemo(() => [...new Set([...pickup.categoryCodes, ...pickup.lines.map((l) => l.categoryCode)])], [pickup])
  const [rows, setRows] = useState(() =>
    codes.map((code) => ({ code, kg: '', quote: '', inspection: categories?.find((c) => c.code === code)?.pricingType === 'ON_INSPECTION' })),
  )
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const lines = teamLines(rows)

  const submit = async () => {
    if (!lines) return
    setError(null)
    setUploading(true)
    try {
      const scalePhotoId = file ? await uploadPhoto(api, `/pickups/${pickup.id}/photos`, { kind: 'SCALE' }, file) : undefined
      save.mutate({ pickupId: pickup.id, body: { lines, ...(scalePhotoId ? { scalePhotoId } : {}) }, key: crypto.randomUUID() }, { onError: setError })
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="team-title">
      <h3 id="team-title">{t('teamWeighTitle')}</h3>
      <p className="muted" style={{ margin: 0 }}>{t('teamWeighHint')}</p>
      {rows.map((r, i) => (
        <div key={r.code} className="row">
          <span style={{ minWidth: 160 }}>{categoryName(categories, r.code, lang)}</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${categoryName(categories, r.code, lang)} ${t('kgLabel')}`}
            value={r.kg}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kg: e.target.value } : x)))}
            style={{ width: 100 }}
          />
          {t('kgLabel')}
          {r.inspection ? (
            <input
              type="text"
              inputMode="decimal"
              aria-label={t('quoteLabel')}
              placeholder={t('quoteLabel')}
              value={r.quote}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)))}
              style={{ width: 130 }}
            />
          ) : null}
        </div>
      ))}
      <label className="field">
        {t('scalePhoto')}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {!lines ? <p className="muted" style={{ margin: 0 }}>{t('weightsIncomplete')}</p> : null}
      {error ? <p className="alert" role="alert">{errorMessage(error, lang)}</p> : null}
      <Button variant="primary" busy={uploading || save.isPending} disabled={!lines} onClick={() => void submit()}>
        ✓ {t('saveWeights')}
      </Button>
    </section>
  )
}
