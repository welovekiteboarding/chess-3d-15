import { describe, expect, it } from 'vitest'
import {
  CHESS_INPUT_DEDUPLICATION_WINDOW_MS,
  shouldIgnoreDuplicateSquareSelect,
} from './chessInputDeduplication'

describe('chessInputDeduplication', () => {
  it('ignores an immediate repeated selection for the same square and move index', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e2',
          moveIndex: 3,
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e2',
          moveIndex: 3,
          timestampMs: 1_000 + CHESS_INPUT_DEDUPLICATION_WINDOW_MS,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(true)
  })

  it('ignores a same-square click follow-up even after the move index advances', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e4',
          moveIndex: 3,
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e4',
          moveIndex: 4,
          timestampMs: 1_000 + 8,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(true)
  })

  it('allows a different square after the move index changes', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e4',
          moveIndex: 3,
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e5',
          moveIndex: 4,
          timestampMs: 1_000 + 8,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(false)
  })

  it('allows a repeated selection after the deduplication window expires', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'g1',
          moveIndex: 0,
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'g1',
          moveIndex: 0,
          timestampMs:
            1_000 + CHESS_INPUT_DEDUPLICATION_WINDOW_MS + 1,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(false)
  })

  it('ignores delayed tap follow-up delivery for the same square and move index', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e2',
          moveIndex: 5,
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e2',
          moveIndex: 5,
          timestampMs: 1_320,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(true)
  })

  it('allows a repeated selection when timestamps move backwards', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'b1',
          moveIndex: 8,
          timestampMs: 2_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'b1',
          moveIndex: 8,
          timestampMs: 1_950,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(false)
  })

  it('allows repeated touch pointer-down interactions on the same square', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e2',
          moveIndex: 3,
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e2',
          moveIndex: 3,
          timestampMs: 1_120,
          pointerType: 'touch',
          source: 'pointerdown',
        },
      ),
    ).toBe(false)
  })
})
