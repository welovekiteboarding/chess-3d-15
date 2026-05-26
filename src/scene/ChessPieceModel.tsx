import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { ChessAnimatedPieceMotion } from '../components/game/chessMoveAnimations'
import { CHESS_MOVE_ANIMATION_DURATION_MS } from '../components/game/chessMoveAnimations'
import type {
  ChessScenePiece,
  ChessSquare,
  PieceColor,
  PieceType,
} from '../types/chess'
import { BOARD_SURFACE_Y, squareToScenePosition } from './boardCoordinates'

const ACCENT_MATERIAL = {
  color: '#ba8a51',
  metalness: 0.72,
  roughness: 0.26,
}

const PIECE_MATERIALS: Record<
  PieceColor,
  { color: string; metalness: number; roughness: number }
> = {
  white: {
    color: '#efe6d3',
    metalness: 0.2,
    roughness: 0.34,
  },
  black: {
    color: '#1a2128',
    metalness: 0.28,
    roughness: 0.4,
  },
}

const PIECE_SCALES: Record<PieceType, number> = {
  pawn: 0.88,
  rook: 0.94,
  knight: 0.98,
  bishop: 0.98,
  queen: 1.06,
  king: 1.12,
}
const PIECE_MOVE_ARC_HEIGHT = 0.16

interface PiecePrimitiveProps {
  color: PieceColor
}

function PieceMaterial({ color }: PiecePrimitiveProps) {
  const material = PIECE_MATERIALS[color]

  return <meshStandardMaterial {...material} />
}

function AccentRing({ y }: { y: number }) {
  return (
    <mesh castShadow position={[0, y, 0]} receiveShadow>
      <torusGeometry args={[0.28, 0.028, 16, 48]} />
      <meshStandardMaterial {...ACCENT_MATERIAL} />
    </mesh>
  )
}

function Pedestal({ color }: PiecePrimitiveProps) {
  return (
    <>
      <mesh castShadow position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.12, 40]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.22, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.28, 0.22, 36]} />
        <PieceMaterial color={color} />
      </mesh>
      <AccentRing y={0.14} />
    </>
  )
}

function Pawn({ color }: PiecePrimitiveProps) {
  return (
    <>
      <Pedestal color={color} />
      <mesh castShadow position={[0, 0.52, 0]} receiveShadow>
        <cylinderGeometry args={[0.14, 0.19, 0.44, 36]} />
        <PieceMaterial color={color} />
      </mesh>
      <AccentRing y={0.72} />
      <mesh castShadow position={[0, 0.92, 0]} receiveShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
        <PieceMaterial color={color} />
      </mesh>
    </>
  )
}

function Rook({ color }: PiecePrimitiveProps) {
  const crownOffsets: ReadonlyArray<readonly [number, number]> = [
    [0.24, 0.02],
    [-0.24, 0.02],
    [0.02, 0.24],
    [0.02, -0.24],
  ]

  return (
    <>
      <Pedestal color={color} />
      <mesh castShadow position={[0, 0.56, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.5, 36]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.88, 0]} receiveShadow>
        <cylinderGeometry args={[0.31, 0.29, 0.16, 36]} />
        <PieceMaterial color={color} />
      </mesh>
      {crownOffsets.map(([x, z], index) => (
        <mesh
          key={`${x}-${z}-${index}`}
          castShadow
          position={[x, 1.02, z]}
          receiveShadow
        >
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <PieceMaterial color={color} />
        </mesh>
      ))}
    </>
  )
}

function Knight({ color }: PiecePrimitiveProps) {
  return (
    <>
      <Pedestal color={color} />
      <mesh castShadow position={[0, 0.54, 0]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.24, 0.48, 36]} />
        <PieceMaterial color={color} />
      </mesh>
      <AccentRing y={0.75} />
      <mesh
        castShadow
        position={[0, 0.92, -0.05]}
        receiveShadow
        rotation={[0.22, 0, 0]}
      >
        <boxGeometry args={[0.24, 0.62, 0.42]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 1.18, -0.2]}
        receiveShadow
        rotation={[0.78, 0, 0]}
      >
        <coneGeometry args={[0.16, 0.42, 4]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 1.04, 0.06]}
        receiveShadow
        rotation={[0.22, 0, 0]}
      >
        <boxGeometry args={[0.08, 0.42, 0.22]} />
        <meshStandardMaterial {...ACCENT_MATERIAL} />
      </mesh>
    </>
  )
}

function Bishop({ color }: PiecePrimitiveProps) {
  return (
    <>
      <Pedestal color={color} />
      <mesh castShadow position={[0, 0.58, 0]} receiveShadow>
        <cylinderGeometry args={[0.16, 0.23, 0.58, 36]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.98, 0]} receiveShadow>
        <sphereGeometry args={[0.2, 32, 32]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0.02, 1.04, 0]}
        receiveShadow
        rotation={[0, 0, 0.42]}
      >
        <boxGeometry args={[0.06, 0.4, 0.06]} />
        <meshStandardMaterial {...ACCENT_MATERIAL} />
      </mesh>
      <mesh castShadow position={[0, 1.24, 0]} receiveShadow>
        <coneGeometry args={[0.12, 0.26, 24]} />
        <PieceMaterial color={color} />
      </mesh>
    </>
  )
}

function Queen({ color }: PiecePrimitiveProps) {
  return (
    <>
      <Pedestal color={color} />
      <mesh castShadow position={[0, 0.62, 0]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.26, 0.64, 40]} />
        <PieceMaterial color={color} />
      </mesh>
      <AccentRing y={0.93} />
      <mesh castShadow position={[0, 1.02, 0]} receiveShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
        <PieceMaterial color={color} />
      </mesh>
      {[0, 1, 2, 3, 4].map((step) => {
        const angle = (step / 5) * Math.PI * 2
        const x = Math.cos(angle) * 0.18
        const z = Math.sin(angle) * 0.18

        return (
          <mesh
            key={`queen-crown-${step}`}
            castShadow
            position={[x, 1.22, z]}
            receiveShadow
          >
            <sphereGeometry args={[0.08, 20, 20]} />
            <PieceMaterial color={color} />
          </mesh>
        )
      })}
      <mesh castShadow position={[0, 1.36, 0]} receiveShadow>
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshStandardMaterial {...ACCENT_MATERIAL} />
      </mesh>
    </>
  )
}

function King({ color }: PiecePrimitiveProps) {
  return (
    <>
      <Pedestal color={color} />
      <mesh castShadow position={[0, 0.66, 0]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.28, 0.72, 40]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.08, 0]} receiveShadow>
        <sphereGeometry args={[0.16, 28, 28]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.28, 0]} receiveShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.24, 24]} />
        <PieceMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.42, 0]} receiveShadow>
        <boxGeometry args={[0.34, 0.06, 0.08]} />
        <meshStandardMaterial {...ACCENT_MATERIAL} />
      </mesh>
      <mesh castShadow position={[0, 1.42, 0]} receiveShadow>
        <boxGeometry args={[0.08, 0.28, 0.08]} />
        <meshStandardMaterial {...ACCENT_MATERIAL} />
      </mesh>
    </>
  )
}

function ChessPieceShape({
  color,
  pieceType,
}: {
  color: PieceColor
  pieceType: PieceType
}) {
  switch (pieceType) {
    case 'pawn':
      return <Pawn color={color} />
    case 'rook':
      return <Rook color={color} />
    case 'knight':
      return <Knight color={color} />
    case 'bishop':
      return <Bishop color={color} />
    case 'queen':
      return <Queen color={color} />
    case 'king':
      return <King color={color} />
  }
}

function ChessPiece({
  piece,
  onSquareSelect,
  selectedSquare,
}: {
  piece: ChessScenePiece
  onSquareSelect?: (square: ChessSquare) => void
  selectedSquare?: ChessSquare | null
}) {
  const position = squareToScenePosition(piece.square, BOARD_SURFACE_Y)
  const isSelected = piece.square === selectedSquare

  return (
    <group
      onPointerDown={(event) => {
        event.stopPropagation()
        onSquareSelect?.(piece.square)
      }}
      position={position}
      rotation={[0, piece.color === 'white' ? 0 : Math.PI, 0]}
      scale={PIECE_SCALES[piece.type] * (isSelected ? 1.06 : 1)}
    >
      <ChessPieceShape color={piece.color} pieceType={piece.type} />
    </group>
  )
}

function AnimatedChessPiece({
  animation,
}: {
  animation: ChessAnimatedPieceMotion
}) {
  const groupRef = useRef<Group | null>(null)
  const elapsedSecondsRef = useRef(0)
  const startPosition = useMemo(
    () => squareToScenePosition(animation.from, BOARD_SURFACE_Y),
    [animation.from],
  )
  const endPosition = useMemo(
    () => squareToScenePosition(animation.to, BOARD_SURFACE_Y),
    [animation.to],
  )
  const baseScale = PIECE_SCALES[animation.piece.type]
  const durationSeconds = CHESS_MOVE_ANIMATION_DURATION_MS / 1000

  useEffect(() => {
    elapsedSecondsRef.current = 0

    if (groupRef.current !== null) {
      groupRef.current.position.set(...startPosition)
    }
  }, [animation.id, startPosition])

  useFrame((_, delta) => {
    if (groupRef.current === null) {
      return
    }

    elapsedSecondsRef.current = Math.min(
      durationSeconds,
      elapsedSecondsRef.current + delta,
    )

    const progress =
      durationSeconds === 0 ? 1 : elapsedSecondsRef.current / durationSeconds
    const easedProgress = smoothstep(progress)
    const x = interpolate(startPosition[0], endPosition[0], easedProgress)
    const y =
      interpolate(startPosition[1], endPosition[1], easedProgress) +
      Math.sin(Math.PI * easedProgress) * PIECE_MOVE_ARC_HEIGHT
    const z = interpolate(startPosition[2], endPosition[2], easedProgress)

    groupRef.current.position.set(x, y, z)
  })

  return (
    <group
      ref={groupRef}
      position={startPosition}
      rotation={[0, animation.piece.color === 'white' ? 0 : Math.PI, 0]}
      scale={baseScale}
    >
      <ChessPieceShape
        color={animation.piece.color}
        pieceType={animation.piece.type}
      />
    </group>
  )
}

interface ChessPieceRackProps {
  pieces: ReadonlyArray<ChessScenePiece>
  animatedPieces?: ReadonlyArray<ChessAnimatedPieceMotion>
  onSquareSelect?: (square: ChessSquare) => void
  selectedSquare?: ChessSquare | null
}

export function ChessPieceRack({
  pieces,
  animatedPieces = [],
  onSquareSelect,
  selectedSquare,
}: ChessPieceRackProps) {
  return (
    <group>
      {pieces.map((piece) => (
        <ChessPiece
          key={`${piece.color}-${piece.type}-${piece.square}`}
          onSquareSelect={onSquareSelect}
          piece={piece}
          selectedSquare={selectedSquare}
        />
      ))}
      {animatedPieces.map((animation) => (
        <AnimatedChessPiece animation={animation} key={animation.id} />
      ))}
    </group>
  )
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function smoothstep(progress: number): number {
  const clampedProgress = Math.min(1, Math.max(0, progress))

  return clampedProgress * clampedProgress * (3 - 2 * clampedProgress)
}
