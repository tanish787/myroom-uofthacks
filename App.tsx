import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  RefreshCw,
  X,
  ImageIcon,
  Camera,
  Eye,
  EyeOff,
  Download,
  Move,
  RotateCw,
  Archive,
  PackagePlus,
  PlusCircle,
  Shapes,
  Send,
  Sparkles,
  MessageSquare,
  User as UserIcon,
  ShoppingBag,
  Search
} from 'lucide-react';
import { AppState, VoxelObject, ChatMessage, RoomData } from './types';
import { analyzeRoomImage, analyzeSingleObject, autoDecorate, refineObject } from './services/geminiService';
import VoxelScene from './components/VoxelScene';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    user: null,
    showAuth: false,
    showListingCreator: false,
    image: null,
    roomData: null,
    toolbox: [],
    isProcessing: false,
    processingMode: 'room',
    selectedObjectId: null,
    selectedPartIndex: null,
    error: null,
    roomSizeFeet: 12,
    chatHistory: [],
    marketplaceItems: [],
    searchResults: [],
    isSearching: false
  });

  const [authInput, setAuthInput] = useState({ email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [chatInput, setChatInput] = useState('');

  const [listingForm, setListingForm] = useState({
    name: '',
    price: '',
    description: '',
    type: 'furniture',
    imageUrl: ''
  });

  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.selectedObjectId || !state.roomData) return;
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;

      const MOVE_STEP = 0.5;
      const PART_MOVE_STEP = 0.1;

      setState(prev => {
        if (!prev.roomData || !prev.selectedObjectId) return prev;

        const newObjects = [...prev.roomData.objects];
        const objIndex = newObjects.findIndex(o => o.id === prev.selectedObjectId);
        if (objIndex === -1) return prev;

        const obj = { ...newObjects[objIndex] };

        // Handle Object Rotation
        if (e.key.toLowerCase() === 'r') {
          obj.rotation = (obj.rotation + Math.PI / 4) % (Math.PI * 2);
        }

        // Handle Object/Part Movement
        if (prev.selectedPartIndex !== null) {
          const parts = [...obj.parts];
          const part = { ...parts[prev.selectedPartIndex] };

          if (e.key === 'ArrowUp') part.offset[2] -= PART_MOVE_STEP;
          if (e.key === 'ArrowDown') part.offset[2] += PART_MOVE_STEP;
          if (e.key === 'ArrowLeft') part.offset[0] -= PART_MOVE_STEP;
          if (e.key === 'ArrowRight') part.offset[0] += PART_MOVE_STEP;
          if (e.key.toLowerCase() === 'q') part.offset[1] += PART_MOVE_STEP;
          if (e.key.toLowerCase() === 'e') part.offset[1] -= PART_MOVE_STEP;

          parts[prev.selectedPartIndex] = part;
          obj.parts = parts;
        } else {
          if (e.key === 'ArrowUp') obj.position[2] -= MOVE_STEP;
          if (e.key === 'ArrowDown') obj.position[2] += MOVE_STEP;
          if (e.key === 'ArrowLeft') obj.position[0] -= MOVE_STEP;
          if (e.key === 'ArrowRight') obj.position[0] += MOVE_STEP;
          if (e.key.toLowerCase() === 'q') obj.position[1] += MOVE_STEP;
          if (e.key.toLowerCase() === 'e') obj.position[1] -= MOVE_STEP;
        }

        newObjects[objIndex] = obj;
        return { ...prev, roomData: { ...prev.roomData!, objects: newObjects } };
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedObjectId, state.selectedPartIndex, state.roomData]);

  const handleChat = async () => {
    if (!chatInput.trim() || !state.roomData || state.isProcessing) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    setState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, userMessage],
      isProcessing: true,
      error: null
    }));
    setChatInput('');

    try {
      const result = await autoDecorate(state.roomData, chatInput);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.assistantMessage || "I've updated your room based on your request!"
      };

      setState(prev => {
        if (!prev.roomData) return prev;

        let newObjects = [...prev.roomData.objects];

        // Remove objects
        if (result.remove) {
          newObjects = newObjects.filter(obj => !result.remove.includes(obj.id));
        }

        // Update objects
        if (result.update) {
          newObjects = newObjects.map(obj => {
            const update = result.update.find((u: any) => u.id === obj.id);
            return update ? { ...obj, ...update } : obj;
          });
        }

        // Add objects
        if (result.add) {
          const added = result.add.map((obj: any, idx: number) => ({
            ...obj,
            id: obj.id || `ai-add-${Date.now()}-${idx}`,
            visible: true,
            position: obj.position || [prev.roomSizeFeet/2, 0.5, prev.roomSizeFeet/2]
          }));
          newObjects = [...newObjects, ...added];
        }

        return {
          ...prev,
          roomData: { ...prev.roomData, objects: newObjects },
          chatHistory: [...prev.chatHistory, assistantMessage],
          isProcessing: false
        };
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: "Chat error: " + err.message,
        chatHistory: [...prev.chatHistory, { role: 'assistant', content: "Sorry, I had trouble processing that request." }]
      }));
    }
  };

  const handleAuth = async () => {
    const endpoint = isRegistering ? 'register' : 'login';
    try {
      console.log(`Attempting ${endpoint} at http://localhost:5001/${endpoint}`);
      const res = await fetch(`http://localhost:5001/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authInput)
      });

      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(errorData || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (!isRegistering) {
        setState(prev => ({ ...prev, user: data, showAuth: false }));
        // Automatically load room after login
        loadRoom(data.userId || data.id); // Assuming backend sends userId
      } else {
        setIsRegistering(false);
        alert('Registered! Please login.');
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      alert(`Connection error: ${err.message}`);
    }
  };

  const saveRoom = async () => {
    if (!state.user || !state.roomData) {
      alert("Please login and create a room first!");
      return;
    }

    try {
      const res = await fetch('http://localhost:5001/save-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: (state.user as any).userId,
          roomData: state.roomData
        })
      });

      if (res.ok) {
        alert('Room saved to cloud!');
      } else {
        throw new Error('Failed to save room');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving room');
    }
  };

  const loadRoom = async (userIdOverride?: string) => {
    const userId = userIdOverride || (state.user as any)?.userId;
    if (!userId) return;

    try {
      const res = await fetch(`http://localhost:5001/load-room/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setState(prev => ({
            ...prev,
            roomData: data,
            roomSizeFeet: data.dimensions?.width || 12
          }));
        }
      }
    } catch (err) {
      console.error('Load error:', err);
    }
  };

  const searchMarketplace = async (query?: string) => {
    const s = query !== undefined ? query : marketplaceSearch;
    try {
      const res = await fetch(`http://localhost:5001/marketplace?search=${s}`);
      const data = await res.json();
      if (res.ok) {
        setState(prev => ({ ...prev, marketplaceItems: data }));
      }
    } catch (err) {
      console.error('Marketplace search error', err);
    }
  };

  useEffect(() => {
    if (state.processingMode === 'marketplace') {
      searchMarketplace();
    }
  }, [state.processingMode]);

  // Debounced marketplace search
  useEffect(() => {
    if (state.processingMode === 'marketplace') {
      if (searchTimeout) clearTimeout(searchTimeout);
      const timeout = setTimeout(() => {
        searchMarketplace(marketplaceSearch);
      }, 300);
      setSearchTimeout(timeout);
    }
  }, [marketplaceSearch]);

  const createListing = async () => {
    if (!selectedObject || !state.user) return;
    try {
      const res = await fetch('http://localhost:5001/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...listingForm,
          color: selectedObject.color,
          creator: state.user.email,
          data: selectedObject
        })
      });
      if (res.ok) {
        alert('Listing created!');
        setState(prev => ({ ...prev, showListingCreator: false }));
        setListingForm({ name: '', price: '', description: '', type: 'furniture', imageUrl: '' });
        searchMarketplace();
      }
    } catch (err) {
      alert('Error creating listing');
    }
  };

  const deleteListing = async (id: string) => {
    if (!state.user) return;
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      const res = await fetch(`http://localhost:5001/marketplace/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.user.email })
      });
      if (res.ok) {
        searchMarketplace();
      }
    } catch (err) {
      alert('Error deleting listing');
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setState(prev => ({ ...prev, image: e.target?.result as string, error: null }));
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!state.image) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      if (state.processingMode === 'room') {
        const data = await analyzeRoomImage(state.image, state.roomSizeFeet);

        // Auto-refine each object in the room
        const refinedObjects = await Promise.all(
          (data.objects || []).map(async (obj) => {
            try {
              // Note: Room image is passed for context, but refinement focus is the object JSON
              return await refineObject(state.image!, obj);
            } catch (e) {
              return obj; // Fallback to original
            }
          })
        );

        setState(prev => ({
          ...prev,
          roomData: { ...data, objects: refinedObjects },
          isProcessing: false
        }));
      } else {
        const spawnPos: [number, number, number] = [state.roomSizeFeet / 2, 0.5, state.roomSizeFeet / 2];
        let object = await analyzeSingleObject(state.image, spawnPos);

        // Immediate refinement pass
        try {
          object = await refineObject(state.image, object);
        } catch (e) {
          console.warn("Refinement failed, using initial generation");
        }

        setState(prev => ({
          ...prev,
          toolbox: [...(prev.toolbox || []), object],
          isProcessing: false,
          image: null
        }));
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, isProcessing: false, error: err.message }));
    }
  };

  const addToToolbox = () => {
    const obj = state.roomData?.objects?.find(o => o.id === state.selectedObjectId);
    if (obj) {
      setState(prev => ({
        ...prev,
        toolbox: [...(prev.toolbox || []), { ...obj, id: `tb-${Date.now()}` }]
      }));
    }
  };

  const placeFromToolbox = (toolboxObj: VoxelObject) => {
    setState(prev => {
      const baseRoom = prev.roomData || {
        wallColor: '#cbd5e1',
        floorColor: '#94a3b8',
        objects: [],
        dimensions: { width: prev.roomSizeFeet, depth: prev.roomSizeFeet }
      };
      const newId = `placed-${Date.now()}`;
      const spawnPos: [number, number, number] = [prev.roomSizeFeet / 2, 0.5, prev.roomSizeFeet / 2];
      return {
        ...prev,
        roomData: {
          ...baseRoom,
          objects: [...(baseRoom.objects || []), { ...toolboxObj, id: newId, position: spawnPos }]
        },
        selectedObjectId: newId,
        processingMode: 'room'
      };
    });
  };

  const exportToJson = () => {
    if (!state.roomData) return;
    const dataStr = JSON.stringify(state.roomData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'voxel-room.json';
    link.click();
  };

  const toggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => {
      if (!prev.roomData) return prev;
      const newObjects = (prev.roomData.objects || []).map(obj =>
        obj.id === id ? { ...obj, visible: !(obj.visible !== false) } : obj
      );
      return { ...prev, roomData: { ...prev.roomData, objects: newObjects } };
    });
  };

  const selectedObject = useMemo(() =>
    state.roomData?.objects?.find(o => o.id === state.selectedObjectId),
    [state.roomData, state.selectedObjectId]
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black italic uppercase tracking-tighter leading-none">VoxelRoom</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Architect Pro</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {state.user ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-500">{state.user.email}</span>
              <button
                onClick={() => setState(prev => ({ ...prev, user: null }))}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setState(prev => ({ ...prev, showAuth: true }))}
              className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200"
            >
              <UserIcon className="w-4 h-4" /> Login
            </button>
          )}
        </div>
      </header>

      {state.showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-96 bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase italic">{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
              <button onClick={() => setState(prev => ({ ...prev, showAuth: false }))}><X className="w-6 h-6 text-slate-300 hover:text-slate-900" /></button>
            </div>
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                value={authInput.email}
                onChange={e => setAuthInput({...authInput, email: e.target.value})}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                value={authInput.password}
                onChange={e => setAuthInput({...authInput, password: e.target.value})}
              />
              <button
                onClick={handleAuth}
                className="w-full py-4 bg-indigo-600 text-white font-black uppercase rounded-2xl shadow-xl shadow-indigo-100"
              >
                {isRegistering ? 'Sign Up' : 'Log In'}
              </button>
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="w-full text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600"
              >
                {isRegistering ? 'Already have an account? Login' : 'New here? Create account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {state.showListingCreator && selectedObject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="w-[500px] bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2.5 rounded-2xl">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight">List for Sale</h2>
              </div>
              <button onClick={() => setState(prev => ({ ...prev, showListingCreator: false }))} className="p-2 hover:bg-slate-100 rounded-full transition-colors mb-4">
                <X className="w-6 h-6 text-slate-300 hover:text-slate-900" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="aspect-video bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group">
                {listingForm.imageUrl ? (
                  <img src={listingForm.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <VoxelScene
                    roomData={{ objects: [{ ...selectedObject, position: [0, 0, 0], rotation: 0 }], wallColor: '#f8fafc', floorColor: '#f1f5f9', dimensions: { width: 5, depth: 5 } }}
                    selectedObjectId={null}
                    selectedPartIndex={null}
                    onSelectObject={() => {}}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/50 to-transparent flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                     <Camera className="w-3 h-3" /> Custom Image
                     <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onload = (re) => setListingForm({...listingForm, imageUrl: re.target?.result as string});
                         reader.readAsDataURL(file);
                       }
                     }} />
                   </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Display Name</label>
                  <input
                    placeholder="E.g. Cyber Chair"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={listingForm.name}
                    onChange={e => setListingForm({...listingForm, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Asking Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">$</span>
                    <input
                      placeholder="5.00"
                      className="w-full p-4 pl-8 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={listingForm.price}
                      onChange={e => setListingForm({...listingForm, price: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Description</label>
                <textarea
                  placeholder="Tell buyers about your creation..."
                  rows={3}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  value={listingForm.description}
                  onChange={e => setListingForm({...listingForm, description: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Category</label>
                <div className="flex gap-2">
                  {['furniture', 'decor', 'lighting', 'structure'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setListingForm({...listingForm, type: cat})}
                      className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${
                        listingForm.type === cat ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={createListing}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] text-sm font-black uppercase shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <PackagePlus className="w-5 h-5" /> Publish to Market
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r bg-white flex flex-col overflow-y-auto">
          <div className="p-4 space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Room Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Room Size (Feet)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="6"
                      max="30"
                      value={state.roomSizeFeet}
                      onChange={(e) => setState(prev => ({ ...prev, roomSizeFeet: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8">{state.roomSizeFeet}'</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
              <div className="flex p-1 bg-slate-900 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setState(prev => ({ ...prev, processingMode: 'room' }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${state.processingMode === 'room' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Room
                </button>
                <button
                  onClick={() => setState(prev => ({ ...prev, processingMode: 'object' }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${state.processingMode === 'object' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Object
                </button>
                <button
                  onClick={() => setState(prev => ({ ...prev, processingMode: 'chat' }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${state.processingMode === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setState(prev => ({ ...prev, processingMode: 'marketplace' }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${state.processingMode === 'marketplace' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Shop
                </button>
              </div>

              {state.processingMode === 'marketplace' && (
                <section className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search Shop..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      value={marketplaceSearch}
                      onChange={(e) => setMarketplaceSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchMarketplace(marketplaceSearch)}
                    />
                    <button onClick={() => searchMarketplace(marketplaceSearch)} className="p-2 bg-indigo-600 rounded-xl"><Search className="w-4 h-4 text-white" /></button>
                  </div>

                  {!state.user && (
                    <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase text-indigo-400 mb-2">Login to create listings</p>
                      <button onClick={() => setState(prev => ({ ...prev, showAuth: true }))} className="text-[9px] font-black uppercase bg-indigo-600 text-white px-3 py-1 rounded-lg">Sign In</button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    {state.marketplaceItems.length === 0 && (
                      <div className="text-center py-8 opacity-40">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase">No items found</p>
                      </div>
                    )}
                    {state.marketplaceItems.map(item => (
                      <div key={item._id} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 group hover:border-indigo-500 transition-all">
                        <div className="aspect-square bg-slate-950 rounded-2xl mb-4 overflow-hidden relative border border-slate-800">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-40">
                              <Box className="w-12 h-12 text-indigo-500" />
                            </div>
                          )}
                          <div className="absolute top-3 right-3 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-black uppercase">
                            ${item.price}
                          </div>
                        </div>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-white font-black uppercase italic text-sm leading-none">{item.name}</h4>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{item.type}</span>
                          </div>
                          {state.user?.email === item.creator && (
                            <button onClick={() => deleteListing(item._id!)} className="p-1.5 hover:bg-red-900/40 rounded-lg text-slate-600 hover:text-red-400 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {item.description && <p className="text-[10px] text-slate-400 italic mb-4 line-clamp-2">"{item.description}"</p>}
                        <button
                          onClick={() => placeFromToolbox(item.data)}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                        >
                          <PlusCircle className="w-4 h-4" /> Add to Room
                        </button>
                        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2">
                           <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center">
                             <UserIcon className="w-2.5 h-2.5 text-slate-500" />
                           </div>
                           <span className="text-[8px] font-bold text-slate-600 uppercase truncate">{item.creator}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {state.processingMode === 'chat' && (
                <section className="flex flex-col h-[400px] space-y-4">
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {state.chatHistory.length === 0 && (
                      <div className="text-center py-8 opacity-40">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase">Start a design conversation</p>
                      </div>
                    )}
                    {state.chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-medium leading-relaxed ${
                          msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {state.isProcessing && (
                      <div className="flex justify-start">
                        <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700 animate-pulse">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                      placeholder="e.g. 'Add a cozy rug and a plant'"
                      className="w-full bg-slate-900 border border-slate-800 text-white text-[11px] p-4 pr-12 rounded-2xl focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <button
                      onClick={handleChat}
                      disabled={!state.roomData || state.isProcessing}
                      className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </section>
              )}

              {(state.processingMode === 'room' || state.processingMode === 'object') && !state.isProcessing && (
                <section className="space-y-4">
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {state.processingMode === 'room' ? 'Capture Environment' : 'Capture Detail Item'}
                  </h2>
                  
                  {state.processingMode === 'room' && state.roomData ? (
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-3">Room is active. Clear or export to start fresh.</p>
                      <button 
                        onClick={() => setState(prev => ({ ...prev, roomData: null, selectedObjectId: null, image: null }))}
                        className="w-full py-2 bg-slate-800 hover:bg-red-950/40 text-[9px] font-black uppercase rounded-lg border border-slate-700 transition-all"
                      >
                        Clear Current Room
                      </button>
                    </div>
                  ) : (
                    <label className="group relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-800 rounded-3xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all overflow-hidden bg-slate-900/40">
                      {state.image ? (
                        <img src={state.image} className="w-full h-full object-cover opacity-60" alt="Preview" />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center">
                          <Camera className="w-10 h-10 text-slate-700 mb-4 group-hover:text-indigo-500 transition-colors" />
                          <p className="text-xs font-bold text-slate-500">Snap Photo</p>
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}

                  {state.image && !state.isProcessing && (
                    <div className="flex gap-2">
                       <button
                        onClick={processImage}
                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-50 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all"
                      >
                        <RefreshCw className="w-5 h-5" />
                        {state.processingMode === 'room' ? 'VOXELIZE ROOM' : 'EXTRACT OBJECT'}
                      </button>
                      <button onClick={() => setState(prev => ({ ...prev, image: null }))} className="p-4 bg-slate-800 text-slate-400 rounded-2xl">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </section>
              )}

              {state.isProcessing && (
                <div className="flex flex-col items-center justify-center h-48 text-center animate-pulse">
                  <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                  <h3 className="text-xs font-black italic uppercase tracking-widest text-indigo-400">
                    {state.processingMode === 'room' ? 'Mapping Geometry...' : 'Capturing Features...'}
                  </h3>
                </div>
              )}

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Archive className="w-3 h-3" /> Toolbox
                  </h2>
                  <span className="text-[10px] font-black text-indigo-500">{(state.toolbox || []).length} Items</span>
                </div>

                {selectedObject && state.user && (
                  <button
                    onClick={() => setState(prev => ({ ...prev, showListingCreator: true }))}
                    className="w-full py-3 bg-slate-900 border border-slate-800 text-indigo-400 text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" /> Sell Selected Item
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {(state.toolbox || []).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => placeFromToolbox(item)}
                      className="group relative aspect-square bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-3 hover:border-indigo-500 hover:bg-indigo-950/40 transition-all overflow-hidden"
                    >
                      <div className="w-10 h-10 rounded-lg mb-2 shadow-inner border border-white/5" style={{ backgroundColor: item.color }} />
                      <span className="text-[9px] font-black uppercase text-slate-400 truncate w-full text-center px-1 tracking-tight">{item.name}</span>
                      <div className="absolute inset-0 bg-indigo-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <PlusCircle className="w-6 h-6 text-white" />
                      </div>
                    </button>
                  ))}
                  {(state.toolbox || []).length === 0 && (
                    <div className="col-span-2 py-8 border border-dashed border-slate-800 rounded-2xl text-center text-[10px] font-bold text-slate-600 italic">
                      No assets found
                    </div>
                  )}
                </div>
              </section>

              {state.roomData && !state.isProcessing && (
                <section className="space-y-4 pt-4 border-t border-slate-800/50">
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Scene</h2>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {(state.roomData.objects || []).map(obj => (
                      <div
                        key={obj.id}
                        onClick={() => setState(prev => ({ ...prev, selectedObjectId: obj.id, selectedPartIndex: null }))}
                        className={`group w-full p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all border ${
                          state.selectedObjectId === obj.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/40 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-md border border-white/5" style={{ backgroundColor: obj.color }}></div>
                        <span className="text-[10px] font-bold truncate uppercase flex-1">{obj.name}</span>
                        <button onClick={(e) => toggleVisibility(obj.id, e)} className="p-1 hover:bg-white/10 rounded">
                          {obj.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-40" />}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setState(prev => ({ ...prev, roomData: null, selectedObjectId: null, image: null }))}
                    className="w-full py-3 bg-slate-900 text-slate-500 rounded-xl text-[10px] font-black uppercase border border-slate-800 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    Clear Scene
                  </button>

                  {state.user ? (
                    <button
                      onClick={saveRoom}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <Download className="w-5 h-5" /> Save to Cloud
                    </button>
                  ) : (
                    <button
                      onClick={exportToJson}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" /> Export JSON
                    </button>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>

        {/* Right Main Area */}
        <div className="flex-1 relative">
          {state.roomData ? (
            <VoxelScene
              roomData={state.roomData}
              selectedObjectId={state.selectedObjectId}
              selectedPartIndex={state.selectedPartIndex}
              onSelectObject={(id, partIndex = null) => setState(prev => ({
                ...prev,
                selectedObjectId: id,
                selectedPartIndex: partIndex === undefined ? null : partIndex
              }))}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#a5c9f3]">
               <div className="w-32 h-32 bg-white/20 rounded-[3rem] backdrop-blur-xl border border-white/30 flex items-center justify-center mb-8 animate-bounce">
                <Box className="w-16 h-16 text-white" />
               </div>
               <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter drop-shadow-lg text-center px-4 leading-tight">Ready to Build</h2>
               <p className="text-white/60 font-bold uppercase tracking-widest text-[10px] mt-4">Snap a photo to generate voxel blocks</p>
            </div>
          )}

          {selectedObject && (
            <div className="absolute bottom-8 left-8 w-80 bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 border border-slate-700/50 text-white animate-in slide-in-from-left-4 z-20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl shadow-inner border border-white/10" style={{ backgroundColor: selectedObject.color }}></div>
                  <div>
                    <h4 className="font-black text-base uppercase italic leading-none">{selectedObject.name}</h4>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1 block">{selectedObject.type}</span>
                  </div>
                </div>
                <button onClick={() => setState(prev => ({ ...prev, selectedObjectId: null, selectedPartIndex: null }))} className="p-1 hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase text-indigo-400/60">
                  <div className="bg-slate-950/50 p-2 rounded-lg flex items-center gap-2 justify-center"><Move className="w-3 h-3" /> Arrows</div>
                  <div className="bg-slate-950/50 p-2 rounded-lg flex items-center gap-2 justify-center"><span className="text-[10px]">Q / E</span> Vertical</div>
                  <div className="bg-slate-950/50 p-2 rounded-lg flex items-center gap-2 justify-center"><RotateCw className="w-3 h-3" /> Key R</div>
                </div>

                {/* Components / Parts Editor */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Shapes className="w-3 h-3" /> Components
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {(selectedObject.parts || []).map((part, idx) => (
                      <button
                        key={idx}
                        onClick={() => setState(prev => ({ ...prev, selectedPartIndex: prev.selectedPartIndex === idx ? null : idx }))}
                        className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                          state.selectedPartIndex === idx
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-4 h-4 rounded shadow-inner" style={{ backgroundColor: part.color || selectedObject.color }}></div>
                        <span className="text-[9px] font-bold uppercase">Part {idx + 1}</span>
                        {state.selectedPartIndex === idx && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-400 leading-relaxed italic">"{selectedObject.description}"</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={addToToolbox}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    <PackagePlus className="w-4 h-4" /> Save Asset
                  </button>
                  {state.user && (
                    <button
                      onClick={() => setState(prev => ({ ...prev, showListingCreator: true }))}
                      className="flex-1 py-3 bg-slate-900 border border-slate-800 text-indigo-400 text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                    >
                      <ShoppingBag className="w-4 h-4" /> Sell
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setState(prev => {
                        if (!prev.roomData) return prev;
                        const newObjects = (prev.roomData.objects || []).filter(o => o.id !== selectedObject.id);
                        return { ...prev, roomData: { ...prev.roomData, objects: newObjects }, selectedObjectId: null };
                      });
                    }}
                    className="p-3 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-white rounded-xl transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
