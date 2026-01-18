import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Box, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { RoomData } from '../types';
import VoxelObject from './VoxelObject';

interface VoxelSceneProps {
  roomData: RoomData;
  selectedObjectId: string | null;
  selectedPartIndex: number | null;
  onSelectObject: (id: string, partIndex?: number | null) => void;
}

const VoxelScene: React.FC<VoxelSceneProps> = ({
  roomData,
  selectedObjectId,
  selectedPartIndex,
  onSelectObject
}) => {
  const controlsRef = useRef<any>(null);

  // Use dimensions from roomData or default to 12x12
  let ROOM_WIDTH = roomData.dimensions?.width || 12;
  let ROOM_DEPTH = roomData.dimensions?.depth || 12;

  // Calculate max bounds from objects to ensure they fit
  const maxX = Math.max(...(roomData.objects || []).map(obj => {
    const maxPart = Math.max(...(obj.parts || []).map(p => (p.offset[0] || 0) + (p.dimensions[0] || 0)));
    return (obj.position[0] || 0) + maxPart;
  }), ROOM_WIDTH);

  const maxZ = Math.max(...(roomData.objects || []).map(obj => {
    const maxPart = Math.max(...(obj.parts || []).map(p => (p.offset[2] || 0) + (p.dimensions[2] || 0)));
    return (obj.position[2] || 0) + maxPart;
  }), ROOM_DEPTH);

  // Extend room if objects exceed bounds (add 1 unit padding)
  ROOM_WIDTH = Math.max(ROOM_WIDTH, maxX + 1);
  ROOM_DEPTH = Math.max(ROOM_DEPTH, maxZ + 1);

  const HALF_WIDTH = ROOM_WIDTH / 2;
  const HALF_DEPTH = ROOM_DEPTH / 2;
  const WALL_HEIGHT = 8; // ~8 foot walls

  return (
    <div className="w-full h-full bg-gradient-to-b from-[#a5c9f3] to-[#87CEEB]">
      <Canvas
        shadows
        orthographic
        camera={{ position: [20, 20, 20], zoom: 40, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Environment preset="city" />
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[30, 60, 30]}
            intensity={1.3}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />

          <group position={[HALF_WIDTH, 0, HALF_DEPTH]}>
            {/* Floor */}
            <Box args={[ROOM_WIDTH + 0.5, 0.5, ROOM_DEPTH + 0.5]} position={[0, -0.25, 0]} receiveShadow>
              <meshStandardMaterial 
                color={roomData.floorColor || '#94a3b8'} 
                roughness={0.7}
                metalness={0.1}
              />
              <Outlines thickness={2} color="#000000" />
            </Box>

            {/* Left wall */}
            <group position={[-HALF_WIDTH - 0.25, 0, 0]}>
              <Box args={[0.5, WALL_HEIGHT, ROOM_DEPTH + 0.5]} position={[0, WALL_HEIGHT/2, 0]} receiveShadow>
                <meshStandardMaterial 
                  color={roomData.wallColor || '#cbd5e1'}
                  roughness={0.8}
                />
                <Outlines thickness={2} color="#000000" />
              </Box>
            </group>

            {/* Front wall */}
            <group position={[0, 0, -HALF_DEPTH - 0.25]}>
              <Box args={[ROOM_WIDTH + 0.5, WALL_HEIGHT, 0.5]} position={[0, WALL_HEIGHT/2, 0]} receiveShadow>
                <meshStandardMaterial 
                  color={roomData.wallColor || '#cbd5e1'}
                  roughness={0.8}
                />
                <Outlines thickness={2} color="#000000" />
              </Box>
            </group>
          </group>

          {(roomData.objects || []).map((obj) => (
            <VoxelObject
              key={obj.id}
              object={obj}
              isSelected={selectedObjectId === obj.id}
              selectedPartIndex={selectedObjectId === obj.id ? selectedPartIndex : null}
              onSelect={onSelectObject}
            />
          ))}

          <ContactShadows
            position={[HALF_WIDTH, 0.05, HALF_DEPTH]}
            opacity={0.3}
            scale={Math.max(ROOM_WIDTH, ROOM_DEPTH) * 1.5}
            blur={2}
            far={10}
            color="#000000"
          />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.1}
            enablePan={true}
            enableZoom={true}
            rotateSpeed={0.5}
            dampingFactor={0.1}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default VoxelScene;
