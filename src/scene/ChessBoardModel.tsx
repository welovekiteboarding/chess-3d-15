import { Fragment } from 'react'
import {
  BOARD_SURFACE_Y,
  BOARD_FILES,
  BOARD_RANKS,
  getSquareColor,
  squareToScenePosition,
  type BoardSquare,
} from './boardCoordinates'

const LIGHT_SQUARE_COLOR = '#d9c6a3'
const DARK_SQUARE_COLOR = '#5b3926'
const FRAME_COLOR = '#2b160f'
const FRAME_GLOW_COLOR = '#7c5332'
const FLOOR_COLOR = '#10211f'

const SQUARE_HEIGHT = BOARD_SURFACE_Y

export function ChessBoardModel() {
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

          return (
            <Fragment key={square}>
              <mesh castShadow position={[x, y, z]} receiveShadow>
                <boxGeometry args={[1, SQUARE_HEIGHT, 1]} />
                <meshStandardMaterial
                  color={color}
                  metalness={0.1}
                  roughness={0.72}
                />
              </mesh>
            </Fragment>
          )
        }),
      )}
    </group>
  )
}
