import { describe, expect, it, vi } from 'vitest'
import { createChessSquareSelectHandlers } from './chessSquareSelectHandlers'

describe('chessSquareSelectHandlers', () => {
  it('dispatches pointer-down square selections with normalized pointer input', () => {
    const onSquareSelect = vi.fn()
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const handlers = createChessSquareSelectHandlers('e4', onSquareSelect)

    handlers.onPointerDown({
      preventDefault,
      timeStamp: 125,
      nativeEvent: {
        pointerType: 'touch',
      },
      stopPropagation,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(onSquareSelect).toHaveBeenCalledWith(
      'e4',
      expect.objectContaining({
        source: 'pointerdown',
        pointerType: 'touch',
        timestampMs: 125,
      }),
    )
  })

  it('ignores mouse pointer-down input so click remains the primary mouse selection path', () => {
    const onSquareSelect = vi.fn()
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const handlers = createChessSquareSelectHandlers('d5', onSquareSelect)

    handlers.onPointerDown({
      nativeEvent: {
        pointerType: 'mouse',
      },
      preventDefault,
      stopPropagation,
      timeStamp: 140,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(onSquareSelect).not.toHaveBeenCalled()
  })

  it('dispatches click square selections as a fallback input source', () => {
    const onSquareSelect = vi.fn()
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const handlers = createChessSquareSelectHandlers('g1', onSquareSelect)

    handlers.onClick({
      preventDefault,
      stopPropagation,
      timeStamp: 240,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(onSquareSelect).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({
        source: 'click',
        pointerType: 'unknown',
        timestampMs: 240,
      }),
    )
  })

  it('keeps the click pointer type when the event surface exposes it', () => {
    const onSquareSelect = vi.fn()
    const handlers = createChessSquareSelectHandlers('b5', onSquareSelect)

    handlers.onClick({
      nativeEvent: {
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 360,
    })

    expect(onSquareSelect).toHaveBeenCalledWith(
      'b5',
      expect.objectContaining({
        source: 'click',
        pointerType: 'mouse',
        timestampMs: 360,
      }),
    )
  })

  it('ignores non-primary pointer and mouse button input', () => {
    const onSquareSelect = vi.fn()
    const handlers = createChessSquareSelectHandlers('c3', onSquareSelect)

    handlers.onPointerDown({
      button: 2,
      isPrimary: true,
      pointerType: 'mouse',
      stopPropagation() {},
      timeStamp: 100,
    })
    handlers.onPointerDown({
      button: 0,
      isPrimary: false,
      pointerType: 'touch',
      stopPropagation() {},
      timeStamp: 120,
    })

    expect(onSquareSelect).not.toHaveBeenCalled()
  })
})
