import React, { useEffect, useRef, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export default function AnimatedModel({ path, scale = 1, rotation = [0, 0, 0] }) {
  const group = useRef();
  const { scene, animations } = useGLTF(path);

  // Safely clone skinned meshes so we can place multiple of the same animal
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    if (names.length > 0) {
      // Look for an 'Idle', 'Walk', or 'Swim' animation, otherwise fallback to the first available
      const targetAnim =
        names.find((n) => n.toLowerCase().includes('idle')) ||
        names.find((n) => n.toLowerCase().includes('swim')) ||
        names.find((n) => n.toLowerCase().includes('walk')) ||
        names[0];

      if (actions[targetAnim]) {
        actions[targetAnim].reset().fadeIn(0.5).play();
      }
    }
  }, [actions, names]);

  return (
    <group ref={group} scale={scale} rotation={rotation}>
      <primitive object={clone} />
    </group>
  );
}
