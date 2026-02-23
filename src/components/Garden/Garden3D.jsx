import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#2d5a27" />
    </mesh>
  );
}

function Tree() {
  const group = useRef(null);
  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* Trunk */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 1.5, 8]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      {/* Foliage (cone) */}
      <mesh position={[0, 2.25, 0]} castShadow>
        <coneGeometry args={[1.2, 2, 8]} />
        <meshStandardMaterial color="#388e3c" />
      </mesh>
    </group>
  );
}

export default function Garden3D() {
  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-stone-200">
      <Canvas shadows camera={{ position: [8, 6, 8], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <Sky sunPosition={[10, 20, 10]} />
        <Environment preset="forest" />
        <OrbitControls autoRotate autoRotateSpeed={0.5} enableDamping dampingFactor={0.05} />
        <Ground />
        <Tree />
      </Canvas>
    </div>
  );
}
