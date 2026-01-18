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
  isUserCreated?: boolean; // true if created by user, false if from shop
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
  user: { email: string; token: string } | null;
  showAuth: boolean;
  showListingCreator: boolean;
  image: string | null;
  roomData: RoomData | null;
  toolbox: VoxelObject[];
  isProcessing: boolean;
  processingMode: 'room' | 'object' | 'chat' | 'marketplace' | 'search';
  selectedObjectId: string | null;
  selectedPartIndex: number | null;
  error: string | null;
  roomSizeFeet: number;
  chatHistory: ChatMessage[];
  marketplaceItems: MarketplaceItem[];
  searchResults: VoxelObject[];
  isSearching: boolean;
}

export interface MarketplaceItem {
  _id?: string;
  id?: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  color: string;
  type: string;
  creator: string;
  data: VoxelObject;
  createdAt?: string;
  source?: string; // 'user' | 'shopify'
}
