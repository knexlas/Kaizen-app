import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';

export default function Frog3D({ isWalking }) {
  const group = useRef();
  useFrame((state) => {
    if (group.current && isWalking) group.current.position.y = Math.max(0, Math.sin(state.clock.elapsedTime * 15) * 0.15);
  });
  return (
    <group ref={group} scale={0.4} position={[0, 0.1, 0]}>
      <Sphere args={[0.3, 16, 16]} castShadow>
        <meshStandardMaterial color="#4ade80" roughness={0.8} />
      </Sphere>
      <Sphere args={[0.1, 16, 16]} position={[-0.15, 0.2, 0.2]} castShadow>
        <meshStandardMaterial color="#ffffff" />
      </Sphere>
      <Sphere args={[0.1, 16, 16]} position={[0.15, 0.2, 0.2]} castShadow>
        <meshStandardMaterial color="#ffffff" />
      </Sphere>
      <Sphere args={[0.04, 16, 16]} position={[-0.15, 0.22, 0.28]}>
        <meshStandardMaterial color="#000000" />
      </Sphere>
      <Sphere args={[0.04, 16, 16]} position={[0.15, 0.22, 0.28]}>
        <meshStandardMaterial color="#000000" />
      </Sphere>
    </group>
  );
}
