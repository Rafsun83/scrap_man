import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { keys } from '../api/hooks'
import { useSession } from '../auth/session-context'
import { handleAdminEvent, LiveContext } from '../lib/realtime'

/** One Socket.IO connection while signed in; everything refetches when it (re)connects. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { status, accessToken, api } = useSession()
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (status !== 'signedIn') return
    const socket: Socket = io({ path: '/socket.io', transports: ['websocket'], auth: (cb) => cb({ token: accessToken() }) })
    let refreshing = false
    socket.on('ready', () => {
      setLive(true)
      void qc.invalidateQueries({ queryKey: keys.all })
    })
    socket.on('disconnect', () => setLive(false))
    socket.on('unauthorized', async () => {
      if (refreshing) return
      refreshing = true
      if (await api.refresh()) socket.connect()
      refreshing = false
    })
    socket.onAny((event: string, payload: unknown) => handleAdminEvent(qc, event, payload))
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      setLive(false)
    }
  }, [status, accessToken, api, qc])

  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>
}
