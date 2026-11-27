import { useEffect } from 'react'

/**
 * Fades sections in as they scroll into view. It turns itself on only where the browser can watch scrolling and
 * the visitor has not asked for less motion; otherwise (and in tests) every `.reveal` element simply shows.
 */
export function useReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    root.classList.add('reveal-ready')
    return () => {
      io.disconnect()
      root.classList.remove('reveal-ready')
    }
  }, [])
}
