/// <reference lib="webworker" />

import { selectAiMove } from '../ai/engine'
import type {
  AiWorkerErrorResponse,
  AiWorkerRequest,
  AiWorkerSuccessResponse,
} from '../types/ai'

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
  const { request, requestId } = event.data

  try {
    const response: AiWorkerSuccessResponse = {
      error: null,
      requestId,
      selection: selectAiMove(request),
    }

    workerScope.postMessage(response)
  } catch (error) {
    const response: AiWorkerErrorResponse = {
      error: error instanceof Error ? error.message : 'AI worker failed',
      requestId,
      selection: null,
    }

    workerScope.postMessage(response)
  }
}

export {}
