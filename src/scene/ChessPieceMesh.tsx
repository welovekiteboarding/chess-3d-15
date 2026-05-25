import { scenePalette } from '../assets/scenePalette'
import { boardSquareToScenePosition } from './boardCoordinates'
import type { PieceColor, PieceKind, PiecePlacement } from './pieceLayout'

const pieceTone = {
  white: {
    body: scenePalette.whitePiece,
    glow: scenePalette.whiteAccent,
  },
  black: {
    body: scenePalette.blackPiece,
    glow: scenePalette.blackAccent,
  },
} as const

function PieceBodyMaterial({ color }: { color: PieceColor }) {
  const tone = pieceTone[color]

  return (
    <meshStandardMaterial
      color={tone.body}
      emissive={tone.glow}
      emissiveIntensity={0.05}
      metalness={0.16}
      roughness={0.3}
    />
  )
}

function MetalDetailMaterial() {
  return (
    <meshStandardMaterial
      color={scenePalette.metal}
      metalness={0.82}
      roughness={0.34}
    />
  )
}

function PiecePedestal({ color }: { color: PieceColor }) {
  return (
    <>
      <mesh castShadow position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.16, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.17, 0]}
        receiveShadow
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.27, 0.03, 18, 48]} />
        <PieceBodyMaterial color={color} />
      </mesh>
    </>
  )
}

function PawnShape({ color }: { color: PieceColor }) {
  return (
    <>
      <PiecePedestal color={color} />
      <mesh castShadow position={[0, 0.31, 0]} receiveShadow>
        <cylinderGeometry args={[0.16, 0.22, 0.22, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.52, 0]} receiveShadow>
        <sphereGeometry args={[0.16, 24, 24]} />
        <PieceBodyMaterial color={color} />
      </mesh>
    </>
  )
}

function RookShape({ color }: { color: PieceColor }) {
  return (
    <>
      <PiecePedestal color={color} />
      <mesh castShadow position={[0, 0.39, 0]} receiveShadow>
        <cylinderGeometry args={[0.22, 0.24, 0.42, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.66, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.24, 0.12, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      {(
        [
          [0.18, 0.18],
          [-0.18, 0.18],
          [0.18, -0.18],
          [-0.18, -0.18],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 0.78, z]} receiveShadow>
          <boxGeometry args={[0.1, 0.12, 0.1]} />
          <PieceBodyMaterial color={color} />
        </mesh>
      ))}
    </>
  )
}

function KnightShape({ color }: { color: PieceColor }) {
  return (
    <>
      <PiecePedestal color={color} />
      <mesh castShadow position={[0, 0.34, 0]} receiveShadow>
        <cylinderGeometry args={[0.17, 0.22, 0.28, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.55, -0.02]}
        receiveShadow
        rotation={[0.12, -0.1, 0.28]}
      >
        <boxGeometry args={[0.28, 0.54, 0.34]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0.08, 0.83, 0.02]}
        receiveShadow
        rotation={[0.35, -0.35, 0.14]}
      >
        <coneGeometry args={[0.16, 0.34, 20]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[-0.03, 0.95, 0]}
        receiveShadow
        rotation={[0.3, 0, 0]}
      >
        <boxGeometry args={[0.08, 0.18, 0.02]} />
        <PieceBodyMaterial color={color} />
      </mesh>
    </>
  )
}

function BishopShape({ color }: { color: PieceColor }) {
  return (
    <>
      <PiecePedestal color={color} />
      <mesh castShadow position={[0, 0.37, 0]} receiveShadow>
        <cylinderGeometry args={[0.15, 0.22, 0.34, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.62, 0]} receiveShadow>
        <sphereGeometry args={[0.17, 24, 24]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.84, 0]} receiveShadow>
        <coneGeometry args={[0.14, 0.28, 24]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0.02, 0.69, 0.12]}
        receiveShadow
        rotation={[0.28, 0, 0.12]}
      >
        <boxGeometry args={[0.04, 0.24, 0.03]} />
        <MetalDetailMaterial />
      </mesh>
    </>
  )
}

function QueenShape({ color }: { color: PieceColor }) {
  return (
    <>
      <PiecePedestal color={color} />
      <mesh castShadow position={[0, 0.4, 0]} receiveShadow>
        <cylinderGeometry args={[0.17, 0.22, 0.38, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.71, 0]} receiveShadow>
        <sphereGeometry args={[0.2, 24, 24]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.88, 0]} receiveShadow>
        <cylinderGeometry args={[0.08, 0.13, 0.18, 24]} />
        <MetalDetailMaterial />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => {
        const angle = (index / 5) * Math.PI * 2
        const x = Math.cos(angle) * 0.18
        const z = Math.sin(angle) * 0.18

        return (
          <mesh key={angle} castShadow position={[x, 0.91, z]} receiveShadow>
            <sphereGeometry args={[0.05, 16, 16]} />
            <MetalDetailMaterial />
          </mesh>
        )
      })}
    </>
  )
}

function KingShape({ color }: { color: PieceColor }) {
  return (
    <>
      <PiecePedestal color={color} />
      <mesh castShadow position={[0, 0.42, 0]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.23, 0.42, 32]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.73, 0]} receiveShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <PieceBodyMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.95, 0]} receiveShadow>
        <boxGeometry args={[0.08, 0.28, 0.08]} />
        <MetalDetailMaterial />
      </mesh>
      <mesh castShadow position={[0, 1.03, 0]} receiveShadow>
        <boxGeometry args={[0.24, 0.06, 0.06]} />
        <MetalDetailMaterial />
      </mesh>
    </>
  )
}

function renderPieceShape(kind: PieceKind, color: PieceColor) {
  switch (kind) {
    case 'pawn':
      return <PawnShape color={color} />
    case 'rook':
      return <RookShape color={color} />
    case 'knight':
      return <KnightShape color={color} />
    case 'bishop':
      return <BishopShape color={color} />
    case 'queen':
      return <QueenShape color={color} />
    case 'king':
      return <KingShape color={color} />
    default:
      return null
  }
}

export function ChessPieceMesh({ color, kind, square }: PiecePlacement) {
  const position = boardSquareToScenePosition(square)

  return <group position={position}>{renderPieceShape(kind, color)}</group>
}
