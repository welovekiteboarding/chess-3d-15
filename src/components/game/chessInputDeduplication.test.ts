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
        },
        {
          square: 'e2',
          moveIndex: 3,
          timestampMs: 1_000 + CHESS_INPUT_DEDUPLICATION_WINDOW_MS,
        },
      ),
    ).toBe(true)
  })

  it('allows the same square after the move index changes', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e4',
          moveIndex: 3,
          timestampMs: 1_000,
        },
        {
          square: 'e4',
          moveIndex: 4,
          timestampMs: 1_000 + 8,
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
        },
        {
          square: 'g1',
          moveIndex: 0,
          timestampMs:
            1_000 + CHESS_INPUT_DEDUPLICATION_WINDOW_MS + 1,
        },
      ),
    ).toBe(false)
  })

  it('allows a repeated selection when timestamps move backwards', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'b1',
          moveIndex: 8,
          timestampMs: 2_000,
        },
        {
          square: 'b1',
          moveIndex: 8,
          timestampMs: 1_950,
        },
      ),
    ).toBe(false)
  })
})
