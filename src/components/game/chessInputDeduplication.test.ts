import { describe, expect, it } from 'vitest'
import {
  CHESS_INPUT_DEDUPLICATION_WINDOW_MS,
  resolveChessSquareSelectPointerType,
  resolveChessHandledSquareSelectTimestampMs,
  shouldIgnoreDuplicateSquareSelect,
} from '../../input/chessInputDeduplication'

describe('chessInputDeduplication', () => {
  it('ignores an immediate repeated selection for the same square', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e2',
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e2',
          timestampMs: 1_000 + CHESS_INPUT_DEDUPLICATION_WINDOW_MS,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(true)
  })

  it('ignores a same-square click follow-up even after the move advances', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e4',
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e4',
          timestampMs: 1_000 + 8,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(true)
  })

  it('ignores a different-square click follow-up after touch pointer-down already handled the tap', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e4',
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e5',
          timestampMs: 1_000 + 8,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(true)
  })

  it('allows a repeated selection after the deduplication window expires', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'g1',
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'g1',
          timestampMs:
            1_000 + CHESS_INPUT_DEDUPLICATION_WINDOW_MS + 1,
          pointerType: 'unknown',
          source: 'click',
        },
      ),
    ).toBe(false)
  })

  it('ignores delayed tap follow-up delivery for the same square', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e2',
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e2',
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
          timestampMs: 2_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'b1',
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
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e2',
          timestampMs: 1_120,
          pointerType: 'touch',
          source: 'pointerdown',
        },
      ),
    ).toBe(false)
  })

  it('allows a mouse click after a touch pointer-down changed the active square on a hybrid device', () => {
    expect(
      shouldIgnoreDuplicateSquareSelect(
        {
          square: 'e4',
          timestampMs: 1_000,
          pointerType: 'touch',
          source: 'pointerdown',
        },
        {
          square: 'e5',
          timestampMs: 1_000 + 8,
          pointerType: 'mouse',
          source: 'click',
        },
      ),
    ).toBe(false)
  })

  it('infers touch input from touch metadata when pointerType is unavailable', () => {
    expect(
      resolveChessSquareSelectPointerType({
        nativeEvent: {
          changedTouches: {
            length: 1,
          },
        },
      }),
    ).toBe('touch')

    expect(
      resolveChessSquareSelectPointerType({
        nativeEvent: {
          sourceCapabilities: {
            firesTouchEvents: true,
          },
        },
      }),
    ).toBe('touch')
  })

  it('normalizes relative event timestamps onto the fallback clock for follow-up deduplication', () => {
    expect(
      resolveChessHandledSquareSelectTimestampMs(120, 1_700_000_000_000, null),
    ).toEqual({
      timestampMs: 1_700_000_000_000,
      relativeEventTimestampOffsetMs: 1_699_999_999_880,
    })

    expect(
      resolveChessHandledSquareSelectTimestampMs(
        240,
        1_700_000_000_120,
        1_699_999_999_880,
      ),
    ).toEqual({
      timestampMs: 1_700_000_000_120,
      relativeEventTimestampOffsetMs: 1_699_999_999_880,
    })
  })

  it('keeps untimed follow-up inputs on the fallback clock once a relative origin was learned', () => {
    expect(
      resolveChessHandledSquareSelectTimestampMs(
        undefined,
        1_700_000_000_240,
        1_699_999_999_880,
      ),
    ).toEqual({
      timestampMs: 1_700_000_000_240,
      relativeEventTimestampOffsetMs: 1_699_999_999_880,
    })
  })
})
