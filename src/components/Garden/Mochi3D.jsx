import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Cone } from '@react-three/drei';

export default function Mochi3D({ isWalking }) {
  const group = useRef(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = Math.sin(t * 2) * 0.1;
    if (isWalking) {
      group.current.rotation.z = Math.sin(t * 4) * 0.08;
    }
  });

  return (
    <group ref={group}>
      <Sphere args={[0.5, 32, 32]} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </Sphere>
      <Sphere args={[0.06, 16, 16]} position={[-0.18, 0.1, 0.45]}>
        <meshBasicMaterial color="#2d2d2d" />
      </Sphere>
      <Sphere args={[0.06, 16, 16]} position={[0.18, 0.1, 0.45]}>
        <meshBasicMaterial color="#2d2d2d" />
      </Sphere>
      <Sphere args={[0.08, 16, 16]} position={[-0.3, -0.05, 0.4]}>
        <meshBasicMaterial color="#ffb7b2" opacity={0.6} transparent />
      </Sphere>
      <Sphere args={[0.08, 16, 16]} position={[0.3, -0.05, 0.4]}>
        <meshBasicMaterial color="#ffb7b2" opacity={0.6} transparent />
      </Sphere>
      <Cone args={[0.15, 0.3, 16]} position={[0, 0.55, 0]} rotation={[0, 0, 0.3]}>
        <meshStandardMaterial color="#8fa967" />
      </Cone>
    </group>
  );
}
