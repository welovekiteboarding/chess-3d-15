import { selectAiMove } from '../domain/ai'
import type { AiDifficulty } from '../types/ai'
import type { ChessGameState, LegalMove } from '../types/chess'

const AI_MOVE_WORKER_PREFIX = 'ai-move'
const AI_WORKER_DISPOSED_MESSAGE = 'AI worker was disposed'
const AI_WORKER_MESSAGE_ERROR = 'AI worker sent an unreadable response'
const AI_WORKER_RUNTIME_ERROR = 'AI worker failed to evaluate a move'
const RANDOM_MODULUS = 4_294_967_296
const RANDOM_STEP = 0x6d2b79f5

export interface AiMoveWorkerSelectionRequest {
  game: ChessGameState
  difficulty: AiDifficulty
  randomSeed?: number
}

export interface AiMoveWorkerRequest extends AiMoveWorkerSelectionRequest {
  requestId: string
}

export interface AiMoveWorkerSuccessResponse {
  kind: 'success'
  requestId: string
  move: LegalMove
}

export interface AiMoveWorkerErrorResponse {
  kind: 'error'
  requestId: string
  message: string
}

export type AiMoveWorkerResponse =
  | AiMoveWorkerSuccessResponse
  | AiMoveWorkerErrorResponse

export interface AiMoveWorkerHandle {
  onerror: ((event: ErrorEvent) => unknown) | null
  onmessage: ((event: MessageEvent<AiMoveWorkerResponse>) => unknown) | null
  onmessageerror: ((event: MessageEvent) => unknown) | null
  postMessage: (message: AiMoveWorkerRequest) => void
  terminate: () => void
}

export type AiMoveWorkerFactory = () => AiMoveWorkerHandle

interface PendingWorkerRequest {
  reject: (reason: Error) => void
  resolve: (move: LegalMove) => void
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + RANDOM_STEP) >>> 0
    let scrambled = Math.imul(state ^ (state >>> 15), state | 1)

    scrambled ^= scrambled + Math.imul(scrambled ^ (scrambled >>> 7), scrambled | 61)

    return ((scrambled ^ (scrambled >>> 14)) >>> 0) / RANDOM_MODULUS
  }
}

export function resolveAiMoveWorkerRequest(
  request: AiMoveWorkerRequest,
): LegalMove {
  const random =
    request.randomSeed === undefined
      ? undefined
      : createSeededRandom(request.randomSeed)

  return selectAiMove({
    game: request.game,
    difficulty: request.difficulty,
    ...(random === undefined ? {} : { random }),
  })
}

export function createAiMoveWorkerResponse(
  request: AiMoveWorkerRequest,
): AiMoveWorkerResponse {
  try {
    return {
      kind: 'success',
      requestId: request.requestId,
      move: resolveAiMoveWorkerRequest(request),
    }
  } catch (error) {
    return {
      kind: 'error',
      requestId: request.requestId,
      message: toWorkerErrorMessage(error),
    }
  }
}

export function createAiMoveWorker(): AiMoveWorkerHandle {
  return new Worker(new URL('./aiMove.worker.ts', import.meta.url), {
    type: 'module',
  }) as AiMoveWorkerHandle
}

export class AiMoveWorkerClient {
  private readonly pendingRequests = new Map<string, PendingWorkerRequest>()
  private nextRequestId = 0
  private readonly worker: AiMoveWorkerHandle

  constructor(workerFactory: AiMoveWorkerFactory = createAiMoveWorker) {
    this.worker = workerFactory()
    this.worker.onmessage = (event) => {
      this.resolvePendingRequest(event.data)
    }
    this.worker.onerror = (event) => {
      this.rejectAllPendingRequests(
        new Error(event.message || AI_WORKER_RUNTIME_ERROR),
      )
    }
    this.worker.onmessageerror = () => {
      this.rejectAllPendingRequests(new Error(AI_WORKER_MESSAGE_ERROR))
    }
  }

  selectMove(request: AiMoveWorkerSelectionRequest): Promise<LegalMove> {
    const requestId = `${AI_MOVE_WORKER_PREFIX}-${this.nextRequestId}`

    this.nextRequestId += 1

    return new Promise<LegalMove>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject })
      this.worker.postMessage({
        requestId,
        ...request,
      })
    })
  }

  dispose() {
    this.rejectAllPendingRequests(new Error(AI_WORKER_DISPOSED_MESSAGE))
    this.worker.terminate()
  }

  private resolvePendingRequest(response: AiMoveWorkerResponse) {
    const pendingRequest = this.pendingRequests.get(response.requestId)

    if (pendingRequest === undefined) {
      return
    }

    this.pendingRequests.delete(response.requestId)

    if (response.kind === 'success') {
      pendingRequest.resolve(response.move)
      return
    }

    pendingRequest.reject(new Error(response.message))
  }

  private rejectAllPendingRequests(error: Error) {
    const pendingRequests = [...this.pendingRequests.values()]

    this.pendingRequests.clear()

    for (const pendingRequest of pendingRequests) {
      pendingRequest.reject(error)
    }
  }
}

function toWorkerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return AI_WORKER_RUNTIME_ERROR
}
