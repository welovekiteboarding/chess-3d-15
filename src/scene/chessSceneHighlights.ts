import type { ChessInteractionSnapshot } from '../state/chessInteraction'
import type { BoardSquare } from './boardCoordinates'

export type ChessSceneHighlightKind = 'selected' | 'move' | 'capture'

export interface ChessSceneSquareHighlight {
  square: BoardSquare
  kind: ChessSceneHighlightKind
}

export function createChessSceneHighlights(
  interaction: ChessInteractionSnapshot,
): ChessSceneSquareHighlight[] {
  const highlights: ChessSceneSquareHighlight[] =
    interaction.selectedSquare === null
      ? []
      : [
          {
            square: interaction.selectedSquare as BoardSquare,
            kind: 'selected',
          },
        ]

  return highlights.concat(
    interaction.legalTargets.map((target) => ({
      square: target.square as BoardSquare,
      kind: target.kind,
    })),
  )
}
