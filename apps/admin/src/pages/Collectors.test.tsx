import type { CollectorProfile } from '@bw/shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithApi } from '../test/render'
import { Applicant } from './Collectors'

const applicant: CollectorProfile = {
  userId: 'c1',
  name: 'Jasim Uddin',
  phone: '+8801708955427',
  nidNumberMasked: '19XX XX 4321',
  nidVerified: false,
  selfieUrl: 'https://storage.test/selfie.jpg',
  workAreas: ['MIRPUR', 'PALLABI'],
  vehicleType: 'VAN',
  hasScale: true,
  verificationStatus: 'PENDING',
  verificationNote: null,
  submittedAt: '2026-11-16T13:33:48.759Z',
  decidedAt: null,
  isOnline: false,
  ratingAvg: null,
  pickups30d: 0,
  releases30d: 0,
}

describe('A3 approval', () => {
  it('approves only after all three checks', async () => {
    const request = vi.fn(async () => undefined) as never
    renderWithApi(<Applicant c={applicant} />, request)
    expect(screen.getByText('Mirpur, Pallabi')).toBeTruthy()
    expect(screen.getByText('19XX XX 4321')).toBeTruthy()
    const approve = screen.getByText(/Approve collector/).closest('button')!
    expect((approve as HTMLButtonElement).disabled).toBe(true)
    for (const label of [/right number of digits/, /Selfie is clear/, /looks real/]) fireEvent.click(screen.getByLabelText(label))
    expect((approve as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(approve)
    await waitFor(() => expect(request).toHaveBeenCalledWith('POST', '/admin/collectors/c1/decision', { body: { decision: 'APPROVED' } }))
  })

  it('rejects only with a note, which is sent to the collector', async () => {
    const request = vi.fn(async () => undefined) as never
    renderWithApi(<Applicant c={applicant} />, request)
    const reject = screen.getByText(/Reject/).closest('button')!
    expect((reject as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Note for the record/), { target: { value: 'Selfie is blurred' } })
    fireEvent.click(reject)
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('POST', '/admin/collectors/c1/decision', { body: { decision: 'REJECTED', note: 'Selfie is blurred' } }),
    )
  })

  it('shows the decision for an application already decided', () => {
    renderWithApi(<Applicant c={{ ...applicant, verificationStatus: 'REJECTED', decidedAt: '2026-11-16T14:00:00Z', verificationNote: 'Blurred' }} />, vi.fn() as never)
    expect(screen.queryByText(/Approve collector/)).toBeNull()
    expect(screen.getByText(/Note: Blurred/)).toBeTruthy()
  })
})
