import { useRef, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Box } from '@react-three/drei';
import { LowPerfContext } from './Garden3D';

export default function Rabbit3D({ isWalking }) {
  const group = useRef(null);
  const lowPerf = useContext(LowPerfContext);
  const shadow = !lowPerf;

  useFrame((state) => {
    if (!group.current) return;
    if (isWalking) {
      group.current.position.y = Math.max(0, Math.sin(state.clock.elapsedTime * 10) * 0.15);
    }
  });

  return (
    <group ref={group} scale={0.5}>
      <Sphere args={[0.3, 32, 32]} position={[0, 0.25, 0]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </Sphere>
      <Sphere args={[0.2, 32, 32]} position={[0, 0.45, 0.25]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </Sphere>
      <Box args={[0.06, 0.3, 0.04]} position={[-0.1, 0.65, 0.15]} rotation={[-0.2, 0, -0.1]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" />
      </Box>
      <Box args={[0.06, 0.3, 0.04]} position={[0.1, 0.65, 0.15]} rotation={[-0.2, 0, 0.1]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" />
      </Box>
      <Sphere args={[0.04, 16, 16]} position={[-0.06, 0.48, 0.42]} castShadow={shadow}>
        <meshBasicMaterial color="#2d2d2d" />
      </Sphere>
      <Sphere args={[0.04, 16, 16]} position={[0.06, 0.48, 0.42]} castShadow={shadow}>
        <meshBasicMaterial color="#2d2d2d" />
      </Sphere>
      <Sphere args={[0.08, 16, 16]} position={[0, 0.2, -0.25]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </Sphere>
    </group>
  );
}
