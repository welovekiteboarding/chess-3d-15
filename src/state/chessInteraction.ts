import { generateLegalMoves, getPieceAtSquare } from '../chess/engine'
import type { ChessGameState, ChessSquare, LegalMove } from '../types/chess'

export type ChessInteractionTargetKind = 'move' | 'capture'

export interface ChessInteractionState {
  selectedSquare: ChessSquare | null
}

export interface ChessInteractionTarget {
  square: ChessSquare
  kind: ChessInteractionTargetKind
}

export interface ChessInteractionSnapshot extends ChessInteractionState {
  legalTargets: ReadonlyArray<ChessInteractionTarget>
}

export function createChessInteractionState(): ChessInteractionState {
  return {
    selectedSquare: null,
  }
}

export function deriveChessInteractionSnapshot(
  game: ChessGameState,
  state: ChessInteractionState,
): ChessInteractionSnapshot {
  return {
    selectedSquare: state.selectedSquare,
    legalTargets:
      state.selectedSquare === null
        ? []
        : collapseLegalTargets(generateLegalMoves(game, state.selectedSquare)),
  }
}

export function selectChessInteractionSquare(
  game: ChessGameState,
  state: ChessInteractionState,
  square: string,
): ChessInteractionState {
  const piece = getPieceAtSquare(game, square)

  if (piece !== null && piece.color === game.turn) {
    return {
      selectedSquare:
        state.selectedSquare === square ? null : (square as ChessSquare),
    }
  }

  if (state.selectedSquare === null) {
    return state
  }

  const activeTargets = collapseLegalTargets(
    generateLegalMoves(game, state.selectedSquare),
  )
  const isKnownTarget = activeTargets.some((target) => target.square === square)

  return isKnownTarget ? state : createChessInteractionState()
}

export function syncChessInteractionState(
  game: ChessGameState,
  state: ChessInteractionState,
): ChessInteractionState {
  if (state.selectedSquare === null) {
    return state
  }

  const piece = getPieceAtSquare(game, state.selectedSquare)

  if (piece === null || piece.color !== game.turn) {
    return createChessInteractionState()
  }

  return state
}

function collapseLegalTargets(
  legalMoves: ReadonlyArray<LegalMove>,
): ChessInteractionTarget[] {
  const targets = new Map<ChessSquare, ChessInteractionTarget>()

  for (const move of legalMoves) {
    const existingTarget = targets.get(move.to)

    if (existingTarget === undefined) {
      targets.set(move.to, {
        square: move.to,
        kind: move.isCapture ? 'capture' : 'move',
      })
      continue
    }

    if (move.isCapture && existingTarget.kind !== 'capture') {
      targets.set(move.to, {
        square: move.to,
        kind: 'capture',
      })
    }
  }

  return [...targets.values()]
}
