import React, { useContext, useEffect, useRef } from 'react';
import { Box, Cylinder, Billboard, Text, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Owl3D from './Owl3D';
import { LowPerfContext } from './Garden3D';

export default function ShopStand({ position, onClick, timePhase, isArchitectMode = false, selectedObjectId, setSelectedObjectId }) {
  const lowPerf = useContext(LowPerfContext);
  const shadow = !lowPerf;
  const groupRef = useRef(null);
  const targetRef = useRef(new THREE.Vector3());
  const px = Number(position?.[0]) || 0;
  const py = Number(position?.[1]) || 0;
  const pz = Number(position?.[2]) || 0;
  const isSelected = selectedObjectId === 'shop-stand';

  useEffect(() => {
    targetRef.current.set(px, py, pz);
    if (groupRef.current && groupRef.current.__initPos !== true) {
      groupRef.current.position.copy(targetRef.current);
      groupRef.current.__initPos = true;
    }
  }, [px, py, pz]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = 1 - Math.pow(0.001, delta);
    groupRef.current.position.lerp(targetRef.current, t);
  });

  const handlePointerDown = (e) => {
    if (!isArchitectMode) return;
    e.stopPropagation();
    setSelectedObjectId?.('shop-stand');
  };

  const handleClick = (e) => {
    if (isArchitectMode) {
      e.stopPropagation();
      setSelectedObjectId?.('shop-stand');
      return;
    }
    onClick?.(e);
  };
  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = isArchitectMode ? 'grab' : 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <torusGeometry args={[1.8, 0.12, 16, 48]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.9} transparent opacity={0.95} />
        </mesh>
      )}
      {/* Counter (desk) */}
      <RoundedBox args={[2.5, 1, 1]} radius={0.05} position={[0, 0.5, 0]} castShadow={shadow} receiveShadow={shadow}>
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </RoundedBox>
      {/* Counter top */}
      <RoundedBox args={[2.7, 0.1, 1.2]} radius={0.02} position={[0, 1.05, 0]} castShadow={shadow} receiveShadow={shadow}>
        <meshStandardMaterial color="#a0522d" roughness={0.8} />
      </RoundedBox>
      {/* Canopy poles */}
      <Cylinder args={[0.05, 0.05, 1.5]} position={[-1.1, 1.8, -0.3]} castShadow={shadow} receiveShadow={shadow}>
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </Cylinder>
      <Cylinder args={[0.05, 0.05, 1.5]} position={[1.1, 1.8, -0.3]} castShadow={shadow} receiveShadow={shadow}>
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </Cylinder>
      {/* Canopy roof */}
      <Box args={[2.8, 0.1, 1.5]} position={[0, 2.5, 0]} rotation={[0.2, 0, 0]} castShadow={shadow}>
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
        <mesh position={[0, 0, 0]} castShadow={shadow}>
          <cylinderGeometry args={[0.1, 0.12, 0.05, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow={shadow}>
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
