import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { VoxelObject as VoxelObjectType } from '../types';

interface VoxelObjectProps {
  object: VoxelObjectType;
  isSelected: boolean;
  selectedPartIndex: number | null;
  onSelect: (id: string, partIndex?: number | null) => void;
}

const VoxelObject: React.FC<VoxelObjectProps> = ({
  object,
  isSelected,
  selectedPartIndex,
  onSelect
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, object.position[0], 0.2);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, object.position[2], 0.2);

      const targetY = isSelected
        ? object.position[1] + Math.sin(state.clock.elapsedTime * 4) * 0.1 + 0.2
        : object.position[1];

      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.2);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, object.rotation, 0.2);
    }
  });

  if (object.visible === false) return null;

  return (
    <group
      ref={groupRef}
      position={new THREE.Vector3(...object.position)}
      rotation={[0, object.rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(object.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {(object.parts || []).map((part, index) => {
        const isPartSelected = isSelected && selectedPartIndex === index;
        const partColor = part.color || object.color;
        let color = partColor;

        if (isPartSelected) {
          color = '#ffffff';
        } else if (isSelected) {
          // Keep original color but maybe dim others? No, lets stick to original for selected object
          color = partColor;
        } else if (hovered) {
          const c = new THREE.Color(partColor);
          c.offsetHSL(0, 0, 0.1);
          color = `#${c.getHexString()}`;
        }

        return (
          <group
            key={index}
            position={new THREE.Vector3(...(part.offset || [0,0,0]))}
            onClick={(e) => {
              if (isSelected) {
                e.stopPropagation();
                onSelect(object.id, index);
              }
            }}
          >
            <Box args={part.dimensions || [1,1,1]} castShadow receiveShadow>
              <meshStandardMaterial
                color={color}
                roughness={object.type === 'light' ? 0.1 : 0.4}
                metalness={0.1}
                emissive={object.type === 'light' ? partColor : isPartSelected ? '#ffffff' : isSelected ? '#333333' : '#000000'}
                emissiveIntensity={object.type === 'light' ? 1.0 : isPartSelected ? 0.6 : isSelected ? 0.2 : 0}
              />
              <Outlines thickness={isPartSelected ? 2.5 : 1.5} color={isPartSelected ? "#818cf8" : isSelected ? "#ffffff" : "#000000"} />
            </Box>
          </group>
        );
      })}

      {object.type === 'light' && (
        <pointLight intensity={1} distance={5} color={object.color} position={[0, 1, 0]} castShadow />
      )}
    </group>
  );
};

export default VoxelObject;
