import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createChessGame, generateLegalMoves } from '../chess/engine'
import type {
  AiMoveWorkerHandle,
  AiMoveWorkerRequest,
  AiMoveWorkerResponse,
} from './aiMove'
import {
  AiMoveWorkerClient,
  createAiMoveWorkerResponse,
  createSeededRandom,
  resolveAiMoveWorkerRequest,
} from './aiMove'

function moveKey(move: { from: string; to: string; promotion: string | null }) {
  return `${move.from}-${move.to}-${move.promotion ?? 'none'}`
}

class FakeWorker implements AiMoveWorkerHandle {
  onmessage: ((event: MessageEvent<AiMoveWorkerResponse>) => unknown) | null =
    null
  onmessageerror: ((event: MessageEvent) => unknown) | null = null
  onerror: ((event: ErrorEvent) => unknown) | null = null

  readonly postMessage = vi.fn()
  readonly terminate = vi.fn()

  emitResponse(response: AiMoveWorkerResponse) {
    this.onmessage?.(new MessageEvent('message', { data: response }))
  }
}

describe('resolveAiMoveWorkerRequest', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    'returns a legal %s move',
    (difficulty) => {
      const game = createChessGame()
      const legalMoveKeys = new Set(generateLegalMoves(game).map(moveKey))
      const selectedMove = resolveAiMoveWorkerRequest({
        requestId: `legal-${difficulty}`,
        game,
        difficulty,
        randomSeed: 7,
      })

      expect(legalMoveKeys.has(moveKey(selectedMove))).toBe(true)
    },
  )

  it('returns the same move for repeated seeded requests', () => {
    const game = createChessGame()
    const request: AiMoveWorkerRequest = {
      requestId: 'repeatable-hard',
      game,
      difficulty: 'hard',
      randomSeed: 991,
    }

    const firstMove = resolveAiMoveWorkerRequest(request)
    const secondMove = resolveAiMoveWorkerRequest(request)

    expect(moveKey(firstMove)).toBe(moveKey(secondMove))
  })
})

describe('createSeededRandom', () => {
  it('produces a stable deterministic sequence for the same seed', () => {
    const first = createSeededRandom(1234)
    const second = createSeededRandom(1234)

    expect([first(), first(), first()]).toEqual([second(), second(), second()])
  })
})

describe('createAiMoveWorkerResponse', () => {
  it('wraps terminal-position failures in an error response', () => {
    const response = createAiMoveWorkerResponse({
      requestId: 'terminal',
      game: createChessGame({
        pieces: [
          { square: 'h8', color: 'black', type: 'king' },
          { square: 'f7', color: 'white', type: 'queen' },
          { square: 'g6', color: 'white', type: 'king' },
        ],
        turn: 'black',
      }),
      difficulty: 'easy',
      randomSeed: 1,
    })

    expect(response).toMatchObject({
      kind: 'error',
      requestId: 'terminal',
    })

    if (response.kind !== 'error') {
      throw new Error('Expected an error response')
    }

    expect(response.message).toMatch(/terminal position/i)
  })
})

describe('AiMoveWorkerClient', () => {
  let worker: FakeWorker

  beforeEach(() => {
    worker = new FakeWorker()
  })

  it('posts a request and resolves when the worker replies', async () => {
    const client = new AiMoveWorkerClient(() => worker)
    const game = createChessGame()
    const pendingMove = client.selectMove({
      game,
      difficulty: 'medium',
      randomSeed: 22,
    })

    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    const [request] = worker.postMessage.mock.calls[0] as [AiMoveWorkerRequest]

    expect(request.difficulty).toBe('medium')
    expect(request.randomSeed).toBe(22)

    const resolvedMove = resolveAiMoveWorkerRequest(request)
    worker.emitResponse({
      kind: 'success',
      requestId: request.requestId,
      move: resolvedMove,
    })

    await expect(pendingMove).resolves.toEqual(resolvedMove)
  })

  it('rejects when the worker replies with an error', async () => {
    const client = new AiMoveWorkerClient(() => worker)
    const pendingMove = client.selectMove({
      game: createChessGame(),
      difficulty: 'easy',
    })

    const [request] = worker.postMessage.mock.calls[0] as [AiMoveWorkerRequest]

    worker.emitResponse({
      kind: 'error',
      requestId: request.requestId,
      message: 'search budget exhausted',
    })

    await expect(pendingMove).rejects.toThrow(/search budget exhausted/i)
  })

  it('terminates the underlying worker when disposed', () => {
    const client = new AiMoveWorkerClient(() => worker)

    client.dispose()

    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})
