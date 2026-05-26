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

  it('ignores mouse click selection after a drag gesture crosses to another square', () => {
    const onSquareSelect = vi.fn()
    const sourceHandlers = createChessSquareSelectHandlers('e4', onSquareSelect)
    const targetHandlers = createChessSquareSelectHandlers('f4', onSquareSelect)

    sourceHandlers.onPointerDown({
      clientX: 120,
      clientY: 84,
      nativeEvent: {
        clientX: 120,
        clientY: 84,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 100,
    })
    targetHandlers.onClick({
      clientX: 138,
      clientY: 84,
      stopPropagation() {},
      timeStamp: 130,
    })

    expect(onSquareSelect).not.toHaveBeenCalled()
  })

  it('ignores mouse click selection after a long drag once the pointer already crossed the drag tolerance', () => {
    const onSquareSelect = vi.fn()
    const sourceHandlers = createChessSquareSelectHandlers('e4', onSquareSelect)
    const targetHandlers = createChessSquareSelectHandlers('f4', onSquareSelect)

    sourceHandlers.onPointerDown({
      clientX: 120,
      clientY: 84,
      nativeEvent: {
        clientX: 120,
        clientY: 84,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 100,
    })
    targetHandlers.onPointerMove({
      clientX: 142,
      clientY: 84,
      nativeEvent: {
        clientX: 142,
        clientY: 84,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 760,
    })
    targetHandlers.onClick({
      clientX: 142,
      clientY: 84,
      nativeEvent: {
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 820,
    })

    expect(onSquareSelect).not.toHaveBeenCalled()
  })

  it('ignores mouse click selection after a drag returns near its starting point', () => {
    const onSquareSelect = vi.fn()
    const handlers = createChessSquareSelectHandlers('f4', onSquareSelect)

    handlers.onPointerDown({
      clientX: 220,
      clientY: 144,
      nativeEvent: {
        clientX: 220,
        clientY: 144,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 200,
    })
    handlers.onPointerMove({
      clientX: 240,
      clientY: 144,
      nativeEvent: {
        clientX: 240,
        clientY: 144,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 216,
    })
    handlers.onClick({
      clientX: 223,
      clientY: 147,
      nativeEvent: {
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 232,
    })

    expect(onSquareSelect).not.toHaveBeenCalled()
  })

  it('keeps mouse click selection when the pointer stays within the click tolerance', () => {
    const onSquareSelect = vi.fn()
    const handlers = createChessSquareSelectHandlers('f4', onSquareSelect)

    handlers.onPointerDown({
      clientX: 220,
      clientY: 144,
      nativeEvent: {
        clientX: 220,
        clientY: 144,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 200,
    })
    handlers.onClick({
      clientX: 223,
      clientY: 147,
      nativeEvent: {
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 224,
    })

    expect(onSquareSelect).toHaveBeenCalledWith(
      'f4',
      expect.objectContaining({
        source: 'click',
        pointerType: 'mouse',
        timestampMs: 224,
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

  it('infers a mouse click pointer type from the preceding pointer-down even when timestamps are unavailable', () => {
    const onSquareSelect = vi.fn()
    const handlers = createChessSquareSelectHandlers('b5', onSquareSelect)

    handlers.onPointerDown({
      clientX: 88,
      clientY: 132,
      nativeEvent: {
        clientX: 88,
        clientY: 132,
        pointerType: 'mouse',
      },
      stopPropagation() {},
    })
    handlers.onClick({
      clientX: 90,
      clientY: 133,
      stopPropagation() {},
    })

    expect(onSquareSelect).toHaveBeenCalledWith(
      'b5',
      expect.objectContaining({
        source: 'click',
        pointerType: 'mouse',
      }),
    )
  })

  it('infers a mouse click pointer type from the preceding pointer-down when click metadata omits it', () => {
    const onSquareSelect = vi.fn()
    const handlers = createChessSquareSelectHandlers('b5', onSquareSelect)

    handlers.onPointerDown({
      clientX: 88,
      clientY: 132,
      nativeEvent: {
        clientX: 88,
        clientY: 132,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 360,
    })
    handlers.onClick({
      clientX: 90,
      clientY: 133,
      stopPropagation() {},
      timeStamp: 384,
    })

    expect(onSquareSelect).toHaveBeenCalledWith(
      'b5',
      expect.objectContaining({
        source: 'click',
        pointerType: 'mouse',
        timestampMs: 384,
      }),
    )
  })

  it('ignores mouse click selection after a drag gesture when timestamps are unavailable', () => {
    const onSquareSelect = vi.fn()
    const sourceHandlers = createChessSquareSelectHandlers('e4', onSquareSelect)
    const targetHandlers = createChessSquareSelectHandlers('f4', onSquareSelect)

    sourceHandlers.onPointerDown({
      clientX: 120,
      clientY: 84,
      nativeEvent: {
        clientX: 120,
        clientY: 84,
        pointerType: 'mouse',
      },
      stopPropagation() {},
    })
    targetHandlers.onPointerMove({
      clientX: 142,
      clientY: 84,
      nativeEvent: {
        clientX: 142,
        clientY: 84,
        pointerType: 'mouse',
      },
      stopPropagation() {},
    })
    targetHandlers.onClick({
      clientX: 142,
      clientY: 84,
      nativeEvent: {
        pointerType: 'mouse',
      },
      stopPropagation() {},
    })

    expect(onSquareSelect).not.toHaveBeenCalled()
  })

  it('ignores a slow mouse drag across squares even when pointer-move tracking misses it', () => {
    const onSquareSelect = vi.fn()
    const sourceHandlers = createChessSquareSelectHandlers('e4', onSquareSelect)
    const targetHandlers = createChessSquareSelectHandlers('f4', onSquareSelect)

    sourceHandlers.onPointerDown({
      clientX: 120,
      clientY: 84,
      nativeEvent: {
        clientX: 120,
        clientY: 84,
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 100,
    })
    targetHandlers.onClick({
      clientX: 142,
      clientY: 84,
      nativeEvent: {
        pointerType: 'mouse',
      },
      stopPropagation() {},
      timeStamp: 760,
    })

    expect(onSquareSelect).not.toHaveBeenCalled()
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
