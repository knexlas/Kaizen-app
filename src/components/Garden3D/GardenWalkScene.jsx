import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Billboard } from '@react-three/drei';
/**
 * Minimal 3D scene for the guided garden walk overlay (calm, low-stimulus).
 */
export default function GardenWalkScene() {
  const groupRef = useRef(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <mesh>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial color="#4a7c59" emissive="#2d5a3a" roughness={0.8} metalness={0.1} />
          </mesh>
        </Billboard>
      </Float>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 2]} intensity={0.8} />
    </group>
  );
}
