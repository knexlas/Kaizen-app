import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

const RIVER_BASE = '/models/ground_river';
const PATHS = {
  tile: `${RIVER_BASE}Tile.glb`,
  straight: `${RIVER_BASE}Straight.glb`,
  corner: `${RIVER_BASE}Corner.glb`,
  end: `${RIVER_BASE}End.glb`,
  split: `${RIVER_BASE}Split.glb`,
  cross: `${RIVER_BASE}Cross.glb`,
};

Object.values(PATHS).forEach((path) => useGLTF.preload(path));

function TileModel({ path, rotation = 0, position }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={[0, rotation, 0]}
    />
  );
}

/** Bitmask: N=1, E=2, S=4, W=8. Returns { path, rotation } for river tiles. */
function getTileVariant(bitmask) {
  const map = {
    0: { path: PATHS.tile, rotation: 0 },
    1: { path: PATHS.end, rotation: 0 },
    2: { path: PATHS.end, rotation: -Math.PI / 2 },
    4: { path: PATHS.end, rotation: Math.PI },
    8: { path: PATHS.end, rotation: Math.PI / 2 },
    5: { path: PATHS.straight, rotation: 0 },
    10: { path: PATHS.straight, rotation: Math.PI / 2 },
    3: { path: PATHS.corner, rotation: 0 },
    6: { path: PATHS.corner, rotation: Math.PI / 2 },
    12: { path: PATHS.corner, rotation: Math.PI },
    9: { path: PATHS.corner, rotation: -Math.PI / 2 },
    7: { path: PATHS.split, rotation: Math.PI },
    11: { path: PATHS.split, rotation: Math.PI / 2 },
    13: { path: PATHS.split, rotation: -Math.PI / 2 },
    14: { path: PATHS.split, rotation: 0 },
    15: { path: PATHS.cross, rotation: 0 },
  };
  return map[bitmask] ?? { path: PATHS.tile, rotation: 0 };
}

export default function AutoTiler({ terrainMap, materialType = 'water' }) {
  const tiles = useMemo(() => {
    const map = terrainMap ?? {};
    return new Set(Object.keys(map).filter((k) => map[k] === materialType));
  }, [terrainMap, materialType]);

  const elements = useMemo(() => {
    const out = [];
    tiles.forEach((key) => {
      const [x, z] = key.split(',').map(Number);
      if (Number.isNaN(x) || Number.isNaN(z)) return;
      const n = tiles.has(`${x},${z - 1}`) ? 1 : 0;
      const e = tiles.has(`${x + 1},${z}`) ? 2 : 0;
      const s = tiles.has(`${x},${z + 1}`) ? 4 : 0;
      const w = tiles.has(`${x - 1},${z}`) ? 8 : 0;
      const bitmask = n + e + s + w;
      const { path, rotation } = getTileVariant(bitmask);
      out.push(
        <TileModel
          key={key}
          path={path}
          rotation={rotation}
          position={[x, 0, z]}
        />
      );
    });
    return out;
  }, [tiles]);

  return <>{elements}</>;
}
