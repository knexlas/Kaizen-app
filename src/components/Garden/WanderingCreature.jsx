import { useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { useGarden } from '../../context/GardenContext';

function getTerrainAt(terrainMap, x, z) {
  if (!terrainMap || typeof terrainMap !== 'object') return undefined;
  const key = `${Math.round(x)},${Math.round(z)}`;
  return terrainMap[key];
}

function isTerrainAllowed(terrainMap, x, z, allowedTerrain) {
  const tile = getTerrainAt(terrainMap, x, z);
  if (allowedTerrain === 'water') return tile === 'water';
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
  const [currentPos, setCurrentPos] = useState([0, 0, 0]);
  const [targetPos, setTargetPos] = useState([0, 0, 0]);
  const targetPosRef = useRef(targetPos);
  const startPosRef = useRef([0, 0, 0]);
  const currentPosRef = useRef(currentPos);
  const timeoutRef = useRef(null);
  const goalPositionsRef = useRef(goalPositions);

  useEffect(() => {
    goalPositionsRef.current = goalPositions;
  }, [goalPositions]);

  useEffect(() => {
    targetPosRef.current = targetPos;
  }, [targetPos]);

  useEffect(() => {
    currentPosRef.current = currentPos;
  }, [currentPos]);

  useEffect(() => {
    const pickTarget = () => {
      const goals = goalPositionsRef.current;
      const useGoalTarget = goals?.length > 0 && Math.random() < 0.35;

      if (useGoalTarget && goals.length > 0) {
        const pos = goals[Math.floor(Math.random() * goals.length)];
        if (Array.isArray(pos) && pos.length >= 3) {
          startPosRef.current = [...currentPosRef.current];
          setTargetPos([pos[0], pos[1] ?? 0, pos[2]]);
          const delay = 3000 + Math.random() * 5000;
          timeoutRef.current = setTimeout(pickTarget, delay);
          return;
        }
      }

      const [cx, , cz] = currentPosRef.current;
      let attempts = 0;
      const maxAttempts = 25;
      while (attempts < maxAttempts) {
        const x = Math.round(cx + (Math.floor(Math.random() * 7) - 3));
        const z = Math.round(cz + (Math.floor(Math.random() * 7) - 3));
        if (isTerrainAllowed(terrainMap, x, z, allowedTerrain)) {
          startPosRef.current = [...currentPosRef.current];
          setTargetPos([x, 0, z]);
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
    setCurrentPos((prev) => {
      const tx = targetPosRef.current[0];
      const tz = targetPosRef.current[2];
      const dx = (tx - prev[0]) * delta * speed;
      const dz = (tz - prev[2]) * delta * speed;
      let y = 0;
      if (jumpHeight > 0) {
        const start = startPosRef.current;
        const distTotal = Math.hypot(tx - start[0], tz - start[2]) || 0.001;
        const distToTarget = Math.hypot(tx - prev[0], tz - prev[2]);
        const progress = Math.max(0, 1 - distToTarget / distTotal);
        y = 4 * jumpHeight * progress * (1 - progress);
      }
      return [prev[0] + dx, y, prev[2] + dz];
    });
  });

  return (
    <group position={[currentPos[0], currentPos[1] + zOffset, currentPos[2]]}>
      {customComponent ? (
        <group scale={scale}>
          {customComponent}
        </group>
      ) : (
        <Billboard>
          <Text fontSize={scale}>{emoji}</Text>
        </Billboard>
      )}
    </group>
  );
}
