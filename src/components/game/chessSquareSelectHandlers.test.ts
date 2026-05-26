import { describe, expect, it, vi } from 'vitest'
import { createChessSquareSelectHandlers } from './chessSquareSelectHandlers'

describe('chessSquareSelectHandlers', () => {
  it('dispatches pointer-down square selections with normalized pointer input', () => {
    const onSquareSelect = vi.fn()
    const stopPropagation = vi.fn()
    const handlers = createChessSquareSelectHandlers('e4', onSquareSelect)

    handlers.onPointerDown({
      nativeEvent: {
        pointerType: 'touch',
      },
      stopPropagation,
    })

    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(onSquareSelect).toHaveBeenCalledWith('e4', {
      source: 'pointerdown',
      pointerType: 'touch',
    })
  })

  it('dispatches click square selections as a fallback input source', () => {
    const onSquareSelect = vi.fn()
    const stopPropagation = vi.fn()
    const handlers = createChessSquareSelectHandlers('g1', onSquareSelect)

    handlers.onClick({
      stopPropagation,
    })

    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(onSquareSelect).toHaveBeenCalledWith('g1', {
      source: 'click',
      pointerType: 'unknown',
    })
  })

  it('keeps the click pointer type when the event surface exposes it', () => {
    const onSquareSelect = vi.fn()
    const handlers = createChessSquareSelectHandlers('b5', onSquareSelect)

    handlers.onClick({
      nativeEvent: {
        pointerType: 'mouse',
      },
      stopPropagation() {},
    })

    expect(onSquareSelect).toHaveBeenCalledWith('b5', {
      source: 'click',
      pointerType: 'mouse',
    })
  })
})
