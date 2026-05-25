import { selectAiMove } from '../ai/engine'
import type {
  AiMoveRequest,
  AiMoveSelection,
  AiWorkerRequest,
  AiWorkerResponse,
  RequestAiMoveOptions,
} from '../types/ai'

interface PendingRequest {
  reject: (reason?: unknown) => void
  resolve: (value: AiMoveSelection) => void
}

const pendingRequests = new Map<string, PendingRequest>()
const workerUrl = new URL('./chessAi.worker.ts', import.meta.url)

let requestCounter = 0
let sharedWorker: Worker | null = null

export function requestAiMove(
  request: AiMoveRequest,
  options: RequestAiMoveOptions = {},
): Promise<AiMoveSelection> {
  const shouldUseWorker = options.useWorker ?? canUseWorker()

  if (!shouldUseWorker) {
    return Promise.resolve().then(() => selectAiMove(request))
  }

  try {
    const worker = getSharedWorker()
    const requestId = `ai-${requestCounter + 1}`
    const message: AiWorkerRequest = {
      request,
      requestId,
    }

    requestCounter += 1

    return new Promise<AiMoveSelection>((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject })
      worker.postMessage(message)
    })
  } catch {
    return Promise.resolve().then(() => selectAiMove(request))
  }
}

function canUseWorker(): boolean {
  return typeof Worker !== 'undefined'
}

function getSharedWorker(): Worker {
  if (sharedWorker === null) {
    sharedWorker = new Worker(workerUrl, { type: 'module' })
    sharedWorker.onmessage = handleWorkerMessage
    sharedWorker.onerror = handleWorkerError
  }

  return sharedWorker
}

function handleWorkerMessage(event: MessageEvent<AiWorkerResponse>): void {
  const response = event.data
  const pendingRequest = pendingRequests.get(response.requestId)

  if (pendingRequest === undefined) {
    return
  }

  pendingRequests.delete(response.requestId)

  if (response.error !== null) {
    pendingRequest.reject(new Error(response.error))
    return
  }

  pendingRequest.resolve(response.selection)
}

function handleWorkerError(event: ErrorEvent): void {
  const error = new Error(event.message || 'AI worker execution failed')

  for (const pendingRequest of pendingRequests.values()) {
    pendingRequest.reject(error)
  }

  pendingRequests.clear()
  sharedWorker = null
}
