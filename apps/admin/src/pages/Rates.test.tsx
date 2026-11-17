import type { AdminRates } from '@bw/shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithApi } from '../test/render'
import { RatesPage } from './Rates'

const rates: AdminRates = {
  date: '2026-11-17',
  publishedAt: null,
  publishedByName: null,
  rates: [
    { categoryCode: 'IRON', pricingType: 'PER_KG', rate: null, previousRate: 50, previousDate: '2026-11-16' },
    { categoryCode: 'NEWSPAPER', pricingType: 'PER_KG', rate: null, previousRate: 30, previousDate: '2026-11-16' },
    { categoryCode: 'ELECTRONICS', pricingType: 'ON_INSPECTION', rate: null, previousRate: null, previousDate: null },
  ],
}

describe('A2 daily rates', () => {
  it('copies the previous rates, warns about unpublished changes, and publishes only the changes', async () => {
    const request = vi.fn(async (method: string, path: string) => {
      if (path === '/categories') return [{ code: 'IRON', nameEn: 'Iron', nameBn: 'লোহা', pricingType: 'PER_KG' }]
      if (method === 'GET') return rates
      return undefined
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithApi(<RatesPage />, request as never)
    expect(await screen.findByText('Collector quotes at the door')).toBeTruthy()
    expect(screen.queryByText(/unpublished changes/)).toBeNull()

    fireEvent.click(screen.getByText(/Copy previous rates/))
    expect((screen.getByTestId('rate-IRON') as HTMLInputElement).value).toBe('50')
    expect(screen.getByText(/You have unpublished changes/)).toBeTruthy()

    fireEvent.change(screen.getByTestId('rate-IRON'), { target: { value: '1.234' } })
    expect(screen.getByText(/Enter a rate above 0/)).toBeTruthy()
    expect((screen.getByText(/Publish rates/).closest('button') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByTestId('rate-IRON'), { target: { value: '52' } })
    expect(screen.getByText('+৳2')).toBeTruthy()
    fireEvent.click(screen.getByText(/Publish rates/))
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('PUT', '/admin/rates', {
        body: {
          effectiveDate: expect.any(String),
          rates: [
            { categoryCode: 'IRON', ratePerKg: 52 },
            { categoryCode: 'NEWSPAPER', ratePerKg: 30 },
          ],
        },
      }),
    )
  })
})
