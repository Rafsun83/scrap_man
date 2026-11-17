import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../auth/SessionProvider'
import { useSession } from '../auth/session-context'
import { LangProvider } from '../components/LangProvider'
import { SignIn } from './SignIn'

function Probe() {
  const { status, user } = useSession()
  return status === 'signedIn' ? <p>signed in as {user?.role}</p> : <SignIn />
}

const res = (status: number, body?: unknown) =>
  ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body }) as Response

function setup(role: 'ADMIN' | 'HOUSEHOLD') {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
    const u = String(url)
    if (u.endsWith('/auth/otp/request')) return res(204)
    if (u.endsWith('/auth/otp/verify')) return res(200, { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u1', role, phone: '+8801700000000' } })
    if (u.endsWith('/auth/logout')) return res(204)
    return res(404)
  })
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  render(
    <LangProvider initial="en">
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </LangProvider>,
  )
  return fetchMock
}

describe('admin sign-in', () => {
  it('checks the number, sends the code, and signs an admin in', async () => {
    const fetchMock = setup('ADMIN')
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '12345' } })
    fireEvent.click(screen.getByText(/Send code/))
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a Bangladeshi mobile number')

    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '01700000000' } })
    fireEvent.click(screen.getByText(/Send code/))
    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByText(/Sign in$/))
    expect(await screen.findByText('signed in as ADMIN')).toBeTruthy()
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ phone: '+8801700000000' })
    expect(localStorage.getItem('bw.admin.refresh')).toBe('r')
  })

  it('refuses a household or collector number and signs it out again', async () => {
    const fetchMock = setup('HOUSEHOLD')
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '01711111111' } })
    fireEvent.click(screen.getByText(/Send code/))
    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByText(/Sign in$/))
    expect((await screen.findByRole('alert')).textContent).toContain('This number is not an admin account.')
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/auth/logout'))).toBe(true))
    expect(localStorage.getItem('bw.admin.refresh')).toBeNull()
  })
})
