const KG_RE = /^\d+(\.\d)?$/
const TAKA_RE = /^\d+(\.\d{1,2})?$/

/** The API's WeightsInput lines from the form, or null while something is missing. */
export function teamLines(rows: { code: string; kg: string; quote: string; inspection: boolean }[]) {
  const filled = rows.filter((r) => r.kg.trim() !== '')
  if (filled.length === 0) return null
  const out: { categoryCode: string; kg: number; quotedAmount?: number }[] = []
  for (const r of filled) {
    if (!KG_RE.test(r.kg.trim()) || Number(r.kg) <= 0) return null
    if (r.inspection) {
      if (!TAKA_RE.test(r.quote.trim())) return null
      out.push({ categoryCode: r.code, kg: Number(r.kg), quotedAmount: Number(r.quote) })
    } else out.push({ categoryCode: r.code, kg: Number(r.kg) })
  }
  return out
}

