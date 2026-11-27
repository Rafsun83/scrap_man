import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { LangProvider } from './components/LangProvider'
import type { RateBoard } from './lib/rates'

const board: RateBoard = {
  effectiveDate: '2026-11-20',
  rows: [
    { code: 'IRON', nameBn: 'লোহা', nameEn: 'Iron', ratePerKg: 50, onInspection: false, changeFromYesterday: 2 },
    { code: 'CARTON', nameBn: 'কার্টন', nameEn: 'Carton', ratePerKg: 18, onInspection: false, changeFromYesterday: 0 },
    { code: 'ELECTRONICS', nameBn: 'ইলেকট্রনিক্স', nameEn: 'Electronics', ratePerKg: null, onInspection: true, changeFromYesterday: null },
  ],
}

function renderApp(load: () => Promise<RateBoard>, lang: 'bn' | 'en' = 'bn') {
  return render(
    <LangProvider initial={lang}>
      <App loadRates={load} />
    </LangProvider>,
  )
}

describe('landing page', () => {
  it('shows today’s rates in Bangla first', async () => {
    const load = vi.fn(async () => board)
    renderApp(load)
    expect(screen.getByRole('heading', { level: 1, name: 'বাসায় বসেই ভাঙ্গারি বিক্রি করুন' })).toBeTruthy()
    // Hero card and full board both list the rate.
    expect((await screen.findAllByText('৳৫০')).length).toBe(2)
    expect(screen.getByText('গতকালের চেয়ে ৳২ বেশি')).toBeTruthy()
    expect(screen.getByText('গতকালের মতো')).toBeTruthy()
    expect(screen.getByText('দেখে দাম')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('explains why selling scrap helps the environment', () => {
    renderApp(async () => board, 'en')
    expect(screen.getByRole('heading', { level: 2, name: 'Your scrap is not rubbish. It gets used again.' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Plastic: clear drains and rivers' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Environment' }).getAttribute('href')).toBe('#green')
  })

  it('switches to English with the toggle', async () => {
    renderApp(async () => board)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Sell your scrap without leaving home' })).toBeTruthy()
    expect(await screen.findByText('৳2 more than yesterday')).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
  })

  it('says when no rates are published yet', async () => {
    renderApp(async () => ({ effectiveDate: null, rows: board.rows.map((r) => ({ ...r, ratePerKg: null })) }), 'en')
    expect((await screen.findAllByText("Today's rates are not published yet. New rates go up every morning.")).length).toBe(2)
  })

  it('offers a retry when the rates fail to load', async () => {
    const load = vi.fn<() => Promise<RateBoard>>().mockRejectedValueOnce(new Error('down')).mockResolvedValue(board)
    renderApp(load, 'en')
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('৳50')).length).toBe(2)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
