import type { ReactNode } from 'react'

/** Kicker, title and optional lead for a page section. `id` labels the section for screen readers. */
export function SectionHeading({ id, kicker, title, lead, tone = 'light' }: {
  id: string
  kicker: string
  title: string
  lead?: ReactNode
  tone?: 'light' | 'dark'
}) {
  return (
    <div className={`section-heading ${tone}`}>
      <p className="kicker">{kicker}</p>
      <h2 id={id}>{title}</h2>
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
  )
}
