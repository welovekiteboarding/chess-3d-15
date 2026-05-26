/// <reference lib="webworker" />

import {
  createAiMoveWorkerResponse,
  type AiMoveWorkerRequest,
} from './aiMove'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (event: MessageEvent<AiMoveWorkerRequest>) => {
  self.postMessage(createAiMoveWorkerResponse(event.data))
}

export {}
