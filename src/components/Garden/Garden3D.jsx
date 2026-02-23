import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Billboard, Float, Text, Sparkles, Html, RoundedBox } from '@react-three/drei';
import { useGarden } from '../../context/GardenContext';
import { getGoalProgressPercent } from './GardenWalk';
import WanderingCreature from './WanderingCreature';
import ProceduralFlora from './ProceduralFlora';
import Mochi3D from './Mochi3D';

const TERRAIN_COLORS = {
  water: '#4facfe',
  stone: '#78716c',
  sand: '#d2b48c',
};

function TerrainTiles() {
  const { terrainMap } = useGarden();
  const entries = Object.entries(terrainMap ?? {});
  return (
    <>
      {entries.map(([key, material]) => {
        const [x, z] = key.split(',').map(Number);
        if (Number.isNaN(x) || Number.isNaN(z)) return null;
        const color = TERRAIN_COLORS[material] ?? TERRAIN_COLORS.stone;
        return (
          <RoundedBox
            key={key}
            args={[0.95, 0.2, 0.95]}
            radius={0.05}
            position={[x, -0.1, z]}
            receiveShadow
          >
            <meshStandardMaterial color={color} />
          </RoundedBox>
        );
      })}
    </>
  );
}

function Ground({ onClick }) {
  return (
    <RoundedBox
      args={[30, 0.5, 30]}
      radius={0.1}
      position={[0, -0.3, 0]}
      receiveShadow
      onClick={onClick}
    >
      <meshStandardMaterial color="#2d5a27" />
    </RoundedBox>
  );
}

function Tree({ position, goal }) {
  const [hovered, setHovered] = useState(false);
  const progress = getGoalProgressPercent(goal);
  const plantScale = 0.8 + (progress / 100) * 1.7;

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ProceduralFlora goal={goal} />
      <Sparkles
        position={[0, 1, 0]}
        count={15}
        scale={[plantScale, plantScale, plantScale]}
        size={plantScale * 2}
        speed={0.4}
        opacity={0.4}
        color="#a8c68a"
      />
      {hovered && (
        <Html position={[0, plantScale + 0.5, 0]} center zIndexRange={[100, 0]}>
          <div className="px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-stone-200 rounded-xl shadow-lg text-sm font-serif text-stone-800 whitespace-nowrap pointer-events-none transition-opacity duration-200">
            {goal?.title ?? 'Goal'}
          </div>
        </Html>
      )}
    </group>
  );
}

function SpiritGardener3D({ position = [0, 1.5, 0] }) {
  const { spiritConfig } = useGarden();
  const emoji = spiritConfig?.emoji || '🌸';
  const name = spiritConfig?.name || 'Mochi';

  return (
    <group position={position}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <Billboard follow={true}>
          <Text fontSize={2} anchorX="center" anchorY="middle">
            {emoji}
          </Text>
          <Text fontSize={0.6} color="#4a3f35" anchorX="center" anchorY="middle" position={[0, -1.5, 0]}>
            {name}
          </Text>
        </Billboard>
      </Float>
    </group>
  );
}

function Scene({ placedGoals, onPlant }) {
  return (
    <>
      <TerrainTiles />
      <Ground onClick={onPlant} />
      {placedGoals?.map((g) => (
        <Tree key={g.id} position={g.position3D} goal={g} />
      )) ?? null}
      <Ecosystem placedGoals={placedGoals} />
    </>
  );
}

function Ecosystem({ placedGoals }) {
  const { unlockedAnimals } = useGarden();
  const goalPositions = placedGoals
    ?.map((g) => g.position3D)
    .filter((p) => Array.isArray(p) && p.length >= 3) ?? [];

  return (
    <group name="ecosystem">
      {unlockedAnimals?.includes('fish') && (
        <WanderingCreature emoji="🐟" allowedTerrain="water" speed={0.8} zOffset={0.2} scale={0.7} />
      )}
      {unlockedAnimals?.includes('rabbit') && (
        <WanderingCreature emoji="🐇" allowedTerrain="grass" speed={2.5} jumpHeight={0.6} zOffset={0.4} scale={0.8} />
      )}
      <WanderingCreature
        customComponent={<Mochi3D isWalking={true} />}
        allowedTerrain="grass"
        speed={1.2}
        zOffset={0.5}
        scale={0.6}
        goalPositions={goalPositions}
      />
    </group>
  );
}

function fireToast(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message } }));
  }
}

export default function Garden3D() {
  const { goals, editGoal, activeTool, setActiveTool, paintTerrain, updateDecoration } = useGarden();
  const placedGoals = goals?.filter((g) => Array.isArray(g.position3D) && g.position3D.length >= 3) ?? [];
  const unplacedGoals = goals?.filter((g) => !g.position3D || !Array.isArray(g.position3D)) ?? [];

  const handlePlant = (e) => {
    e.stopPropagation();
    let { x, z } = e.point;
    x = Math.round(x);
    z = Math.round(z);

    if (activeTool?.type === 'paint') {
      paintTerrain(x, z, activeTool.material);
      return;
    }
    if (activeTool?.type === 'plant') {
      editGoal(activeTool.goalId, { position3D: [x, 0, z] });
      setActiveTool(null);
      return;
    }
    if (activeTool?.type === 'place') {
      updateDecoration(activeTool.decorationId, { position3D: [x, 0, z] });
      setActiveTool(null);
      return;
    }

    if (unplacedGoals.length === 0) {
      fireToast('No unplaced seeds left in your bag! 🎒');
      return;
    }
    const goal = unplacedGoals[0];
    editGoal(goal.id, { position3D: [x, 0, z] });
    fireToast(`Planted ${goal.title}! 🌱`);
  };

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-stone-200">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3 py-2 rounded-xl bg-stone-800/90 text-white text-sm font-medium shadow-lg">
        Tap the grass to plant a goal! 🌱
      </div>
      <Canvas shadows camera={{ position: [8, 6, 8], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <Sky sunPosition={[10, 20, 10]} />
        <Environment preset="forest" />
        <OrbitControls autoRotate autoRotateSpeed={0.5} enableDamping dampingFactor={0.05} />
        <SpiritGardener3D position={[0, 1.5, 0]} />
        <Scene placedGoals={placedGoals} onPlant={handlePlant} />
      </Canvas>
    </div>
  );
}
