import React, { useEffect, useRef, useMemo, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LowPerfContext } from './Garden3D';

export default function AnimatedModel({ path, scale = 1, rotation = [0, 0, 0], isWalking = false }) {
  const groupRef = useRef();
  const lowPerf = useContext(LowPerfContext);
  const { scene, animations } = useGLTF(path);

  // Safely clone skinned meshes and compute Y-offset so the bottom of the model sits at y = 0
  const { clone, yOffset } = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    if (lowPerf) {
      c.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    }
    c.updateMatrixWorld(true); // Force world matrix so Box3 height is correct (avoids buried models)
    const box = new THREE.Box3().setFromObject(c);
    const offset = box.min.y !== undefined && Number.isFinite(box.min.y) ? -box.min.y : 0;
    return { clone: c, yOffset: offset };
  }, [scene, lowPerf]);

  const { actions, names } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (names.length === 0) return;
    const walkAnim = names.find((n) => n.toLowerCase().includes('walk')) || names[0];
    const idleAnim = names.find((n) => n.toLowerCase().includes('idle')) || names.find((n) => n.toLowerCase().includes('swim')) || names[0];
    const nextName = isWalking ? walkAnim : idleAnim;
    const action = actions[nextName];
    if (!action) return;
    Object.values(actions).forEach((a) => a.stop());
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.3).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, names, isWalking]);

  // Procedural breathing when no baked animations (static model): gentle sine on scale.x / scale.y
  useFrame((state) => {
    if (names.length > 0 || !groupRef.current) return;
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 0.6) * 0.015;
    groupRef.current.scale.x = s;
    groupRef.current.scale.y = s;
  });

  return (
    <group scale={scale} rotation={rotation}>
      <group ref={groupRef} position={[0, yOffset, 0]}>
        <primitive object={clone} />
      </group>
    </group>
  );
}
