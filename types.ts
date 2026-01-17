export interface VoxelPart {
  offset: [number, number, number];
  dimensions: [number, number, number];
  color?: string;
}

export interface VoxelObject {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  rotation: number;
  parts: VoxelPart[];
  color: string;
  description: string;
  visible?: boolean;
  price?: number;
}

export interface RoomData {
  objects: VoxelObject[];
  wallColor: string;
  floorColor: string;
  dimensions?: {
    width: number;
    depth: number;
  };
}

export interface AppState {
  image: string | null;
  roomData: RoomData | null;
  isProcessing: boolean;
  processingMode: 'room' | 'object';
  selectedObjectId: string | null;
  selectedPartIndex: number | null;
  error: string | null;
  roomSizeFeet: number;
}
