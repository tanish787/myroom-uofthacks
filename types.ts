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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AppState {
  image: string | null;
  roomData: RoomData | null;
  toolbox: VoxelObject[];
  isProcessing: boolean;
  processingMode: 'room' | 'object' | 'chat';
  selectedObjectId: string | null;
  selectedPartIndex: number | null;
  error: string | null;
  roomSizeFeet: number;
  chatHistory: ChatMessage[];
}
