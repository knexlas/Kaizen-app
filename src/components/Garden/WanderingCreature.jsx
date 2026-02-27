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

/** Surface Y at (x,z) so creatures walk on top of tiles. Matches tile tops in Garden3D. */
function getSurfaceHeightAt(terrainMap, x, z) {
  const material = getTerrainAt(terrainMap, x, z);
  if (material === 'water') return 0.02;
  if (material === 'sand') return 0.01;
  if (material === 'stone') return 0.025;
  return 0; // grass / undefined
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

function fireToast(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message } }));
  }
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
  displayName = 'creature',
  timePhase = 'day',
  campfirePositions = [],
}) {
  const { terrainMap, earnEmbers, tourStep, setTourStep } = useGarden();
  const groupRef = useRef();
  const [target, setTarget] = useState(() => new THREE.Vector3(0, 0, 0));
  const [isWalking, setIsWalking] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const lastPetTimeRef = useRef(0);
  const idleRotationRef = useRef(null);
  const timeoutRef = useRef(null);
  const goalPositionsRef = useRef(goalPositions);
  const campfirePositionsRef = useRef(campfirePositions);
  const PET_COOLDOWN_MS = 60000;
  const INTERACT_DURATION_MS = 2000;

  useEffect(() => {
    goalPositionsRef.current = goalPositions;
  }, [goalPositions]);
  useEffect(() => {
    campfirePositionsRef.current = campfirePositions;
  }, [campfirePositions]);

  useEffect(() => {
    const pickTarget = () => {
      // Night: gather at campfires, or stay near center if no fires
      if (timePhase === 'night') {
        const fires = campfirePositionsRef.current;
        if (fires && fires.length > 0) {
          const fire = fires[Math.floor(Math.random() * fires.length)];
          const angle = Math.random() * Math.PI * 2;
          const radius = 1.2 + Math.random() * 1.5;
          const tx = (fire.x ?? fire[0] ?? 0) + Math.cos(angle) * radius;
          const tz = (fire.z ?? fire[2] ?? 0) + Math.sin(angle) * radius;
          const ty = getSurfaceHeightAt(terrainMap, tx, tz);
          setTarget(new THREE.Vector3(tx, ty, tz));
        } else {
          const tx = Math.random() * 2 - 1;
          const tz = Math.random() * 2 - 1;
          setTarget(new THREE.Vector3(tx, getSurfaceHeightAt(terrainMap, tx, tz), tz));
        }
        idleRotationRef.current = null;
        const delay = 4000 + Math.random() * 4000;
        timeoutRef.current = setTimeout(pickTarget, delay);
        return;
      }

      const goals = goalPositionsRef.current;
      const useGoalTarget = goals?.length > 0 && Math.random() < 0.35;

      if (useGoalTarget && goals.length > 0) {
        const pos = goals[Math.floor(Math.random() * goals.length)];
        if (Array.isArray(pos) && pos.length >= 3) {
          const px = pos[0];
          const pz = pos[2];
          const py = getSurfaceHeightAt(terrainMap, px, pz);
          setTarget(new THREE.Vector3(px, py, pz));
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
      const worldMin = -28;
      const worldMax = 28;
      for (let x = cxInt - maxRadius; x <= cxInt + maxRadius; x++) {
        for (let z = czInt - maxRadius; z <= czInt + maxRadius; z++) {
          if (x < worldMin || x > worldMax || z < worldMin || z > worldMax) continue;
          const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
          if (dist >= minRadius && dist <= maxRadius && isTerrainAllowed(terrainMap, x, z, allowedTerrain)) {
            validTiles.push({ x, z });
          }
        }
      }

      if (validTiles.length > 0) {
        const tile = validTiles[Math.floor(Math.random() * validTiles.length)];
        const ty = getSurfaceHeightAt(terrainMap, tile.x, tile.z);
        setTarget(new THREE.Vector3(tile.x, ty, tile.z));
        idleRotationRef.current = null;
      }

      const delay = 3000 + Math.random() * 5000;
      timeoutRef.current = setTimeout(pickTarget, delay);
    };

    timeoutRef.current = setTimeout(pickTarget, 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [terrainMap, allowedTerrain, timePhase, campfirePositions]);

  const walkSpeed = speed * 0.65; // Slightly reduced for a more relaxed pace

  const handlePet = () => {
    if (displayName === 'Spirit' && tourStep === 4 && typeof setTourStep === 'function') setTourStep(0);
    setIsInteracting(true);
    const now = Date.now();
    const cooldownPassed = now - lastPetTimeRef.current >= PET_COOLDOWN_MS;
    if (cooldownPassed && typeof earnEmbers === 'function') {
      earnEmbers(1);
      lastPetTimeRef.current = now;
      fireToast(`You pet the ${displayName}! ❤️ +1 Ember`);
    } else {
      fireToast(`Happy ${displayName}! ❤️`);
    }
    setTimeout(() => setIsInteracting(false), INTERACT_DURATION_MS);
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const surfaceY = getSurfaceHeightAt(terrainMap, groupRef.current.position.x, groupRef.current.position.z);

    if (isInteracting) {
      groupRef.current.position.y = surfaceY + zOffset + Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.3;
      return;
    }

    const distance = groupRef.current.position.distanceTo(target);

    if (distance > 0.1) {
      groupRef.current.position.lerp(target, delta * walkSpeed);
      groupRef.current.position.y = getSurfaceHeightAt(terrainMap, groupRef.current.position.x, groupRef.current.position.z) + zOffset;
      setIsWalking(true);
      idleRotationRef.current = null;

      const angle = Math.atan2(
        target.x - groupRef.current.position.x,
        target.z - groupRef.current.position.z
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, delta * walkSpeed * 3);
    } else {
      setIsWalking(false);
      // Night + at rest (reached target): ultra-slow, shallow "deep sleep" breathing
      if (timePhase === 'night') {
        groupRef.current.position.y = surfaceY + zOffset + Math.sin(state.clock.elapsedTime * 0.35) * 0.015;
      } else {
        groupRef.current.position.y = surfaceY + zOffset;
      }

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
    <group
      ref={groupRef}
      position={[0, zOffset, 0]}
      onPointerDown={(e) => { e.stopPropagation(); handlePet(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
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

