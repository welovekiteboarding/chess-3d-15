import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MathUtils, type PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { scenePalette } from '../assets/scenePalette'
import {
  BOARD_FILES,
  BOARD_RANKS,
  boardSquareToScenePosition,
  type BoardSquare,
} from './boardCoordinates'
import { ChessPieceMesh } from './ChessPieceMesh'
import type { PiecePlacement } from './pieceLayout'

interface ChessBoardSceneProps {
  pieces: PiecePlacement[]
}

function SceneCameraControls() {
  const { camera, gl } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const controls = new OrbitControls(
      camera as PerspectiveCamera,
      gl.domElement,
    )

    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 8.4
    controls.maxDistance = 14
    controls.minPolarAngle = MathUtils.degToRad(32)
    controls.maxPolarAngle = MathUtils.degToRad(68)
    controls.target.set(0, 0.42, 0)
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

function ChessBoardSurface() {
  return (
    <group>
      <mesh castShadow position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[9.45, 0.32, 9.45]} />
        <meshStandardMaterial
          color={scenePalette.boardFrame}
          metalness={0.14}
          roughness={0.6}
        />
      </mesh>

      <mesh position={[0, -0.37, 0]} receiveShadow>
        <cylinderGeometry args={[7.7, 8.1, 0.16, 64]} />
        <meshStandardMaterial color={scenePalette.plinth} roughness={0.95} />
      </mesh>

      {BOARD_RANKS.flatMap((rank) =>
        BOARD_FILES.map((file, fileIndex) => {
          const square = `${file}${rank}` as BoardSquare
          const [x, , z] = boardSquareToScenePosition(square)
          const isLightSquare = (fileIndex + rank) % 2 === 0

          return (
            <mesh
              key={square}
              castShadow
              position={[x, -0.06, z]}
              receiveShadow
            >
              <boxGeometry args={[0.98, 0.12, 0.98]} />
              <meshStandardMaterial
                color={
                  isLightSquare
                    ? scenePalette.boardLight
                    : scenePalette.boardDark
                }
                metalness={0.08}
                roughness={0.56}
              />
            </mesh>
          )
        }),
      )}

      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.2, 8.2]} />
        <meshStandardMaterial
          color={scenePalette.metal}
          opacity={0.08}
          roughness={0.2}
          transparent
        />
      </mesh>
    </group>
  )
}

export function ChessBoardScene({ pieces }: ChessBoardSceneProps) {
  if (import.meta.env.MODE === 'test') {
    return (
      <div
        aria-hidden="true"
        className="board-stage__canvas board-stage__canvas--fallback"
      />
    )
  }

  return (
    <Canvas
      camera={{ far: 40, fov: 34, near: 0.1, position: [6.8, 7.4, 7.8] }}
      className="board-stage__canvas"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0.42, 0)
        gl.setClearColor(scenePalette.background, 0)
      }}
      shadows
    >
      <fog attach="fog" args={[scenePalette.background, 10, 18]} />

      <ambientLight color={scenePalette.lightWarm} intensity={0.7} />
      <hemisphereLight
        color={scenePalette.lightCool}
        groundColor={scenePalette.plinth}
        intensity={0.55}
      />
      <directionalLight
        castShadow
        color={scenePalette.lightWarm}
        intensity={1.35}
        position={[6, 10, 4]}
        shadow-camera-bottom={-10}
        shadow-camera-far={28}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <spotLight
        angle={0.4}
        castShadow
        color={scenePalette.lightWarm}
        intensity={0.65}
        penumbra={0.8}
        position={[-5, 9, 6]}
      />

      <SceneCameraControls />
      <ChessBoardSurface />
      {pieces.map((piece) => (
        <ChessPieceMesh
          key={`${piece.color}-${piece.kind}-${piece.square}`}
          {...piece}
        />
      ))}

      <mesh
        position={[0, -0.45, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[28, 28]} />
        <shadowMaterial opacity={0.28} transparent />
      </mesh>
    </Canvas>
  )
}
