"use client"

import { useMemo, useRef, useEffect, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Points, PointMaterial, OrbitControls } from "@react-three/drei"
import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing"
import * as THREE from "three"

// Configuration from your adjustments
const CONFIG = {
  "centralNodes": 16,
  "middleNodes": 22,
  "outerNodes": 83,
  "connectionDistance": 4.3,
  "connectionProbability": 0.35,
  "nodeSize": 0.08,
  "lineOpacity": 0.3,
  "bloomIntensity": 0,
  "rotationSpeed": 0.005
}
const SEED = 264.0517968528827

interface Node {
  position: [number, number, number]
}

interface Connection {
  from: [number, number, number]
  to: [number, number, number]
  opacity: number
}

function generateMindMap(config: typeof CONFIG, seed: number) {
  let seedValue = seed
  const seededRandom = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280
    return seedValue / 233280
  }

  const nodes: Node[] = []
  const connections: Connection[] = []

  const addRing = (count: number, radiusFn: () => number, heightFn: () => number) => {
    for (let i = 0; i < count; i++) {
      const a = seededRandom() * Math.PI * 2
      const r = radiusFn()
      nodes.push({ position: [Math.cos(a) * r, heightFn(), Math.sin(a) * r] })
    }
  }

  addRing(
    config.centralNodes,
    () => seededRandom() * 1.5 + 0.5,
    () => (seededRandom() - 0.5) * 2,
  )
  addRing(
    config.middleNodes,
    () => seededRandom() * 2 + 3,
    () => (seededRandom() - 0.5) * 2,
  )
  addRing(
    config.outerNodes,
    () => seededRandom() * 4 + 5,
    () => (seededRandom() - 0.5) * 6,
  )

  nodes.forEach((n, i) => {
    nodes.forEach((m, j) => {
      if (i >= j) return
      const d = Math.sqrt(
        Math.pow(n.position[0] - m.position[0], 2) +
          Math.pow(n.position[1] - m.position[1], 2) +
          Math.pow(n.position[2] - m.position[2], 2),
      )
      if (d < config.connectionDistance && seededRandom() > config.connectionProbability) {
        connections.push({
          from: n.position,
          to: m.position,
          opacity: Math.max(0.2, 1 - d / config.connectionDistance),
        })
      }
    })
  })

  return { nodes, connections }
}

function ConnectionLines({ connections, opacity }: { connections: Connection[]; opacity: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    connections.forEach((connection) => {
      positions.push(...connection.from)
      positions.push(...connection.to)
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [connections])

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: opacity,
    })
  }, [opacity])

  return (
    <lineSegments
      key={connections.length}
      geometry={geometry}
      material={material}
    />
  )
}

function MindMap({ config }: { config: typeof CONFIG }) {
  const { nodes, connections } = useMemo(() => generateMindMap(config, SEED), [config])
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = scrollY * config.rotationSpeed
    group.current.rotation.x = Math.sin(clock.elapsedTime * 0.1) * 0.1

    camera.position.x = Math.sin(clock.elapsedTime * 0.05) * 2
    camera.position.z = Math.cos(clock.elapsedTime * 0.05) * 2 + 10
    camera.lookAt(0, 0, 0)
  })

  const positions = useMemo(() => new Float32Array(nodes.flatMap((n) => n.position)), [nodes])

  return (
    <group ref={group}>
      <ConnectionLines connections={connections} opacity={config.lineOpacity} />
      <Points
        key={positions.length}
        positions={positions}
        stride={3}
        frustumCulled={false}
      >
        <PointMaterial
          color="#ffffff"
          size={config.nodeSize}
          sizeAttenuation
          depthWrite={false}
          transparent
          opacity={0.9}
        />
      </Points>
    </group>
  )
}

export default function MindMap3D() {
  return (
    <div style={{ 
      width: "100vw", 
      height: "100vh", 
      backgroundColor: "transparent",
      margin: 0,
      padding: 0,
      overflow: "hidden"
    }}>
      <Canvas 
        camera={{ position: [0, 0, 10], fov: 55 }} 
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight intensity={0.6} position={[5, 5, 5]} />

        <MindMap config={CONFIG} />

        <EffectComposer>
          <Bloom intensity={CONFIG.bloomIntensity} luminanceThreshold={0.25} />
          <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={3} />
        </EffectComposer>

        <OrbitControls enablePan={false} minDistance={5} maxDistance={20} />
      </Canvas>
    </div>
  )
}
