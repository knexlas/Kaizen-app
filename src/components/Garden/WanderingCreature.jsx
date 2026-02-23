import React, { useState, useRef, useEffect, cloneElement } from 'react';
import { useFrame } from '@react-three/fiber';
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
  const { terrainMap } = useGarden();
  const groupRef = useRef();
  const [target, setTarget] = useState(() => new THREE.Vector3(0, 0, 0));
  const [isWalking, setIsWalking] = useState(false);
  const idleRotationRef = useRef(null);
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
          idleRotationRef.current = null;
          const delay = 3000 + Math.random() * 5000;
          timeoutRef.current = setTimeout(pickTarget, delay);
          return;
        }
      }

      // 40% chance: idle look-around instead of walking to a new target
      if (Math.random() < 0.4) {
        idleRotationRef.current = Math.random() * Math.PI * 2;
        const delay = 2000 + Math.random() * 4000;
        timeoutRef.current = setTimeout(pickTarget, delay);
        return;
      }

      const cx = groupRef.current?.position?.x ?? 0;
      const cz = groupRef.current?.position?.z ?? 0;

      // Short wander: only tiles within radius 2–4 units of current position
      const minRadius = 2;
      const maxRadius = 4;
      const validTiles = [];
      const cxInt = Math.round(cx);
      const czInt = Math.round(cz);
      for (let x = cxInt - maxRadius; x <= cxInt + maxRadius; x++) {
        for (let z = czInt - maxRadius; z <= czInt + maxRadius; z++) {
          const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
          if (dist >= minRadius && dist <= maxRadius && isTerrainAllowed(terrainMap, x, z, allowedTerrain)) {
            validTiles.push({ x, z });
          }
        }
      }

      if (validTiles.length > 0) {
        const tile = validTiles[Math.floor(Math.random() * validTiles.length)];
        setTarget(new THREE.Vector3(tile.x, 0, tile.z));
        idleRotationRef.current = null;
      }

      const delay = 3000 + Math.random() * 5000;
      timeoutRef.current = setTimeout(pickTarget, delay);
    };

    timeoutRef.current = setTimeout(pickTarget, 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [terrainMap, allowedTerrain]);

  const walkSpeed = speed * 0.65; // Slightly reduced for a more relaxed pace

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const distance = groupRef.current.position.distanceTo(target);

    if (distance > 0.1) {
      groupRef.current.position.lerp(target, delta * walkSpeed);
      groupRef.current.position.y = zOffset;
      setIsWalking(true);
      idleRotationRef.current = null;

      const angle = Math.atan2(
        target.x - groupRef.current.position.x,
        target.z - groupRef.current.position.z
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, delta * walkSpeed * 3);
    } else {
      setIsWalking(false);
      groupRef.current.position.y = zOffset;

      const idleRot = idleRotationRef.current;
      if (idleRot != null) {
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
          groupRef.current.rotation.y,
          idleRot,
          delta * 1.5
        );
      }
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

