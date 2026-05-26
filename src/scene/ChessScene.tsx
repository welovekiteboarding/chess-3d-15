import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PCFSoftShadowMap } from 'three'
import type { ChessAnimatedPieceMotion } from '../components/game/chessMoveAnimations'
import { ChessBoardModel } from './ChessBoardModel'
import { ChessPieceRack } from './ChessPieceModel'
import type { ChessScenePiece } from '../types/chess'
import type { BoardSquare } from './boardCoordinates'
import type { ChessSceneSquareHighlight } from './chessSceneHighlights'

function CameraControls() {
  const { camera, gl } = useThree()
  const controlsRef = useRef<ThreeOrbitControls | null>(null)

  useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement)

    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 10
    controls.maxDistance = 15
    controls.minPolarAngle = Math.PI / 5
    controls.maxPolarAngle = Math.PI / 2.08
    controls.minAzimuthAngle = -Math.PI / 3.2
    controls.maxAzimuthAngle = Math.PI / 3.2
    controls.target.set(0, 0.95, 0)
    controls.update()

    controlsRef.current = controls

    return () => {
      controls.dispose()
      controlsRef.current = null
    }
  }, [camera, gl])

  useFrame(() => {
    controlsRef.current?.update()
  })

  return null
}

function ChessLights() {
  return (
    <>
      <fog attach="fog" args={['#091311', 11, 22]} />
      <ambientLight color="#ead8b8" intensity={0.6} />
      <hemisphereLight
        color="#f4ecd8"
        groundColor="#120f0d"
        intensity={0.5}
      />
      <directionalLight
        castShadow
        color="#fff1cf"
        intensity={2.1}
        position={[7.5, 10.5, 5.5]}
        shadow-bias={-0.00012}
        shadow-camera-bottom={-10}
        shadow-camera-far={28}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <spotLight
        angle={0.42}
        castShadow
        color="#b9d3ff"
        intensity={1}
        penumbra={0.8}
        position={[-8, 8, 9]}
      />
    </>
  )
}

interface ChessSceneProps {
  pieces: ReadonlyArray<ChessScenePiece>
  animatedPieces?: ReadonlyArray<ChessAnimatedPieceMotion>
  highlightedSquares?: ReadonlyArray<ChessSceneSquareHighlight>
  onSquareSelect?: (square: BoardSquare) => void
  selectedSquare?: BoardSquare | null
}

export function ChessScene({
  pieces,
  animatedPieces = [],
  highlightedSquares = [],
  onSquareSelect,
  selectedSquare = null,
}: ChessSceneProps) {
  return (
    <Canvas
      camera={{ fov: 34, near: 0.1, far: 40, position: [7.4, 7.8, 8.6] }}
      className="board-canvas"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = PCFSoftShadowMap
        gl.domElement.style.touchAction = 'none'
      }}
      shadows
    >
      <ChessLights />
      <CameraControls />
      <ChessBoardModel
        highlights={highlightedSquares}
        onSquareSelect={onSquareSelect}
      />
      <ChessPieceRack
        animatedPieces={animatedPieces}
        onSquareSelect={onSquareSelect}
        pieces={pieces}
        selectedSquare={selectedSquare}
      />
    </Canvas>
  )
}
