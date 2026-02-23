import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder } from '@react-three/drei';

export default function Butterfly3D() {
  const wings = useRef();
  const group = useRef();
  useFrame((state) => {
    if (group.current) group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
    if (wings.current) wings.current.rotation.z = Math.sin(state.clock.elapsedTime * 25) * 0.6;
  });
  return (
    <group ref={group} scale={0.3}>
      <Cylinder args={[0.02, 0.02, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#1e293b" />
      </Cylinder>
      <group ref={wings}>
        <Box args={[0.2, 0.01, 0.15]} position={[-0.1, 0, 0]}>
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.8} />
        </Box>
        <Box args={[0.2, 0.01, 0.15]} position={[0.1, 0, 0]}>
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.8} />
        </Box>
      </group>
    </group>
  );
}
