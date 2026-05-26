import { Fragment } from 'react'
import { createChessSquareSelectHandlers } from '../components/game/chessSquareSelectHandlers'
import type { ChessSquareSelectInput } from '../components/game/chessInputDeduplication'
import {
  BOARD_SURFACE_Y,
  BOARD_FILES,
  BOARD_RANKS,
  getSquareColor,
  squareToScenePosition,
  type BoardSquare,
} from './boardCoordinates'
import type { ChessSceneSquareHighlight } from './chessSceneHighlights'

const LIGHT_SQUARE_COLOR = '#d9c6a3'
const DARK_SQUARE_COLOR = '#5b3926'
const FRAME_COLOR = '#2b160f'
const FRAME_GLOW_COLOR = '#7c5332'
const FLOOR_COLOR = '#10211f'
const SELECTED_HIGHLIGHT_COLOR = '#d9b15f'
const MOVE_HIGHLIGHT_COLOR = '#82c59a'
const CAPTURE_HIGHLIGHT_COLOR = '#cb6a56'

const SQUARE_HEIGHT = BOARD_SURFACE_Y

interface ChessBoardModelProps {
  highlights?: ReadonlyArray<ChessSceneSquareHighlight>
  onSquareSelect?: (square: BoardSquare, input?: ChessSquareSelectInput) => void
}

export function ChessBoardModel({
  highlights = [],
  onSquareSelect,
}: ChessBoardModelProps) {
  const highlightBySquare = new Map(
    highlights.map((highlight) => [highlight.square, highlight.kind]),
  )

  return (
    <group>
      <mesh
        position={[0, -0.52, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[8.8, 80]} />
        <meshStandardMaterial
          color={FLOOR_COLOR}
          metalness={0.08}
          roughness={0.96}
        />
      </mesh>

      <mesh castShadow position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[9.5, 0.42, 9.5]} />
        <meshStandardMaterial
          color={FRAME_COLOR}
          metalness={0.16}
          roughness={0.58}
        />
      </mesh>

      <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[8.95, 0.15, 8.95]} />
        <meshStandardMaterial
          color={FRAME_GLOW_COLOR}
          metalness={0.12}
          roughness={0.5}
        />
      </mesh>

      {BOARD_RANKS.flatMap((rank) =>
        BOARD_FILES.map((file) => {
          const square = `${file}${rank}` as BoardSquare
          const color =
            getSquareColor(square) === 'light'
              ? LIGHT_SQUARE_COLOR
              : DARK_SQUARE_COLOR
          const [x, y, z] = squareToScenePosition(square, SQUARE_HEIGHT / 2)
          const highlight = highlightBySquare.get(square)
          const squareSelectHandlers = createChessSquareSelectHandlers(
            square,
            onSquareSelect,
          )

          return (
            <Fragment key={square}>
              <mesh
                castShadow
                {...squareSelectHandlers}
                position={[x, y, z]}
                receiveShadow
              >
                <boxGeometry args={[1, SQUARE_HEIGHT, 1]} />
                <meshStandardMaterial
                  color={color}
                  metalness={0.1}
                  roughness={0.72}
                />
              </mesh>
              {highlight === 'selected' ? (
                <mesh
                  {...squareSelectHandlers}
                  position={[x, BOARD_SURFACE_Y + 0.012, z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <ringGeometry args={[0.26, 0.42, 48]} />
                  <meshStandardMaterial
                    color={SELECTED_HIGHLIGHT_COLOR}
                    metalness={0.24}
                    opacity={0.95}
                    roughness={0.32}
                    transparent
                  />
                </mesh>
              ) : null}
              {highlight === 'move' ? (
                <mesh
                  {...squareSelectHandlers}
                  position={[x, BOARD_SURFACE_Y + 0.014, z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <circleGeometry args={[0.18, 40]} />
                  <meshStandardMaterial
                    color={MOVE_HIGHLIGHT_COLOR}
                    opacity={0.85}
                    roughness={0.36}
                    transparent
                  />
                </mesh>
              ) : null}
              {highlight === 'capture' ? (
                <mesh
                  {...squareSelectHandlers}
                  position={[x, BOARD_SURFACE_Y + 0.014, z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <ringGeometry args={[0.22, 0.4, 48]} />
                  <meshStandardMaterial
                    color={CAPTURE_HIGHLIGHT_COLOR}
                    metalness={0.22}
                    opacity={0.92}
                    roughness={0.34}
                    transparent
                  />
                </mesh>
              ) : null}
            </Fragment>
          )
        }),
      )}
    </group>
  )
}
