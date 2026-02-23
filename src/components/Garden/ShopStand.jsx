import React from 'react';
import { Box, Cylinder, Billboard, Text, RoundedBox } from '@react-three/drei';
import Owl3D from './Owl3D';

export default function ShopStand({ position, onClick, timePhase }) {
  return (
    <group
      position={position}
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {/* Counter (desk) */}
      <RoundedBox args={[2.5, 1, 1]} radius={0.05} position={[0, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </RoundedBox>
      {/* Counter top */}
      <RoundedBox args={[2.7, 0.1, 1.2]} radius={0.02} position={[0, 1.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#a0522d" roughness={0.8} />
      </RoundedBox>
      {/* Canopy poles */}
      <Cylinder args={[0.05, 0.05, 1.5]} position={[-1.1, 1.8, -0.3]} castShadow receiveShadow>
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </Cylinder>
      <Cylinder args={[0.05, 0.05, 1.5]} position={[1.1, 1.8, -0.3]} castShadow receiveShadow>
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </Cylinder>
      {/* Canopy roof */}
      <Box args={[2.8, 0.1, 1.5]} position={[0, 2.5, 0]} rotation={[0.2, 0, 0]} castShadow>
        <meshStandardMaterial color="#e11d48" />
      </Box>
      {/* Owl shopkeeper */}
      <Owl3D position={[0, 1.05, -0.6]} />
      {/* Sign on desk */}
      <Box args={[0.4, 0.3, 0.05]} position={[-0.8, 1.25, 0.2]} rotation={[0, 0.2, 0]}>
        <meshStandardMaterial color="#fef3c7" />
      </Box>
      {/* Lantern on far right of counter */}
      <group position={[0.8, 1.25, 0.2]}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.05, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.1, 0.05, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 0.125, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
          <meshStandardMaterial
            color={(timePhase ?? 'day') === 'night' ? '#fef08a' : '#cbd5e1'}
            emissive={(timePhase ?? 'day') === 'night' ? '#fef08a' : '#000000'}
            emissiveIntensity={(timePhase ?? 'day') === 'night' ? 2 : 0}
            transparent
            opacity={0.8}
          />
        </mesh>
        {(timePhase ?? 'day') === 'night' && (
          <pointLight position={[0, 0.125, 0]} color="#fef08a" intensity={3} distance={8} />
        )}
      </group>
      {/* Floating shop label */}
      <Billboard position={[0, 3.2, 0]}>
        <Text fontSize={0.4} color="#292524" outlineWidth={0.04} outlineColor="#ffffff">
          🛒 Spirit Shop
        </Text>
      </Billboard>
    </group>
  );
}
