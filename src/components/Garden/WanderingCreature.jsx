import React, { useState, useRef, useEffect, cloneElement } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGarden } from '../../context/GardenContext';

function getTerrainAt(terrainMap, x, z) {
  if (!terrainMap || typeof terrainMap !== 'object') return undefined;
  const key = `${Math.round(x)},${Math.round(z)}`;
  return terrainMap[key];
}

function hasAnyWaterTile(terrainMap) {
  if (!terrainMap || typeof terrainMap !== 'object') return false;
  return Object.values(terrainMap).some((v) => v === 'water');
}

function isTerrainAllowed(terrainMap, x, z, allowedTerrain) {
  const tile = getTerrainAt(terrainMap, x, z);
  if (allowedTerrain === 'water') {
    if (!hasAnyWaterTile(terrainMap)) return tile === 'grass' || tile === undefined;
    return tile === 'water';
  }
  if (allowedTerrain === 'grass') return tile === 'grass' || tile === undefined;
  return true;
}

export default function WanderingCreature({
  emoji = '🐰',
  customComponent,
  allowedTerrain = 'grass',
  speed = 1,
  jumpHeight = 0,
  scale = 1,
  zOffset = 0.5,
  goalPositions = null,
}) {
  const { camera } = useThree();
  const { terrainMap } = useGarden();
  const groupRef = useRef();
  const [target, setTarget] = useState(() => new THREE.Vector3(0, 0, 0));
  const [isWalking, setIsWalking] = useState(false);
  const timeoutRef = useRef(null);
  const goalPositionsRef = useRef(goalPositions);

  useEffect(() => {
    goalPositionsRef.current = goalPositions;
  }, [goalPositions]);

  useEffect(() => {
    const pickTarget = () => {
      const goals = goalPositionsRef.current;
      const useGoalTarget = goals?.length > 0 && Math.random() < 0.35;

      if (useGoalTarget && goals.length > 0) {
        const pos = goals[Math.floor(Math.random() * goals.length)];
        if (Array.isArray(pos) && pos.length >= 3) {
          setTarget(new THREE.Vector3(pos[0], pos[1] ?? 0, pos[2]));
          const delay = 3000 + Math.random() * 5000;
          timeoutRef.current = setTimeout(pickTarget, delay);
          return;
        }
      }

      const cx = groupRef.current?.position?.x ?? 0;
      const cz = groupRef.current?.position?.z ?? 0;
      let attempts = 0;
      const maxAttempts = 25;
      while (attempts < maxAttempts) {
        const newX = Math.round(cx + (Math.floor(Math.random() * 7) - 3));
        const newZ = Math.round(cz + (Math.floor(Math.random() * 7) - 3));
        if (isTerrainAllowed(terrainMap, newX, newZ, allowedTerrain)) {
          setTarget(new THREE.Vector3(newX, 0, newZ));
          break;
        }
        attempts++;
      }
      const delay = 3000 + Math.random() * 5000;
      timeoutRef.current = setTimeout(pickTarget, delay);
    };

    timeoutRef.current = setTimeout(pickTarget, 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [terrainMap, allowedTerrain]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    groupRef.current.position.lerp(target, delta * speed);
    groupRef.current.position.y = zOffset;

    const distance = groupRef.current.position.distanceTo(target);
    setIsWalking(distance > 0.1);

    if (distance > 0.1) {
      const angle = Math.atan2(
        target.x - groupRef.current.position.x,
        target.z - groupRef.current.position.z
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, delta * speed * 3);
    } else {
      // When standing still, slowly rotate to look at the camera
      const angleToCamera = Math.atan2(
        groupRef.current.position.x - camera.position.x,
        groupRef.current.position.z - camera.position.z
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angleToCamera, delta * 2);
    }
  });

  return (
    <group ref={groupRef} position={[0, zOffset, 0]}>
      {customComponent ? (
        <group scale={scale}>
          {cloneElement(customComponent, { isWalking })}
        </group>
      ) : (
        <Billboard>
          <Text fontSize={scale}>{emoji}</Text>
        </Billboard>
      )}
    </group>
  );
}

