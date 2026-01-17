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
  Shapes
} from 'lucide-react';
import { AppState, VoxelObject } from './types';
import { analyzeRoomImage, analyzeSingleObject } from './services/geminiService';
import VoxelScene from './components/VoxelScene';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    image: null,
    roomData: null,
    toolbox: [],
    isProcessing: false,
    processingMode: 'room',
    selectedObjectId: null,
    error: null,
    roomSizeFeet: 12
  });

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
        setState(prev => ({ ...prev, roomData: data, isProcessing: false }));
      } else {
        const spawnPos: [number, number, number] = [state.roomSizeFeet / 2, 0.5, state.roomSizeFeet / 2];
        const object = await analyzeSingleObject(state.image, spawnPos);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.selectedObjectId || !state.roomData) return;
      const moveStep = 0.5;
      const rotStep = Math.PI / 2;

      setState(prev => {
        if (!prev.roomData || !prev.selectedObjectId) return prev;
        const objectsArray = prev.roomData.objects || [];
        const newObjects = objectsArray.map(obj => {
          if (obj.id !== prev.selectedObjectId) return obj;
          let [x, y, z] = obj.position;
          let rotation = obj.rotation;
          switch(e.key) {
            case 'ArrowUp': z -= moveStep; break;
            case 'ArrowDown': z += moveStep; break;
            case 'ArrowLeft': x -= moveStep; break;
            case 'ArrowRight': x += moveStep; break;
            case 'r':
            case 'R': rotation = (rotation + rotStep) % (Math.PI * 2); break;
            default: return obj;
          }
          return { ...obj, position: [x, y, z] as [number, number, number], rotation };
        });
        return { ...prev, roomData: { ...prev.roomData, objects: newObjects } };
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedObjectId, state.roomData]);

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
      {/* ... existing header ... */}
      
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
                  Scan Room
                </button>
                <button 
                  onClick={() => setState(prev => ({ ...prev, processingMode: 'object' }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${state.processingMode === 'object' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Scan Object
                </button>
              </div>

              {!state.roomData && !state.isProcessing && (
                <section className="space-y-4">
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {state.processingMode === 'room' ? 'Capture Environment' : 'Capture Detail Item'}
                  </h2>
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

                  {state.image && (
                    <button
                      onClick={processImage}
                      disabled={state.isProcessing}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all"
                    >
                      <RefreshCw className={`w-5 h-5 ${state.isProcessing ? 'animate-spin' : ''}`} />
                      {state.processingMode === 'room' ? 'VOXELIZE ROOM' : 'EXTRACT OBJECT'}
                    </button>
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
                        onClick={() => setState(prev => ({ ...prev, selectedObjectId: obj.id }))}
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
              onSelectObject={(id) => setState(prev => ({ ...prev, selectedObjectId: id }))}
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
                <button onClick={() => setState(prev => ({ ...prev, selectedObjectId: null }))} className="p-1 hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase text-indigo-400/60">
                  <div className="bg-slate-950/50 p-2 rounded-lg flex items-center gap-2 justify-center"><Move className="w-3 h-3" /> Arrows</div>
                  <div className="bg-slate-950/50 p-2 rounded-lg flex items-center gap-2 justify-center"><RotateCw className="w-3 h-3" /> Key R</div>
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
