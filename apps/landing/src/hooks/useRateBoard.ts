import { useCallback, useEffect, useState } from 'react'
import { fetchRateBoard } from '../api/rates'
import { hasPublishedRates, type RateBoard } from '../lib/rates'

export type RateBoardState =
  | { status: 'loading' }
  | { status: 'ready'; board: RateBoard }
  | { status: 'empty'; board: RateBoard }
  | { status: 'error' }

/** Loads today's rates once; `retry` loads them again after an error. */
export function useRateBoard(load: () => Promise<RateBoard> = fetchRateBoard) {
  const [state, setState] = useState<RateBoardState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    load().then(
      (board) => live && setState({ status: hasPublishedRates(board) ? 'ready' : 'empty', board }),
      () => live && setState({ status: 'error' }),
    )
    return () => {
      live = false
    }
  }, [load, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
