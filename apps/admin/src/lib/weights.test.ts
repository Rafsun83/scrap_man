import { describe, expect, it } from 'vitest'
import { teamLines } from './weights'

describe('team weights (A4)', () => {
  it('builds the API lines and skips empty rows', () => {
    expect(
      teamLines([
        { code: 'IRON', kg: '9.5', quote: '', inspection: false },
        { code: 'NEWSPAPER', kg: '', quote: '', inspection: false },
        { code: 'ELECTRONICS', kg: '3', quote: '250', inspection: true },
      ]),
    ).toEqual([
      { categoryCode: 'IRON', kg: 9.5 },
      { categoryCode: 'ELECTRONICS', kg: 3, quotedAmount: 250 },
    ])
  })

  it('refuses nothing weighed, kg past 0.1, zero, or a missing quote', () => {
    expect(teamLines([{ code: 'IRON', kg: '', quote: '', inspection: false }])).toBeNull()
    expect(teamLines([{ code: 'IRON', kg: '9.55', quote: '', inspection: false }])).toBeNull()
    expect(teamLines([{ code: 'IRON', kg: '0', quote: '', inspection: false }])).toBeNull()
    expect(teamLines([{ code: 'ELECTRONICS', kg: '3', quote: '', inspection: true }])).toBeNull()
  })
})
