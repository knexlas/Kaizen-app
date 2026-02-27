import { useRef, useEffect, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Cone, Cylinder } from '@react-three/drei';
import { LowPerfContext } from './Garden3D';

export default function Owl3D({ position = [0, 0, 0] }) {
  const group = useRef();
  const lowPerf = useContext(LowPerfContext);
  const shadow = !lowPerf;
  const baseY = useRef(position[1]);
  useEffect(() => { baseY.current = position[1]; }, [position]);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = baseY.current + Math.sin(clock.elapsedTime * 2) * 0.02;
  });

  return (
    <group ref={group} position={position} scale={0.7}>
      {/* Body */}
      <Cylinder args={[0.3, 0.4, 0.7, 16]} position={[0, 0.35, 0]} castShadow={shadow}>
        <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
      </Cylinder>
      {/* Belly */}
      <Cylinder args={[0.25, 0.35, 0.65, 16]} position={[0, 0.35, 0.06]} castShadow={shadow}>
        <meshStandardMaterial color="#DEB887" roughness={0.9} />
      </Cylinder>
      {/* White eye backgrounds */}
      <Sphere args={[0.1, 16, 16]} position={[-0.12, 0.5, 0.28]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" />
      </Sphere>
      <Sphere args={[0.1, 16, 16]} position={[0.12, 0.5, 0.28]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" />
      </Sphere>
      {/* Black pupils */}
      <Sphere args={[0.04, 16, 16]} position={[-0.12, 0.5, 0.36]} castShadow={shadow}>
        <meshStandardMaterial color="#000000" />
      </Sphere>
      <Sphere args={[0.04, 16, 16]} position={[0.12, 0.5, 0.36]} castShadow={shadow}>
        <meshStandardMaterial color="#000000" />
      </Sphere>
      {/* Beak */}
      <Cone args={[0.05, 0.12, 4]} position={[0, 0.4, 0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadow}>
        <meshStandardMaterial color="#FFA500" />
      </Cone>
      {/* Ears / horns */}
      <Cone args={[0.08, 0.15, 4]} position={[-0.2, 0.75, 0]} rotation={[0, 0, 0.2]} castShadow={shadow}>
        <meshStandardMaterial color="#8B5A2B" />
      </Cone>
      <Cone args={[0.08, 0.15, 4]} position={[0.2, 0.75, 0]} rotation={[0, 0, -0.2]} castShadow={shadow}>
        <meshStandardMaterial color="#8B5A2B" />
      </Cone>
    </group>
  );
}
