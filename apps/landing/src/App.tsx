import { useT } from './lib/i18n'
import { useRateBoard } from './hooks/useRateBoard'
import { useReveal } from './hooks/useReveal'
import { Collectors } from './sections/Collectors'
import { Faq } from './sections/Faq'
import { Footer } from './sections/Footer'
import { Green } from './sections/Green'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { HowItWorks } from './sections/HowItWorks'
import { Items } from './sections/Items'
import { Promises } from './sections/Promises'
import { Rates } from './sections/Rates'
import { Safety } from './sections/Safety'
import type { RateBoard } from './lib/rates'

/** The public landing page: one scrolling page, sections in the order a first-time visitor needs them. */
export function App({ loadRates }: { loadRates?: () => Promise<RateBoard> }) {
  const { t } = useT()
  const { state, retry } = useRateBoard(loadRates)
  useReveal()
  return (
    <>
      <a className="skip-link" href="#main">
        {t('skipToContent')}
      </a>
      <div id="top" />
      <Header />
      <main id="main">
        <Hero rates={state} />
        <Promises />
        <HowItWorks />
        <Rates rates={state} onRetry={retry} />
        <Items />
        <Green />
        <Safety />
        <Collectors />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
