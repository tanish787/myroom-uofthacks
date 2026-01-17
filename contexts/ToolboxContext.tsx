import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VoxelObject } from '../types';

interface ToolboxContextType {
  toolbox: VoxelObject[];
  addToToolbox: (item: VoxelObject) => void;
  removeFromToolbox: (id: string) => void;
}

const ToolboxContext = createContext<ToolboxContextType | undefined>(undefined);

export const ToolboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toolbox, setToolbox] = useState<VoxelObject[]>(() => {
    // Load from localStorage on init
    const stored = localStorage.getItem('voxel-toolbox');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    // Save to localStorage whenever toolbox changes
    localStorage.setItem('voxel-toolbox', JSON.stringify(toolbox));
  }, [toolbox]);

  const addToToolbox = (item: VoxelObject) => {
    setToolbox(prev => [...prev, { ...item, id: `tb-${Date.now()}` }]);
  };

  const removeFromToolbox = (id: string) => {
    setToolbox(prev => prev.filter(item => item.id !== id));
  };

  return (
    <ToolboxContext.Provider value={{ toolbox, addToToolbox, removeFromToolbox }}>
      {children}
    </ToolboxContext.Provider>
  );
};

export const useToolbox = () => {
  const context = useContext(ToolboxContext);
  if (!context) {
    throw new Error('useToolbox must be used within ToolboxProvider');
  }
  return context;
};
