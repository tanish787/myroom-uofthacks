import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { VoxelObject } from '../types';
import { Box, Outlines } from '@react-three/drei';
import { X } from 'lucide-react';

interface VoxelPreviewProps {
  object: VoxelObject | null;
  onClose?: () => void;
  position?: 'bottom-right' | 'center';
  editable?: boolean;
  selectedPartIndex?: number | null;
  onSelectPart?: (index: number | null) => void;
  onUpdateObject?: (object: VoxelObject) => void;
}

interface PreviewObjectProps {
  object: VoxelObject;
  editable?: boolean;
  selectedPartIndex?: number | null;
  onSelectPart?: (index: number | null) => void;
}

const PreviewObject: React.FC<PreviewObjectProps> = ({ 
  object, 
  editable = false, 
  selectedPartIndex,
  onSelectPart 
}) => {
  return (
    <group position={[0, 0, 0]}>
      {(object.parts || []).map((part, index) => {
        const partColor = part.color || object.color;
        const isSelected = editable && selectedPartIndex === index;
        return (
          <group
            key={index}
            position={new THREE.Vector3(...(part.offset || [0, 0, 0]))}
            onClick={(e) => {
              if (editable && onSelectPart) {
                e.stopPropagation();
                onSelectPart(isSelected ? null : index);
              }
            }}
          >
            <Box args={part.dimensions || [1, 1, 1]}>
              <meshStandardMaterial
                color={isSelected ? '#818cf8' : partColor}
                roughness={0.4}
                metalness={0.1}
                emissive={isSelected ? '#818cf8' : '#000000'}
                emissiveIntensity={isSelected ? 0.6 : 0}
              />
              <Outlines thickness={isSelected ? 2.5 : 1.5} color={isSelected ? "#ffffff" : "#000000"} />
            </Box>
          </group>
        );
      })}
    </group>
  );
};

const VoxelPreview: React.FC<VoxelPreviewProps> = ({ 
  object, 
  onClose, 
  position = 'bottom-right',
  editable = false,
  selectedPartIndex = null,
  onSelectPart,
  onUpdateObject
}) => {
  if (!object) return null;

  const positionClasses = position === 'center' 
    ? 'relative w-64 h-64 sm:w-96 sm:h-96 mx-auto max-w-full' 
    : 'absolute bottom-8 right-8 w-64 h-64 sm:w-80 sm:h-80 max-w-[calc(100%-4rem)]';

  return (
    <div className={`${positionClasses} bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-700/50 overflow-hidden z-30`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-40 p-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-slate-300" />
        </button>
      )}
      <div className="absolute inset-0">
        <Canvas
          orthographic
          camera={{ position: [8, 8, 8], zoom: 50, near: 0.1, far: 100 }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Environment preset="city" />
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 10]} intensity={1} />

            {/* Floor grid for reference */}
            <Box args={[4, 0.1, 4]} position={[0, -0.05, 0]}>
              <meshStandardMaterial color="#94a3b8" roughness={0.8} />
            </Box>

            <PreviewObject 
              object={object} 
              editable={editable}
              selectedPartIndex={selectedPartIndex}
              onSelectPart={onSelectPart}
            />

            <OrbitControls
              makeDefault
              enableZoom={true}
              enablePan={false}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2}
              autoRotate={!editable}
              autoRotateSpeed={1}
            />
          </Suspense>
        </Canvas>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm p-3 border-t border-slate-700/50">
        <h4 className="text-xs font-black uppercase text-white mb-1">{object.name}</h4>
        <p className="text-[10px] text-slate-400 uppercase">{object.type}</p>
      </div>
    </div>
  );
};

export default VoxelPreview;
