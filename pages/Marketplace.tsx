import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ImageIcon,
  RefreshCw,
  X,
  ArrowLeft,
  Store,
  PlusCircle,
  Edit,
  Save,
  Trash2,
  Move3D
} from 'lucide-react';
import { useToolbox } from '../contexts/ToolboxContext';
import { analyzeSingleObject } from '../services/geminiService';
import VoxelPreview from '../components/VoxelPreview';
import { VoxelObject } from '../types';

const Marketplace: React.FC = () => {
  const { toolbox, addToToolbox } = useToolbox();
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewObject, setPreviewObject] = useState<VoxelObject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null);
  const [editorPosition, setEditorPosition] = useState({ x: 32, y: 32 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState<number | ''>('');

  const handlePreviewImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        setPreviewImage(base64Image);
        setIsProcessing(true);
        try {
        const spawnPos: [number, number, number] = [6, 0.5, 6];
        const object = await analyzeSingleObject(base64Image, spawnPos);
        setPreviewObject(object);
        setItemName(object.name || '');
        setItemDescription(object.description || '');
        setItemPrice('');
        setIsProcessing(false);
        } catch (err: any) {
          setIsProcessing(false);
          console.error('Error processing image:', err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectItem = (item: VoxelObject) => {
    setPreviewObject(item);
    setSelectedPartIndex(null);
    setIsEditMode(false);
    setItemName(item.name || '');
    setItemDescription(item.description || '');
    setItemPrice(item.price || '');
  };

  const handleAddToToolbox = () => {
    if (previewObject) {
      const updatedObject = {
        ...previewObject,
        name: itemName || previewObject.name,
        description: itemDescription || previewObject.description,
        price: typeof itemPrice === 'number' ? itemPrice : undefined
      };
      addToToolbox(updatedObject);
    }
  };

  const handleUpdatePart = (partIndex: number, updates: Partial<import('../types').VoxelPart>) => {
    if (!previewObject) return;
    
    const newParts = [...(previewObject.parts || [])];
    newParts[partIndex] = { ...newParts[partIndex], ...updates };
    setPreviewObject({ ...previewObject, parts: newParts });
  };

  const handleRegenerate = async () => {
    if (!previewImage) return;
    
    setIsProcessing(true);
    try {
      const spawnPos: [number, number, number] = [6, 0.5, 6];
      const object = await analyzeSingleObject(previewImage, spawnPos);
      setPreviewObject(object);
      setSelectedPartIndex(null);
      setIsEditMode(false);
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      console.error('Error regenerating model:', err);
    }
  };

  const handleAddPart = () => {
    if (!previewObject) return;
    
    const newPart: import('../types').VoxelPart = {
      offset: [0, 0, 0],
      dimensions: [1, 1, 1],
      color: previewObject.color
    };
    setPreviewObject({
      ...previewObject,
      parts: [...(previewObject.parts || []), newPart]
    });
    setSelectedPartIndex((previewObject.parts || []).length);
  };

  const handleDeletePart = (partIndex: number) => {
    if (!previewObject || !previewObject.parts) return;
    
    const newParts = previewObject.parts.filter((_, idx) => idx !== partIndex);
    setPreviewObject({ ...previewObject, parts: newParts });
    setSelectedPartIndex(null);
  };

  const selectedPart = previewObject && selectedPartIndex !== null 
    ? previewObject.parts?.[selectedPartIndex] 
    : null;

  // Keyboard controls for editing parts (similar to room editor)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditMode || !previewObject || selectedPartIndex === null) return;

      const moveStep = 0.5;
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'q', 'Q', 'e', 'E'];

      if (!keys.includes(e.key)) return;

      // Prevent scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      const part = previewObject.parts?.[selectedPartIndex];
      if (!part) return;

      let [ox, oy, oz] = part.offset;
      switch(e.key) {
        case 'ArrowUp': oz -= moveStep; break;
        case 'ArrowDown': oz += moveStep; break;
        case 'ArrowLeft': ox -= moveStep; break;
        case 'ArrowRight': ox += moveStep; break;
        case 'q':
        case 'Q': oy += moveStep; break;
        case 'e':
        case 'E': oy -= moveStep; break;
        default: return;
      }

      // Update part directly using setState to avoid dependency issues
      if (!previewObject) return;
      const newParts = [...(previewObject.parts || [])];
      newParts[selectedPartIndex] = { ...newParts[selectedPartIndex], offset: [ox, oy, oz] };
      setPreviewObject({ ...previewObject, parts: newParts });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, previewObject, selectedPartIndex]);

  const filteredItems = toolbox.filter(item =>
    !searchQuery ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Drag handlers for editor panel
  const handleEditorMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Constrain to viewport bounds
      const maxX = window.innerWidth - 256; // panel width
      const maxY = window.innerHeight - 100;
      
      setEditorPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-black italic text-slate-900">Marketplace</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Item Browser */}
        <div className="w-80 sm:w-96 border-r bg-white flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-6 space-y-6">
            {/* Search Section */}
            <section className="space-y-4">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Search className="w-3 h-3" /> Search Items
              </h2>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/40 border border-slate-800 rounded-xl text-sm font-bold text-slate-700 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </section>

            {/* Image Upload Section */}
            <section className="space-y-4">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Upload Image to Preview
              </h2>
              <label className="group relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all overflow-hidden bg-slate-900/40">
                {previewImage ? (
                  <img src={previewImage} className="w-full h-full object-cover opacity-60" alt="Preview" />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <ImageIcon className="w-10 h-10 text-slate-700 mb-3 group-hover:text-indigo-500 transition-colors" />
                    <p className="text-xs font-bold text-slate-500">Drop or Click to Upload</p>
                    <p className="text-[10px] text-slate-400 mt-1">Generate AI voxel preview</p>
                  </div>
                )}
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePreviewImageUpload}
                  disabled={isProcessing}
                />
              </label>
              
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-sm text-indigo-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="font-bold uppercase">Processing...</span>
                </div>
              )}
            </section>

            {/* Marketplace Items List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Store className="w-3 h-3" /> Your Items
                </h2>
                <span className="text-[10px] font-black text-indigo-500">{toolbox.length} Items</span>
              </div>

              {filteredItems.length === 0 ? (
                <div className="py-12 border border-dashed border-slate-300 rounded-2xl text-center">
                  <p className="text-sm font-bold text-slate-500 mb-2">No items found</p>
                  <p className="text-[10px] text-slate-400">
                    {searchQuery ? 'Try a different search term' : 'Upload an image to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className={`w-full p-4 rounded-xl flex items-center gap-3 cursor-pointer transition-all border text-left ${
                        previewObject?.id === item.id
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                          : 'bg-slate-900/40 border-slate-800 text-slate-600 hover:border-indigo-500 hover:bg-slate-900/60'
                      }`}
                    >
                      <div 
                        className="w-12 h-12 rounded-lg border border-white/10 shadow-inner flex-shrink-0" 
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black uppercase truncate">{item.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{item.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right Main Area - Preview */}
        <div className="flex-1 relative bg-[#a5c9f3]">
          {previewObject ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8 pt-20 sm:pt-8 pb-24 sm:pb-8">
              {/* Compact Item Details at top of preview */}
              <div className="w-full max-w-[600px] mb-4 bg-slate-900/95 backdrop-blur-2xl rounded-xl shadow-xl p-3 border border-slate-700/50 text-white">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="Item name..."
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <input
                      type="text"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="Description..."
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Price"
                      min="0"
                      step="0.01"
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>
                </div>
              </div>
              
              <VoxelPreview 
                object={previewObject}
                position="center"
                editable={isEditMode}
                selectedPartIndex={selectedPartIndex}
                onSelectPart={setSelectedPartIndex}
                onClose={() => {
                  setPreviewObject(null);
                  setPreviewImage(null);
                  setSelectedPartIndex(null);
                  setIsEditMode(false);
                }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-32 h-32 bg-white/20 rounded-[3rem] backdrop-blur-xl border border-white/30 flex items-center justify-center mb-8">
                <Store className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter drop-shadow-lg text-center px-4 leading-tight mb-4">
                Select an Item to Preview
              </h2>
              <p className="text-white/60 font-bold uppercase tracking-widest text-[10px]">
                Browse your collection or upload a new image
              </p>
            </div>
          )}

          {/* Action Buttons (when preview is shown) */}
          {previewObject && (
            <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 max-w-full">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-xs sm:text-sm font-black uppercase flex items-center gap-2 shadow-xl transition-all ${
                    isEditMode 
                      ? 'bg-green-600 hover:bg-green-500 text-white' 
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{isEditMode ? 'Exit Edit' : 'Edit'}</span>
                  <span className="sm:hidden">Edit</span>
                </button>
                {previewImage && (
                  <button
                    onClick={handleRegenerate}
                    disabled={isProcessing}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-black uppercase flex items-center gap-2 shadow-xl transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Regenerate</span>
                  </button>
                )}
                <button
                  onClick={handleAddToToolbox}
                  disabled={isProcessing}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-black uppercase flex items-center gap-2 shadow-xl transition-all"
                >
                  <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Add to Marketplace</span>
                  <span className="sm:hidden">Add</span>
                </button>
            </div>
          )}

          {/* Editor Panel (when in edit mode and part is selected) */}
          {previewObject && isEditMode && selectedPart && selectedPartIndex !== null && (
            <div 
              className="absolute w-auto sm:w-64 max-w-[calc(100%-2rem)] sm:max-w-none bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl p-3 sm:p-4 border border-slate-700/50 text-white z-40 max-h-[calc(100vh-8rem)] overflow-y-auto cursor-move select-none"
              style={{
                left: `${editorPosition.x}px`,
                top: `${editorPosition.y}px`,
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onMouseDown={handleEditorMouseDown}
            >
              <div className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing">
                <h3 className="text-xs font-black uppercase flex items-center gap-1.5">
                  <Move3D className="w-3 h-3" />
                  Part {selectedPartIndex + 1}
                </h3>
                <button
                  onClick={() => setSelectedPartIndex(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Keyboard Controls Guide */}
                <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Controls</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[8px] font-black uppercase text-indigo-400/60">
                    <div className="bg-slate-900/50 p-1.5 rounded flex items-center gap-1 justify-center">
                      <Move3D className="w-2.5 h-2.5" /> Arrows
                    </div>
                    <div className="bg-slate-900/50 p-1.5 rounded flex items-center gap-1 justify-center">
                      <span className="text-[9px]">Q / E</span>
                    </div>
                  </div>
                </div>

                {/* Position/Offset */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Position</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['x', 'y', 'z'].map((axis, idx) => (
                      <input
                        key={axis}
                        type="number"
                        step="0.1"
                        value={selectedPart.offset[idx]}
                        onChange={(e) => {
                          const newOffset: [number, number, number] = [...selectedPart.offset] as [number, number, number];
                          newOffset[idx] = parseFloat(e.target.value) || 0;
                          handleUpdatePart(selectedPartIndex, { offset: newOffset });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500 cursor-text"
                        placeholder={axis.toUpperCase()}
                      />
                    ))}
                  </div>
                </div>

                {/* Dimensions */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Size</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['w', 'h', 'd'].map((axis, idx) => (
                      <input
                        key={axis}
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={selectedPart.dimensions[idx]}
                        onChange={(e) => {
                          const newDimensions: [number, number, number] = [...selectedPart.dimensions] as [number, number, number];
                          newDimensions[idx] = parseFloat(e.target.value) || 0.1;
                          handleUpdatePart(selectedPartIndex, { dimensions: newDimensions });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500 cursor-text"
                        placeholder={axis.toUpperCase()}
                      />
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedPart.color || previewObject.color}
                      onChange={(e) => {
                        handleUpdatePart(selectedPartIndex, { color: e.target.value });
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-12 h-8 bg-slate-800 border border-slate-700 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={selectedPart.color || previewObject.color}
                      onChange={(e) => {
                        handleUpdatePart(selectedPartIndex, { color: e.target.value });
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500 cursor-text"
                      placeholder="#000"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 pt-1.5 border-t border-slate-700/50">
                  <button
                    onClick={() => handleDeletePart(selectedPartIndex)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-1 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Part Button (when in edit mode) */}
          {previewObject && isEditMode && selectedPartIndex === null && (
            <div className="absolute top-4 sm:top-8 right-4 sm:right-8 z-40">
              <button
                onClick={handleAddPart}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs sm:text-sm font-black uppercase flex items-center gap-2 shadow-xl transition-all"
              >
                <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Add Part</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Marketplace;
