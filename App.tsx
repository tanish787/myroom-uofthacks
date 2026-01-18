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
  Search,
  Minus,
  Upload,
  CheckCircle,
  Edit3,
  ShoppingCart
} from 'lucide-react';
import { AppState, VoxelObject, ChatMessage, RoomData } from './types';
import { analyzeRoomImage, analyzeSingleObject, autoDecorate, refineObject, generateRoomFromDescription } from './services/geminiService';
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
  const [selectedAccountType, setSelectedAccountType] = useState<'buyer' | 'seller' | null>(null);
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [currentTab, setCurrentTab] = useState<'room' | 'shop' | 'create' | 'listings' | 'analytics'>('room');
  const [chatInput, setChatInput] = useState('');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Seller-specific state
  const [sellerItems, setSellerItems] = useState<any[]>([]);
  const [currentSellerItem, setCurrentSellerItem] = useState<any>(null);
  const [sellerSelectedObjectId, setSellerSelectedObjectId] = useState<string | null>(null);
  const [sellerSelectedPartIndex, setSellerSelectedPartIndex] = useState<number | null>(null);

  const [listingForm, setListingForm] = useState({
    name: '',
    price: '',
    description: '',
    type: 'furniture',
    style: 'modern',
    imageUrl: ''
  });

  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState<any>(null);
  const [checkoutForm, setCheckoutForm] = useState({
    quantity: 1,
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: ''
  });

  // Cart state - persists across sessions
  const [cart, setCart] = useState<any[]>(() => {
    const savedCart = localStorage.getItem('voxelroom_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });

  // Room items state - tracks items added from shop to room (persists to user account when logged in)
  const [roomItems, setRoomItems] = useState<any[]>(() => {
    // Don't load from localStorage anymore - items will be loaded from user account on login
    return [];
  });

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('voxelroom_cart', JSON.stringify(cart));
  }, [cart]);

  // Save room items to user account when they change (only if user is logged in)
  useEffect(() => {
    if (state.user && roomItems.length >= 0) {
      // Debounce the save to avoid too many requests
      const saveTimeout = setTimeout(async () => {
        try {
          await fetch('http://localhost:5000/user-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: state.user.email,
              roomItems: roomItems
            })
          });
          console.log('💾 Cart auto-saved for', state.user.email);
        } catch (err) {
          console.error('Error saving cart:', err);
        }
      }, 1000); // Wait 1 second before saving to batch updates
      
      return () => clearTimeout(saveTimeout);
    }
  }, [roomItems, state.user]);

  // Design preferences state
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  // Edit listing state
  const [showEditListing, setShowEditListing] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    price: '',
    description: '',
    style: 'modern',
    type: 'furniture'
  });

  // Style filter
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string | null>(null);

  // Account modal state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    shopifyLink: ''
  });
  const [accountMessage, setAccountMessage] = useState('');
  const [accountMessageType, setAccountMessageType] = useState<'success' | 'error'>('success');

  // Seller analytics state
  const [sellerAnalytics, setSellerAnalytics] = useState<any>({
    totalEarnings: '$0.00',
    totalSales: 0,
    totalViews: 0,
    totalAddToRoom: 0,
    itemStats: {},
    recentPurchases: []
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Analytics tracking functions
  const trackMarketplaceAction = async (action: 'view' | 'hover' | 'scroll' | 'add_to_room' | 'remove_from_room' | 'search', itemId?: string, itemName?: string, itemType?: string, itemColor?: string, timeSpent?: number, searchQuery?: string) => {
    if (!state.user) return;
    
    try {
      await fetch('http://localhost:5000/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: state.user.userId,
          itemId,
          itemName,
          itemType,
          itemColor,
          action,
          timeSpent: timeSpent || 0,
          searchQuery
        })
      });
    } catch (err) {
      console.error('Error tracking analytics:', err);
    }
  };

  const loadRecommendations = async () => {
    if (!state.user) return;
    
    try {
      const res = await fetch(`http://localhost:5000/recommendations/${state.user.userId}?limit=5`);
      const data = await res.json();
      if (res.ok && data.length > 0) {
        // Store recommendations in state
        setState(prev => ({ ...prev, marketplaceItems: data }));
      }
    } catch (err) {
      console.error('Error loading recommendations:', err);
    }
  };

  const fetchSellerAnalytics = async () => {
    if (!state.user) return;
    
    setAnalyticsLoading(true);
    try {
      const encodedEmail = encodeURIComponent(state.user.email);
      const res = await fetch(`http://localhost:5000/seller-analytics/${encodedEmail}`);
      if (res.ok) {
        const analytics = await res.json();
        setSellerAnalytics(analytics);
        console.log('📊 Seller analytics loaded:', analytics);
      } else {
        console.error('Failed to fetch analytics:', res.status);
      }
    } catch (err) {
      console.error('Error loading seller analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.selectedObjectId || !state.roomData) return;
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;

      const MOVE_STEP = 0.1;
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

  // Keyboard controls for seller items editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sellerSelectedObjectId || !currentSellerItem?.data) return;
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;

      const MOVE_STEP = 0.1;
      const PART_MOVE_STEP = 0.1;

      const newItem = { ...currentSellerItem };
      const newObjects = [{ ...newItem.data }];
      const obj = newObjects[0];

      // Handle Object Rotation
      if (e.key.toLowerCase() === 'r') {
        obj.rotation = (obj.rotation + Math.PI / 4) % (Math.PI * 2);
      }

      // Handle Object/Part Movement
      if (sellerSelectedPartIndex !== null) {
        const parts = [...obj.parts];
        const part = { ...parts[sellerSelectedPartIndex] };

        if (e.key === 'ArrowUp') part.offset[2] -= PART_MOVE_STEP;
        if (e.key === 'ArrowDown') part.offset[2] += PART_MOVE_STEP;
        if (e.key === 'ArrowLeft') part.offset[0] -= PART_MOVE_STEP;
        if (e.key === 'ArrowRight') part.offset[0] += PART_MOVE_STEP;
        if (e.key.toLowerCase() === 'q') part.offset[1] += PART_MOVE_STEP;
        if (e.key.toLowerCase() === 'e') part.offset[1] -= PART_MOVE_STEP;

        parts[sellerSelectedPartIndex] = part;
        obj.parts = parts;
      } else {
        if (e.key === 'ArrowUp') obj.position[2] -= MOVE_STEP;
        if (e.key === 'ArrowDown') obj.position[2] += MOVE_STEP;
        if (e.key === 'ArrowLeft') obj.position[0] -= MOVE_STEP;
        if (e.key === 'ArrowRight') obj.position[0] += MOVE_STEP;
        if (e.key.toLowerCase() === 'q') obj.position[1] += MOVE_STEP;
        if (e.key.toLowerCase() === 'e') obj.position[1] -= MOVE_STEP;
      }

      newItem.data = obj;
      setCurrentSellerItem(newItem);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sellerSelectedObjectId, sellerSelectedPartIndex, currentSellerItem?.data]);

  const generateRoomFromChat = async (prompt: string) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      console.log('🏠 Generating room from description:', prompt);
      const roomData = await generateRoomFromDescription(prompt, state.roomSizeFeet);
      console.log('✅ Room generated successfully:', roomData);
      setState(prev => ({
        ...prev,
        roomData: roomData,
        isProcessing: false,
        chatHistory: [...prev.chatHistory, 
          { role: 'user', content: prompt },
          { role: 'assistant', content: 'I\'ve created a room design based on your description!' }
        ]
      }));
    } catch (err: any) {
      console.error('❌ Room generation failed:', err);
      setState(prev => ({ ...prev, isProcessing: false, error: err.message }));
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || state.isProcessing) return;

    const prompt = chatInput;
    setChatInput('');

    // If no room exists, generate one from the chat description
    if (!state.roomData) {
      await generateRoomFromChat(prompt);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: prompt };
    setState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, userMessage],
      isProcessing: true,
      error: null
    }));

    try {
      const result = await autoDecorate(state.roomData, prompt);

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
    if (isRegistering && !selectedAccountType) {
      alert('Please select an account type (Buyer or Seller)');
      return;
    }

    const endpoint = isRegistering ? 'register' : 'login';
    try {
      console.log(`Attempting ${endpoint} at http://localhost:5000/${endpoint}`);
      const res = await fetch(`http://localhost:5000/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authInput,
          ...(isRegistering && { accountType: selectedAccountType })
        })
      });

      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(errorData || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (!isRegistering) {
        setState(prev => {
          // Initialize default room if empty
          let roomData = prev.roomData;
          if (!roomData) {
            roomData = {
              wallColor: '#cbd5e1',
              floorColor: '#94a3b8',
              objects: [],
              dimensions: { width: 12, depth: 12 }
            };
          }
          return { ...prev, user: data, showAuth: false, roomData };
        });
        
        // Set default tab based on account type
        if (data.accountType === 'seller') {
          setCurrentTab('create');
        } else {
          setCurrentTab('room');
        }
        
        // Automatically load room after login
        loadRoom(data.userId || data.id);
        
        // Load user's cart from their account
        try {
          const cartRes = await fetch(`http://localhost:5000/user-cart/${data.email}`);
          if (cartRes.ok) {
            const cartData = await cartRes.json();
            setRoomItems(cartData.roomItems || []);
            console.log('✅ Loaded cart for', data.email, ':', cartData.roomItems?.length || 0, 'items');
          }
        } catch (cartErr) {
          console.error('Error loading cart:', cartErr);
        }
      } else {
        setIsRegistering(false);
        setSelectedAccountType(null);
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
      const res = await fetch('http://localhost:5000/save-room', {
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
      const res = await fetch(`http://localhost:5000/load-room/${userId}`);
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
      const res = await fetch(`http://localhost:5000/marketplace?search=${s}`);
      let data = await res.json();
      if (res.ok) {
        // Apply filters
        data = data.filter((item: any) => {
          const price = parseFloat(item.price);
          const meetsPrice = price >= priceRange.min && price <= priceRange.max;
          const meetsCategory = selectedCategories.length === 0 || selectedCategories.includes(item.type);
          const meetsStyle = selectedStyleFilter === null || item.style === selectedStyleFilter;
          return meetsPrice && meetsCategory && meetsStyle;
        });
        console.log('🛍️ Marketplace items loaded:', data.length, 'items');
        data.forEach((item: any, idx: number) => {
          console.log(`  Item ${idx + 1}: ${item.name}`);
          console.log(`    - Image URL: ${item.imageUrl || '(none)'}`);
        });
        setState(prev => ({ ...prev, marketplaceItems: data }));
        // Track search action
        if (state.user && s) {
          trackMarketplaceAction('search', undefined, undefined, undefined, undefined, 0, s);
        }
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

  // Apply filters when they change
  useEffect(() => {
    if (currentTab === 'shop' || state.processingMode === 'marketplace') {
      searchMarketplace();
    }
  }, [priceRange, selectedCategories, selectedStyleFilter]);

  // Load marketplace when switching to shop tab
  useEffect(() => {
    if (currentTab === 'shop') {
      searchMarketplace();
    }
  }, [currentTab]);

  useEffect(() => {
    if ((currentTab === 'create' || currentTab === 'listings') && state.user?.accountType === 'seller') {
      loadSellerItems();
    }
  }, [currentTab, state.user]);

  useEffect(() => {
    if (currentTab === 'analytics' && state.user?.accountType === 'seller') {
      fetchSellerAnalytics();
    }
  }, [currentTab, state.user]);

  const createListing = async () => {
    if (!selectedObject || !state.user) return;
    
    // Use the custom image if provided, otherwise leave empty
    const imageUrl = listingForm.imageUrl || '';
    
    console.log('📸 Creating listing. Image provided:', !!listingForm.imageUrl, 'Image URL length:', imageUrl.length);
    
    try {
      const res = await fetch('http://localhost:5000/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listingForm.name,
          price: listingForm.price,
          description: listingForm.description,
          type: listingForm.type,
          style: listingForm.style,
          imageUrl: imageUrl || null,  // Send null if no image
          color: selectedObject.color,
          creator: state.user.email,
          data: selectedObject
        })
      });
      if (res.ok) {
        console.log('✅ Listing created successfully');
        alert('Listing created!');
        setState(prev => ({ ...prev, showListingCreator: false }));
        setListingForm({ name: '', price: '', description: '', type: 'furniture', style: 'modern', imageUrl: '' });
        searchMarketplace();
      } else {
        alert('Error creating listing');
      }
    } catch (err) {
      alert('Error creating listing: ' + err);
    }
  };

  const deleteListing = async (id: string) => {
    if (!state.user) return;
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      const res = await fetch(`http://localhost:5000/marketplace/${id}`, {
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

  const openCheckout = (item: any) => {
    setCheckoutItem(item);
    setCheckoutForm({
      quantity: 1,
      cardNumber: '',
      cardName: '',
      expiryDate: '',
      cvv: ''
    });
    setShowCheckout(true);
  };

  // Seller item handlers
  const handleImageUploadForItem = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setCurrentSellerItem(prev => ({
        ...prev,
        imageUrl: imageData
      }));

      // Process the image to generate 3D model
      try {
        setState(prev => ({ ...prev, isProcessing: true, error: null }));
        
        // Initialize room data if not already set
        if (!state.roomData) {
          setState(prev => ({
            ...prev,
            roomData: {
              wallColor: '#cbd5e1',
              floorColor: '#94a3b8',
              objects: [],
              dimensions: { width: 12, depth: 12 }
            }
          }));
        }

        // Analyze the image to create a 3D object
        const spawnPos: [number, number, number] = [6, 0.5, 6];
        let object = await analyzeSingleObject(imageData, spawnPos);

        // Refine the object
        try {
          object = await refineObject(imageData, object);
        } catch (refineErr) {
          console.warn("Refinement failed, using initial generation");
        }

        // Update the seller item with the 3D data
        setCurrentSellerItem(prev => ({
          ...prev,
          data: object,
          color: object.color || '#cbd5e1',
          name: prev.name || object.name,
          type: prev.type || object.type,
          description: prev.description || object.description
        }));

        // Update room data to show the object
        setState(prev => ({
          ...prev,
          roomData: prev.roomData ? { ...prev.roomData, objects: [object] } : prev.roomData,
          isProcessing: false
        }));
      } catch (err: any) {
        console.error('Error processing item image:', err);
        setState(prev => ({ ...prev, isProcessing: false, error: err.message }));
      }
    };
    reader.readAsDataURL(file);
  };

  const saveSellerItem = async () => {
    if (!state.user || !currentSellerItem?.name || !currentSellerItem?.price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // For PUT requests, we need 'email' field for verification; for POST, 'creator' is used
      const baseData = {
        name: currentSellerItem.name,
        price: currentSellerItem.price,
        type: currentSellerItem.type || 'furniture',
        style: currentSellerItem.style || 'modern',
        description: currentSellerItem.description || '',
        imageUrl: currentSellerItem.imageUrl || '',
        color: currentSellerItem.color || '#cbd5e1',
        data: currentSellerItem.data || {
          color: '#cbd5e1',
          size: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0]
        }
      };

      const endpoint = currentSellerItem._id ? 
        `http://localhost:5000/marketplace/${currentSellerItem._id}` : 
        'http://localhost:5000/marketplace';

      const method = currentSellerItem._id ? 'PUT' : 'POST';

      // For PUT, use 'email'; for POST, use 'creator'
      const itemData = currentSellerItem._id
        ? { ...baseData, email: state.user.email }
        : { ...baseData, creator: state.user.email };

      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });

      if (res.ok) {
        const savedItem = await res.json();
        console.log('✅ Item saved to marketplace:', savedItem);
        
        setSellerItems(prev => 
          currentSellerItem._id 
            ? prev.map(i => i._id === savedItem._id ? savedItem : i)
            : [...prev, savedItem]
        );
        setCurrentSellerItem(null);
        setSellerSelectedObjectId(null);
        setSellerSelectedPartIndex(null);
        alert('Item saved successfully to marketplace!');
        
        // Reload items list to ensure it's fresh
        loadSellerItems();
        
        // Also refresh marketplace for all buyers
        searchMarketplace();
      } else {
        const errorText = await res.text();
        console.error('Error saving item:', errorText);
        alert('Error saving item: ' + errorText);
      }
    } catch (err) {
      console.error('Error saving item:', err);
      alert('Error saving item');
    }
  };

  const deleteSellerItem = async (id: string) => {
    if (!state.user) return;
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const res = await fetch(`http://localhost:5000/marketplace/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.user.email })
      });

      if (res.ok) {
        setSellerItems(prev => prev.filter(i => i._id !== id));
        alert('Item deleted');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Error deleting item');
    }
  };

  const loadSellerItems = async () => {
    if (!state.user) return;
    try {
      // Filter marketplace items to show only items created by this seller
      const res = await fetch(`http://localhost:5000/marketplace`);
      if (res.ok) {
        const allItems = await res.json();
        const myItems = allItems.filter((item: any) => item.creator === state.user?.email);
        setSellerItems(myItems);
        console.log(`📦 Loaded ${myItems.length} items for seller ${state.user.email}`);
      }
    } catch (err) {
      console.error('Error loading seller items:', err);
    }
  };

  const handleCheckoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCheckoutForm(prev => ({ ...prev, [name]: value }));
  };

  const handleQuantityChange = (change: number) => {
    const newQuantity = checkoutForm.quantity + change;
    if (newQuantity > 0) {
      setCheckoutForm(prev => ({ ...prev, quantity: newQuantity }));
    }
  };

  const processPayment = async () => {
    if (!checkoutForm.cardNumber || !checkoutForm.cardName || !checkoutForm.expiryDate || !checkoutForm.cvv) {
      alert('Please fill in all payment details');
      return;
    }

    if (checkoutForm.cardNumber.replace(/\s/g, '').length !== 16) {
      alert('Card number must be 16 digits');
      return;
    }

    if (checkoutForm.cvv.length !== 3) {
      alert('CVV must be 3 digits');
      return;
    }

    // Add items to room for each quantity
    const baseRoom = state.roomData || {
      wallColor: '#cbd5e1',
      floorColor: '#94a3b8',
      objects: [],
      dimensions: { width: state.roomSizeFeet, depth: state.roomSizeFeet }
    };

    let newObjects = [...(baseRoom.objects || [])];
    for (let i = 0; i < checkoutForm.quantity; i++) {
      const newId = `placed-${Date.now()}-${i}`;
      const spawnPos: [number, number, number] = [
        state.roomSizeFeet / 2 + (Math.random() - 0.5) * 2,
        0.5,
        state.roomSizeFeet / 2 + (Math.random() - 0.5) * 2
      ];
      newObjects.push({ ...checkoutItem.data, id: newId, position: spawnPos, isUserCreated: false });
    }

    setState(prev => ({
      ...prev,
      roomData: { ...baseRoom, objects: newObjects }
    }));

    // Remove purchased item from roomItems cart if it's there
    if (checkoutItem._id) {
      setRoomItems(prevItems => prevItems.filter(item => item._id !== checkoutItem._id));
    }

    // Track purchase analytics for the seller
    console.log('🛒 Purchase Details:', {
      hasUser: !!state.user,
      hasCheckoutItem: !!checkoutItem,
      itemId: checkoutItem?._id,
      itemName: checkoutItem?.name,
      creator: checkoutItem?.creator,
      buyerEmail: state.user?.email,
      buyerId: state.user?.userId
    });

    if (state.user && checkoutItem && checkoutItem._id && checkoutItem.creator) {
      try {
        const purchaseData = {
          buyerId: state.user.userId || '',
          buyerEmail: state.user.email,
          itemId: checkoutItem._id,
          itemName: checkoutItem.name,
          sellerEmail: checkoutItem.creator,
          price: checkoutItem.price,
          quantity: checkoutForm.quantity
        };
        
        console.log('📤 Sending purchase data to server:', purchaseData);
        
        const trackRes = await fetch('http://localhost:5000/track-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(purchaseData)
        });
        
        const trackData = await trackRes.json();
        
        if (trackRes.ok) {
          console.log('✅ Purchase tracking recorded successfully:', trackData);
        } else {
          console.error('⚠️ Purchase tracking failed:', trackRes.status, trackData);
        }
      } catch (err) {
        console.error('❌ Error tracking purchase:', err);
      }
    } else {
      console.warn('⚠️ Cannot track purchase - missing required data');
    }

    alert(`✅ Payment successful! Purchased ${checkoutForm.quantity}x ${checkoutItem.name} for $${(parseFloat(checkoutItem.price) * checkoutForm.quantity).toFixed(2)}`);
    setShowCheckout(false);
    setCheckoutItem(null);
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i._id === item._id);
      if (existing) {
        return prev.map(i => i._id === item._id ? { ...i, quantity: (i.quantity || 1) + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    alert(`✅ Added ${item.name} to cart!`);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i._id !== itemId));
  };

  const openEditListing = (item: any) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      price: item.price,
      description: item.description || '',
      style: item.style || 'modern',
      type: item.type
    });
    setShowEditListing(true);
  };

  const updateListing = async () => {
    if (!editingItem || !state.user) return;

    try {
      const res = await fetch(`http://localhost:5000/marketplace/${editingItem._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.user.email,
          name: editForm.name,
          price: editForm.price,
          description: editForm.description,
          style: editForm.style,
          type: editForm.type
        })
      });

      if (res.ok) {
        alert('Listing updated successfully!');
        setShowEditListing(false);
        setEditingItem(null);
        searchMarketplace();
      } else {
        alert('Error updating listing');
      }
    } catch (err) {
      alert('Error updating listing: ' + err);
    }
  };

  const handleUpdateAccount = async () => {
    if (!state.user) return;

    // Validation
    if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
      setAccountMessage('Passwords do not match');
      setAccountMessageType('error');
      return;
    }

    if (accountForm.newPassword && accountForm.newPassword.length < 6) {
      setAccountMessage('Password must be at least 6 characters');
      setAccountMessageType('error');
      return;
    }

    if (!accountForm.name.trim() && !accountForm.newPassword) {
      setAccountMessage('Please enter a name or new password');
      setAccountMessageType('error');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/update-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.user.email,
          name: accountForm.name || undefined,
          currentPassword: accountForm.currentPassword || undefined,
          newPassword: accountForm.newPassword || undefined
        })
      });

      const data = await res.json();

      if (res.ok) {
        setAccountMessage('✅ Account updated successfully!');
        setAccountMessageType('success');
        setAccountForm({ name: '', currentPassword: '', newPassword: '', confirmPassword: '', shopifyLink: '' });
        setTimeout(() => setShowAccountModal(false), 1500);
      } else {
        setAccountMessage(data.message || 'Error updating account');
        setAccountMessageType('error');
      }
    } catch (err: any) {
      setAccountMessage('Error: ' + err.message);
      setAccountMessageType('error');
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
          toolbox: [...(prev.toolbox || []), { ...object, isUserCreated: true }],
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
      // Add the object to roomItems (right-side cart panel)
      setRoomItems(prevItems => [
        ...prevItems,
        {
          _id: `cart-${Date.now()}`,
          name: obj.name,
          price: '0.00', // User-created items don't have a price
          imageUrl: undefined,
          color: obj.color,
          objectId: obj.id,
          isPlaced: true,
          data: obj
        }
      ]);
      // Show a confirmation
      alert(`✅ Added ${obj.name} to cart!`);
    }
  };

  const placeFromToolbox = async (toolboxObj: VoxelObject, marketplaceItem?: any) => {
    const newId = `placed-${Date.now()}`;
    const spawnPos: [number, number, number] = [state.roomSizeFeet / 2, 0.5, state.roomSizeFeet / 2];
    
    // DEBUG: Log marketplace item details
    if (marketplaceItem) {
      console.log('🛍️ Placing item from marketplace:', {
        name: marketplaceItem.name,
        source: marketplaceItem.source,
        hasImageUrl: !!marketplaceItem.imageUrl,
        hasGeneratedData: !!marketplaceItem.data?.parts?.length,
        imageUrlLength: marketplaceItem.imageUrl?.length || 0,
        imageUrlPreview: marketplaceItem.imageUrl?.substring(0, 50) || 'NONE'
      });
    }
    
    // 🚫 DUPLICATE PREVENTION: Check if buyer already has this item in their room
    if (marketplaceItem && state.user?.accountType === 'buyer') {
      const itemExists = roomItems.some(item => item._id === marketplaceItem._id);
      if (itemExists) {
        alert('✋ This item is already in your room! You can only add each item once.');
        console.log('⚠️ Duplicate item blocked:', marketplaceItem._id);
        return;
      }
    }
    
    // 🎨 Generate 3D model from Shopify product image (only if not already generated)
    let finalToolboxObj = toolboxObj;
    if (marketplaceItem?.source === 'shopify' && marketplaceItem?.imageUrl) {
      // Check if this Shopify item already has a generated 3D model
      const hasGeneratedData = marketplaceItem.data?.parts && marketplaceItem.data.parts.length > 1;
      
      if (!hasGeneratedData) {
        try {
          console.log('🎨 Generating 3D model for Shopify product:', marketplaceItem.name);
          setState(prev => ({ ...prev, isProcessing: true, processingMode: 'object' }));
          
          const { analyzeSingleObject } = await import('./services/geminiService');
          const generatedObject = await analyzeSingleObject(marketplaceItem.imageUrl, spawnPos);
          
          // Merge Shopify item info with generated 3D data
          finalToolboxObj = {
            ...generatedObject,
            id: newId,
            name: marketplaceItem.name,
            color: generatedObject.color || marketplaceItem.color,
            description: marketplaceItem.description || generatedObject.description,
            isUserCreated: false
          };
          
          console.log('✅ Generated 3D model for Shopify item:', finalToolboxObj);
          
          // 💾 Save the generated 3D model to database
          try {
            const response = await fetch(`http://localhost:${process.env.VITE_SERVER_PORT || 5000}/marketplace/${marketplaceItem._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: generatedObject,
                dataSynced: true
              })
            });
            
            if (response.ok) {
              console.log('💾 Saved generated 3D model to database for:', marketplaceItem.name);
            } else {
              console.warn('⚠️ Failed to save 3D model to database:', response.statusText);
            }
          } catch (dbError) {
            console.warn('⚠️ Could not save to database (non-critical):', dbError);
            // Continue anyway - the model is generated even if we couldn't save
          }
          
          setState(prev => ({ ...prev, isProcessing: false }));
        } catch (error) {
          console.error('❌ Failed to generate 3D model for Shopify item:', error);
          // Fall back to generic 3D data if generation fails
          setState(prev => ({ ...prev, isProcessing: false }));
          finalToolboxObj = toolboxObj;
        }
      } else {
        // Use existing generated data from database
        console.log('♻️ Using cached 3D model from database for:', marketplaceItem.name);
        finalToolboxObj = {
          ...marketplaceItem.data,
          id: newId,
          name: marketplaceItem.name,
          isUserCreated: false
        };
      }
    }
    
    // Track the item if it's from marketplace and not already tracked
    if (marketplaceItem && !roomItems.find(item => item._id === marketplaceItem._id)) {
      const newRoomItem = {
        _id: marketplaceItem._id,
        name: marketplaceItem.name,
        price: marketplaceItem.price,
        imageUrl: marketplaceItem.imageUrl || getPlaceholderImage(marketplaceItem.color, marketplaceItem.name),
        color: marketplaceItem.color,
        objectId: newId,
        isPlaced: true,
        data: marketplaceItem.data
      };
      console.log('📦 Adding to roomItems:', newRoomItem);
      setRoomItems(prevItems => [
        ...prevItems,
        newRoomItem
      ]);
    } else if (marketplaceItem && marketplaceItem._id) {
      // Update existing item if already in cart
      console.log('🔄 Updating existing item in roomItems:', marketplaceItem._id);
      setRoomItems(prevItems =>
        prevItems.map(item =>
          item._id === marketplaceItem._id ? { ...item, objectId: newId, isPlaced: true } : item
        )
      );
    }
    
    setState(prev => {
      const baseRoom = prev.roomData || {
        wallColor: '#cbd5e1',
        floorColor: '#94a3b8',
        objects: [],
        dimensions: { width: prev.roomSizeFeet, depth: prev.roomSizeFeet }
      };
      const spawnPos: [number, number, number] = [prev.roomSizeFeet / 2, 0.5, prev.roomSizeFeet / 2];
      
      // Track add to room action - use marketplace item ID if available
      if (marketplaceItem && marketplaceItem._id) {
        trackMarketplaceAction('add_to_room', marketplaceItem._id, marketplaceItem.name, marketplaceItem.type, marketplaceItem.color);
        console.log('📊 Tracked add_to_room for marketplace item:', marketplaceItem._id);
      } else {
        trackMarketplaceAction('add_to_room', toolboxObj.id, toolboxObj.name, toolboxObj.type, toolboxObj.color);
      }
      
      // Mark as from shop (not user-created) - user can only sell items they create themselves
      const newObject = { ...finalToolboxObj, id: newId, position: spawnPos, isUserCreated: false };
      
      return {
        ...prev,
        roomData: {
          ...baseRoom,
          objects: [...(baseRoom.objects || []), newObject]
        },
        selectedObjectId: newId,
        processingMode: 'room'
      };
    });
  };

  // Generate a placeholder SVG image for items without imageUrl
  const getPlaceholderImage = (color: string, name: string): string => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="${color}"/>
      <text x="100" y="100" font-size="24" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial">
        ${name.substring(0, 3).toUpperCase()}
      </text>
      <circle cx="100" cy="100" r="80" fill="none" stroke="white" stroke-width="2" opacity="0.3"/>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const removeRoomItem = (itemId: string) => {
    // Remove from room items tracking
    setRoomItems(prevItems => prevItems.filter(item => item._id !== itemId));
    
    // Remove from room data
    setState(prev => {
      if (!prev.roomData) return prev;
      const item = roomItems.find(i => i._id === itemId);
      if (!item) return prev;
      
      const newObjects = (prev.roomData.objects || []).filter(obj => obj.id !== item.objectId);
      return {
        ...prev,
        roomData: { ...prev.roomData, objects: newObjects },
        selectedObjectId: null
      };
    });
  };

  const purchaseFromCart = (item: any) => {
    openCheckout(item);
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
            <h1 className="text-lg font-black italic uppercase tracking-tighter leading-none">MyRoom</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">The Space Is Yours</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {state.user?.accountType === 'seller' ? (
            <>
              <button
                onClick={() => setCurrentTab('create')}
                className={`px-6 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${
                  currentTab === 'create'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Make a Listing
              </button>
              <button
                onClick={() => setCurrentTab('listings')}
                className={`px-6 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${
                  currentTab === 'listings'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Current Listings
              </button>
              <button
                onClick={() => setCurrentTab('analytics')}
                className={`px-6 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${
                  currentTab === 'analytics'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Analytics
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCurrentTab('room')}
                className={`px-6 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${
                  currentTab === 'room'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Room
              </button>
              <button
                onClick={() => setCurrentTab('shop')}
                className={`px-6 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${
                  currentTab === 'shop'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shop
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {state.user ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-black uppercase text-slate-500">{state.user.email}</span>
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  state.user.accountType === 'seller' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {state.user.accountType === 'seller' ? '🛍️ Seller' : '👤 Buyer'}
                </span>
              </div>
              <button
                onClick={() => setShowAccountModal(true)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-indigo-600 transition-colors"
                title="Account settings"
              >
                <UserIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  // Logout - clear all user data so other users can't see it
                  setState(prev => ({
                    ...prev,
                    user: null,
                    roomData: null,  // Clear the room/base
                    toolbox: [],     // Clear the toolbox
                    selectedObjectId: null,
                    chatHistory: [],
                    marketplaceItems: [],
                    searchResults: [],
                    image: null,
                    showListingCreator: false,
                    showAuth: false
                  }));
                  setRoomItems([]);  // Clear cart
                  console.log('👋 User logged out, all data cleared');
                }}
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
              <button onClick={() => {
                setState(prev => ({ ...prev, showAuth: false }));
                setSelectedAccountType(null);
              }}><X className="w-6 h-6 text-slate-300 hover:text-slate-900" /></button>
            </div>
            
            {isRegistering && !selectedAccountType ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 font-bold mb-4">Choose your account type:</p>
                <button
                  onClick={() => setSelectedAccountType('buyer')}
                  className="w-full p-4 border-2 border-slate-300 hover:border-indigo-600 hover:bg-indigo-50 rounded-2xl text-left transition-all"
                >
                  <h3 className="font-black text-slate-900 mb-1">👤 Buyer Account</h3>
                  <p className="text-xs text-slate-600">Browse and add items to your room. Cannot sell items.</p>
                </button>
                <button
                  onClick={() => setSelectedAccountType('seller')}
                  className="w-full p-4 border-2 border-slate-300 hover:border-indigo-600 hover:bg-indigo-50 rounded-2xl text-left transition-all"
                >
                  <h3 className="font-black text-slate-900 mb-1">🛍️ Seller Account</h3>
                  <p className="text-xs text-slate-600">Create and sell your custom voxel items. Link your Shopify.</p>
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {isRegistering && selectedAccountType && (
                    <button
                      onClick={() => setSelectedAccountType(null)}
                      className="w-full text-xs text-slate-500 hover:text-slate-900 font-bold mb-2 text-left"
                    >
                      ← Back to account type selection
                    </button>
                  )}
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
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setSelectedAccountType(null);
                    }}
                    className="w-full text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600"
                  >
                    {isRegistering ? 'Already have an account? Login' : 'New here? Create account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAccountModal && state.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-96 bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase italic">Account Settings</h2>
              <button onClick={() => setShowAccountModal(false)}><X className="w-6 h-6 text-slate-300 hover:text-slate-900" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Current Email</label>
                <input
                  type="text"
                  disabled
                  value={state.user.email}
                  className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Display Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({...accountForm, name: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Current Password</label>
                <input
                  type="password"
                  placeholder="Required if changing password"
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={accountForm.currentPassword}
                  onChange={(e) => setAccountForm({...accountForm, currentPassword: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">New Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={accountForm.newPassword}
                  onChange={(e) => setAccountForm({...accountForm, newPassword: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={accountForm.confirmPassword}
                  onChange={(e) => setAccountForm({...accountForm, confirmPassword: e.target.value})}
                />
              </div>

              {state.user.accountType === 'seller' && (
                <div>
                  <label className="text-xs font-bold uppercase text-slate-600 mb-1 block">🛍️ Shopify Store Link</label>
                  <input
                    type="url"
                    placeholder="https://your-store.myshopify.com"
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={accountForm.shopifyLink || ''}
                    onChange={(e) => setAccountForm({...accountForm, shopifyLink: e.target.value})}
                  />
                  <p className="text-xs text-slate-500 mt-1">Link your Shopify store to sync your products</p>
                </div>
              )}

              {accountMessage && (
                <div className={`p-3 rounded-lg text-sm font-bold text-center ${
                  accountMessageType === 'success' 
                    ? 'bg-green-50 text-green-700' 
                    : 'bg-red-50 text-red-700'
                }`}>
                  {accountMessage}
                </div>
              )}

              <button
                onClick={handleUpdateAccount}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase rounded-xl shadow-lg transition-all"
              >
                Update Account
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckout && checkoutItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="w-[450px] bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-green-600 p-2.5 rounded-2xl">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight">Checkout</h2>
              </div>
              <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-300 hover:text-slate-900" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                <h3 className="font-black uppercase text-sm text-slate-900">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{checkoutItem.name}</span>
                    <span className="font-bold text-slate-900">${checkoutItem.price}</span>
                  </div>
                </div>
                
                {/* Quantity Selector */}
                <div className="pt-3 border-t border-slate-200">
                  <label className="text-xs font-black uppercase text-slate-600 mb-2 block">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleQuantityChange(-1)} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-900">−</button>
                    <input 
                      type="number" 
                      value={checkoutForm.quantity} 
                      readOnly
                      className="flex-1 text-center font-black text-lg bg-white border border-slate-200 rounded-lg p-2"
                    />
                    <button onClick={() => handleQuantityChange(1)} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-900">+</button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between font-black text-lg">
                  <span className="text-slate-900">Total:</span>
                  <span className="text-green-600">${(parseFloat(checkoutItem.price) * checkoutForm.quantity).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Information */}
              <div className="space-y-4">
                <h3 className="font-black uppercase text-sm text-slate-900">Payment Information</h3>
                
                <input 
                  type="text" 
                  name="cardName"
                  placeholder="Cardholder Name"
                  value={checkoutForm.cardName}
                  onChange={handleCheckoutChange}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                />

                <input 
                  type="text" 
                  name="cardNumber"
                  placeholder="Card Number (16 digits)"
                  value={checkoutForm.cardNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\s/g, '');
                    if (val.length <= 16 && /^\d*$/.test(val)) {
                      const formatted = val.match(/.{1,4}/g)?.join(' ') || '';
                      handleCheckoutChange({ target: { name: 'cardNumber', value: formatted } } as any);
                    }
                  }}
                  maxLength={19}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500 font-mono"
                />

                <div className="flex gap-3">
                  <input 
                    type="text" 
                    name="expiryDate"
                    placeholder="MM/YY"
                    value={checkoutForm.expiryDate}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 4) {
                        const formatted = val.length >= 2 ? `${val.slice(0, 2)}/${val.slice(2)}` : val;
                        handleCheckoutChange({ target: { name: 'expiryDate', value: formatted } } as any);
                      }
                    }}
                    maxLength={5}
                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500 font-mono"
                  />
                  <input 
                    type="text" 
                    name="cvv"
                    placeholder="CVV"
                    value={checkoutForm.cvv}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 3) {
                        handleCheckoutChange({ target: { name: 'cvv', value: val } } as any);
                      }
                    }}
                    maxLength={3}
                    className="w-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500 font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-black uppercase transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={processPayment}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase transition-all shadow-lg shadow-green-600/20"
                >
                  Complete Purchase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditListing && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="w-[500px] bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2.5 rounded-2xl">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight">Edit Listing</h2>
              </div>
              <button onClick={() => setShowEditListing(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors mb-4">
                <X className="w-6 h-6 text-slate-300 hover:text-slate-900" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-black uppercase text-slate-600 mb-2 block">Item Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm font-black uppercase text-slate-600 mb-2 block">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm font-black uppercase text-slate-600 mb-2 block">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500 resize-none h-24"
                  placeholder="Describe your item..."
                />
              </div>

              <div>
                <label className="text-sm font-black uppercase text-slate-600 mb-2 block">Style</label>
                <select
                  value={editForm.style}
                  onChange={(e) => setEditForm({...editForm, style: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="modern">Modern</option>
                  <option value="gothic">Gothic</option>
                  <option value="luxury">Luxury</option>
                  <option value="rustic">Rustic</option>
                  <option value="minimalist">Minimalist</option>
                  <option value="bohemian">Bohemian</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditListing(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-black uppercase transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={updateListing}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase transition-all shadow-lg shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>
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
              <div className="space-y-2 mb-4">
                <label className="text-sm font-black uppercase text-slate-600 ml-2 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Item Image <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500 ml-2">Upload a clear photo of the real item you're selling</p>
              </div>
              
              <div className="aspect-video bg-gradient-to-br from-slate-50 to-slate-100 rounded-[2rem] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-500 transition-colors">
                {listingForm.imageUrl ? (
                  <>
                    <img src={listingForm.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <label className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2">
                        <Camera className="w-3 h-3" /> Change Image
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
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-3">
                    <Camera className="w-12 h-12 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-600">Click to upload item photo</p>
                      <p className="text-xs text-slate-500 mt-1">JPG, PNG up to 10MB</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          alert('Image size must be less than 10MB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (re) => setListingForm({...listingForm, imageUrl: re.target?.result as string});
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                )}
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

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Style</label>
                <select
                  value={listingForm.style}
                  onChange={(e) => setListingForm({...listingForm, style: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="modern">Modern</option>
                  <option value="gothic">Gothic</option>
                  <option value="luxury">Luxury</option>
                  <option value="rustic">Rustic</option>
                  <option value="minimalist">Minimalist</option>
                  <option value="bohemian">Bohemian</option>
                </select>
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
        {/* Seller Make a Listing Page */}
        {currentTab === 'create' && state.user?.accountType === 'seller' ? (
          <div className="w-full flex flex-col bg-white">
            {/* Make a Listing Header */}
            <div className="border-b bg-white p-6 space-y-4">
              <h2 className="text-2xl font-black uppercase italic">Make a Listing</h2>
              <p className="text-sm text-slate-600">Create and customize your items for sale</p>
            </div>

            {/* Items Layout: Add Item | Room View (no posted items list) */}
            <div className="flex-1 flex overflow-hidden gap-6 p-6">
              {/* Left Panel: Add Item Form */}
              <div className="w-64 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 overflow-y-auto">
                <h3 className="font-black uppercase text-sm">Add New Item</h3>
                
                {/* Drag & Drop Image Area */}
                <div 
                  className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      handleImageUploadForItem(files[0]);
                    }
                  }}
                  onClick={() => {
                    const fileInput = document.getElementById('seller-item-image-input') as HTMLInputElement;
                    fileInput?.click();
                  }}
                >
                  <input
                    id="seller-item-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.currentTarget.files;
                      if (files && files.length > 0) {
                        handleImageUploadForItem(files[0]);
                      }
                    }}
                  />
                  {currentSellerItem?.imageUrl ? (
                    <>
                      <img src={currentSellerItem.imageUrl} className="w-full h-32 object-contain rounded-lg mb-2" />
                      <p className="text-xs text-slate-500">Click or drag to change</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-600">Drag image here or click</p>
                      <p className="text-[10px] text-slate-500 mt-1">to upload item image</p>
                    </>
                  )}
                </div>

                {/* Item Details Form */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Item Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Modern Chair"
                      value={currentSellerItem?.name || ''}
                      onChange={(e) => setCurrentSellerItem({...currentSellerItem, name: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Price ($)</label>
                    <input
                      type="number"
                      placeholder="99.99"
                      value={currentSellerItem?.price || ''}
                      onChange={(e) => setCurrentSellerItem({...currentSellerItem, price: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Type</label>
                    <select
                      value={currentSellerItem?.type || 'furniture'}
                      onChange={(e) => setCurrentSellerItem({...currentSellerItem, type: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="furniture">Furniture</option>
                      <option value="decor">Decor</option>
                      <option value="lighting">Lighting</option>
                      <option value="structure">Structure</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Style</label>
                    <select
                      value={currentSellerItem?.style || 'modern'}
                      onChange={(e) => setCurrentSellerItem({...currentSellerItem, style: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="modern">Modern</option>
                      <option value="gothic">Gothic</option>
                      <option value="luxury">Luxury</option>
                      <option value="rustic">Rustic</option>
                      <option value="minimalist">Minimalist</option>
                      <option value="bohemian">Bohemian</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Description</label>
                    <textarea
                      placeholder="Describe your item..."
                      value={currentSellerItem?.description || ''}
                      onChange={(e) => setCurrentSellerItem({...currentSellerItem, description: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-16 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Middle: 3D Room Preview */}
              <div className="flex-1 flex flex-col">
                <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 relative">
                  {state.isProcessing ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                      <div className="text-center">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Processing Image...</h3>
                        <p className="text-xs text-slate-600">Converting to 3D model</p>
                      </div>
                    </div>
                  ) : state.roomData && currentSellerItem?.data ? (
                    <VoxelScene 
                      roomData={{...state.roomData, objects: [currentSellerItem.data]}}
                      selectedObjectId={sellerSelectedObjectId || currentSellerItem.data.id}
                      selectedPartIndex={sellerSelectedPartIndex}
                      onSelectObject={(id, partIndex) => {
                        setSellerSelectedObjectId(id);
                        setSellerSelectedPartIndex(partIndex === undefined ? null : partIndex);
                      }}
                    />
                  ) : state.roomData ? (
                    <VoxelScene 
                      roomData={state.roomData}
                      selectedObjectId={null}
                      selectedPartIndex={null}
                      onSelectObject={() => {}}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm font-semibold">Upload an image to create a 3D item</p>
                    </div>
                  )}
                </div>

                {/* Object Editor Panel */}
                {sellerSelectedObjectId && currentSellerItem?.data && (
                  <div className="absolute bottom-8 left-8 w-80 bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 border border-slate-700/50 text-white animate-in slide-in-from-left-4 z-20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl shadow-inner border border-white/10" style={{ backgroundColor: currentSellerItem.data.color }}></div>
                        <div>
                          <h4 className="font-black text-base uppercase italic leading-none">{currentSellerItem.data.name}</h4>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1 block">{currentSellerItem.data.type}</span>
                        </div>
                      </div>
                      <button onClick={() => setSellerSelectedObjectId(null)} className="p-1 hover:bg-slate-800 rounded-lg">
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
                          {(currentSellerItem.data.parts || []).map((part: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => setSellerSelectedPartIndex(sellerSelectedPartIndex === idx ? null : idx)}
                              className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                                sellerSelectedPartIndex === idx
                                  ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                  : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="w-4 h-4 rounded shadow-inner" style={{ backgroundColor: part.color || currentSellerItem.data.color }}></div>
                              <span className="text-[9px] font-bold uppercase">Part {idx + 1}</span>
                              {sellerSelectedPartIndex === idx && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 leading-relaxed italic">"{currentSellerItem.data.description}"</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => saveSellerItem()}
                  className="mt-4 w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!currentSellerItem?.name || !currentSellerItem?.price || state.isProcessing}
                >
                  <Sparkles className="w-4 h-4" /> Save Item to Marketplace
                </button>
              </div>
            </div>
          </div>
        ) : currentTab === 'listings' && state.user?.accountType === 'seller' ? (
          // Current Listings Page
          <div className="w-full flex flex-col bg-white">
            {/* Current Listings Header */}
            <div className="border-b bg-white p-6 space-y-4">
              <h2 className="text-2xl font-black uppercase italic">Current Listings</h2>
              <p className="text-sm text-slate-600">View and manage all your listed items</p>
            </div>

            {/* Listings Layout: Left panel with 3-column grid | Right panel with room editor */}
            <div className="flex-1 flex overflow-hidden gap-6 p-6">
              {/* Left Panel: Listings Grid */}
              <div className="flex-1 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 overflow-y-auto">
                <h3 className="font-black uppercase text-sm">Your Items ({sellerItems.length})</h3>
                
                {sellerItems.length === 0 ? (
                  <div className="text-center py-8 opacity-40">
                    <PackagePlus className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-600">No listings yet</p>
                    <p className="text-[10px] text-slate-500 mt-2">Go to "Make a Listing" to create your first item</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {sellerItems.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => {
                          setCurrentSellerItem(item);
                          setSellerSelectedObjectId(item.data?.id || null);
                        }}
                        className={`text-left p-2 border rounded-lg transition-all hover:shadow-md ${
                          currentSellerItem?._id === item._id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {item.imageUrl && (
                          <img src={item.imageUrl} className="w-full h-24 object-cover rounded-lg mb-2" />
                        )}
                        <h4 className="font-bold text-[10px] text-slate-900 line-clamp-1">{item.name}</h4>
                        <p className="text-[9px] text-slate-600 mb-1">${item.price}</p>
                        <p className="text-[8px] text-slate-500 capitalize truncate">{item.type}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Panel: Room Editor with Single Item */}
              {currentSellerItem && sellerItems.length > 0 ? (
                <div className="w-96 flex flex-col gap-4">
                  {/* Room Preview */}
                  <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 relative">
                    {state.roomData && currentSellerItem?.data ? (
                      <VoxelScene 
                        roomData={{...state.roomData, objects: [currentSellerItem.data]}}
                        selectedObjectId={sellerSelectedObjectId || currentSellerItem.data.id}
                        selectedPartIndex={sellerSelectedPartIndex}
                        onSelectObject={(id, partIndex) => {
                          setSellerSelectedObjectId(id);
                          setSellerSelectedPartIndex(partIndex === undefined ? null : partIndex);
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                        <p className="text-sm font-semibold">3D Preview</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setCurrentSellerItem(currentSellerItem);
                        setSellerSelectedObjectId(currentSellerItem.data?.id || null);
                        setCurrentTab('create');
                      }}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" /> Edit Item
                    </button>
                    <button
                      onClick={() => {
                        deleteSellerItem(currentSellerItem._id!);
                        setCurrentSellerItem(null);
                        setSellerSelectedObjectId(null);
                      }}
                      className="px-4 py-3 hover:bg-red-100 rounded-xl text-red-600 font-black uppercase text-sm transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Box className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-semibold">Select an item to view</p>
                </div>
              )}
            </div>
          </div>
        ) : currentTab === 'analytics' && state.user?.accountType === 'seller' ? (
          // Analytics Page
          <div className="w-full flex flex-col bg-white">
            <div className="border-b bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black uppercase italic">Analytics</h2>
                  <p className="text-sm text-slate-600">Track your sales and performance metrics</p>
                </div>
                <button
                  onClick={fetchSellerAnalytics}
                  disabled={analyticsLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white rounded-lg font-bold text-xs uppercase transition-all"
                >
                  {analyticsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Total Earnings Card */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-2xl p-6">
                  <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Total Earnings</h3>
                  <p className="text-4xl font-black text-green-900">${sellerAnalytics.totalEarnings}</p>
                  <p className="text-xs text-green-600 mt-2">{sellerAnalytics.totalSales} items sold</p>
                </div>

                {/* Total Views Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6">
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Total Views</h3>
                  <p className="text-4xl font-black text-blue-900">{sellerAnalytics.totalViews}</p>
                  <p className="text-xs text-blue-600 mt-2">Item clicks by buyers</p>
                </div>

                {/* Add to Room Card */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-2xl p-6">
                  <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Added to Rooms</h3>
                  <p className="text-4xl font-black text-purple-900">{sellerAnalytics.totalAddToRoom}</p>
                  <p className="text-xs text-purple-600 mt-2">Items added to buyer rooms</p>
                </div>
              </div>

              {/* Item Performance */}
              <div className="border border-slate-200 rounded-2xl p-6 mb-6">
                <h3 className="font-black uppercase text-sm mb-4 flex items-center gap-2">
                  📊 Item Performance (Sorted by Earnings)
                </h3>
                {Object.keys(sellerAnalytics.itemStats || {}).length === 0 ? (
                  <div className="text-center py-8 opacity-40">
                    <p className="text-sm text-slate-600">No performance data yet. Post items to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(sellerAnalytics.itemStats).map(([itemId, stats]: [string, any]) => (
                      <div key={itemId} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm text-slate-900">{stats.itemName}</h4>
                          <p className="text-lg font-black text-green-600">${stats.earnings}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-slate-600 uppercase font-semibold">Views</p>
                            <p className="text-2xl font-black text-slate-900">{stats.views}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 uppercase font-semibold">Added to Room</p>
                            <p className="text-2xl font-black text-slate-900">{stats.addToRoomCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 uppercase font-semibold">Earnings</p>
                            <p className="text-xs font-bold text-green-600">${stats.earnings}</p>
                          </div>
                        </div>
                      </div>

                    ))}
                  </div>
                )}
              </div>

              {/* Recent Purchases */}
              <div className="border border-slate-200 rounded-2xl p-6">
                <h3 className="font-black uppercase text-sm mb-4 flex items-center gap-2">
                  💰 Recent Purchases
                </h3>
                {sellerAnalytics.recentPurchases && sellerAnalytics.recentPurchases.length === 0 ? (
                  <div className="text-center py-8 opacity-40">
                    <p className="text-sm text-slate-600">No purchases yet. Keep creating great items!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sellerAnalytics.recentPurchases?.map((purchase: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{purchase.itemName}</p>
                          <p className="text-xs text-slate-600">Qty: {purchase.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-green-600">${purchase.totalAmount}</p>
                          <p className="text-xs text-slate-500">{new Date(purchase.purchasedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Show Shop in full screen, or Room with sidebar
          currentTab === 'shop' ? (
          // Full-screen Shop View
          <div className="w-full flex flex-col bg-white">
            {/* Shop Header with Filters */}
            <div className="border-b bg-white p-6 space-y-4">
              <h2 className="text-2xl font-black uppercase italic">Marketplace</h2>
              
              {/* Search Bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search furniture..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={marketplaceSearch}
                  onChange={(e) => setMarketplaceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchMarketplace(marketplaceSearch)}
                />
                <button onClick={() => searchMarketplace(marketplaceSearch)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold"><Search className="w-4 h-4" /></button>
              </div>

              {/* Filter Controls */}
              <div className="flex gap-6 flex-wrap items-end">
                {/* Price Range Filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">Price Range</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({...priceRange, min: parseInt(e.target.value) || 0})}
                      className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                    />
                    <span className="text-slate-400">—</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({...priceRange, max: parseInt(e.target.value) || 10000})}
                      className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">Category</label>
                  <div className="flex gap-2 flex-wrap">
                    {['furniture', 'decor', 'lighting', 'structure'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategories(prev => 
                          prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                        )}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase border transition-all ${
                          selectedCategories.includes(cat)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recommendations Button */}
                {state.user && (
                  <button
                    onClick={loadRecommendations}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> Recommendations
                  </button>
                )}
              </div>
            </div>

            {/* Shop Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {!state.user && (
                <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-center mb-6">
                  <p className="text-sm font-black uppercase text-indigo-600 mb-2">Login to create listings</p>
                  <button onClick={() => setState(prev => ({ ...prev, showAuth: true }))} className="text-xs font-black uppercase bg-indigo-600 text-white px-4 py-2 rounded-lg">Sign In</button>
                </div>
              )}

              {state.marketplaceItems.length === 0 ? (
                <div className="text-center py-16 opacity-40">
                  <ShoppingBag className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg font-black uppercase">No items found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {state.marketplaceItems.map(item => (
                    <div 
                      key={item._id} 
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all group"
                      onMouseEnter={() => trackMarketplaceAction('hover', item._id, item.name, item.type, item.color)}
                      onClick={() => trackMarketplaceAction('view', item._id, item.name, item.type, item.color)}
                    >
                      <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden relative border-b border-slate-200 flex items-center justify-center">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={item.name} />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4">
                            <div className="w-24 h-24 rounded-2xl shadow-md" style={{ backgroundColor: item.color || '#cbd5e1' }}></div>
                            <p className="text-xs text-slate-500 text-center font-medium">{item.name}</p>
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">
                          ${item.price}
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-black uppercase italic text-sm leading-tight">{item.name}</h4>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.type}</span>
                        </div>
                        {item.description && <p className="text-xs text-slate-600 line-clamp-2">"{item.description}"</p>}
                        <div className="flex gap-2 pt-2">
                          {!roomItems.some(ri => ri._id === item._id) && (
                            <button
                              onClick={() => placeFromToolbox(item.data, item)}
                              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase transition-all"
                            >
                              Add to Room
                            </button>
                          )}
                          <button
                            onClick={() => openCheckout(item)}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold uppercase transition-all"
                          >
                            Buy
                          </button>
                          {state.user?.email === item.creator && (
                            <button 
                              onClick={() => openEditListing(item)}
                              className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                              title="Edit this listing"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {state.user?.email === item.creator && (
                            <button onClick={() => deleteListing(item._id!)} className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                          <div className="w-4 h-4 rounded-full bg-slate-300"></div>
                          <span className="truncate">{item.creator}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Room View with Left Sidebar and Right Cart Panel
          <>
            {/* Type guard for buyer tabs */}
            {((currentTab as any) === 'room' || (currentTab as any) === 'shop') && (
            <>
            {/* Left Sidebar */}
            <div className="w-80 border-r bg-white flex flex-col overflow-y-auto">
          <div className="p-4 space-y-6">
            {currentTab === 'room' && (
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
            )}

            {(currentTab as any) === 'shop' && (
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Shop</h3>
                <p className="text-xs text-slate-500">Browse and personalize furniture recommendations</p>
              </section>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
              {currentTab === 'room' && (
                <div className="flex p-1 bg-slate-900 rounded-2xl border border-slate-800">
                  <button
                    onClick={() => setState(prev => ({ ...prev, processingMode: 'room' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${state.processingMode === 'room' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Design
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
                </div>
              )}

              {(currentTab as any) === 'shop' && (
                <section className="space-y-4">
                  {state.user && (
                    <button
                      onClick={loadRecommendations}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                    >
                      <Sparkles className="w-4 h-4" /> Personalized Recommendations
                    </button>
                  )}
                  
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

                  {/* Style Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400">Filter by Style</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedStyleFilter(null)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          selectedStyleFilter === null
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-indigo-500'
                        }`}
                      >
                        All
                      </button>
                      {['Modern', 'Gothic', 'Luxury', 'Rustic', 'Minimalist', 'Bohemian'].map(style => (
                        <button
                          key={style}
                          onClick={() => setSelectedStyleFilter(style)}
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                            selectedStyleFilter === style
                              ? 'bg-indigo-600 text-white shadow-lg'
                              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-indigo-500'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
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
                      <div 
                        key={item._id} 
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-4 group hover:border-indigo-500 transition-all"
                        onMouseEnter={() => trackMarketplaceAction('hover', item._id, item.name, item.type, item.color)}
                        onClick={() => trackMarketplaceAction('view', item._id, item.name, item.type, item.color)}
                      >
                        <div className="aspect-square bg-slate-950 rounded-2xl mb-4 overflow-hidden relative border border-slate-800">
                          <img 
                            src={item.imageUrl || getPlaceholderImage(item.color, item.name)} 
                            className="w-full h-full object-cover" 
                            alt={item.name}
                            onError={(e) => {
                              console.error('❌ Shop image failed to load:', item.name);
                              (e.target as HTMLImageElement).src = getPlaceholderImage(item.color, item.name);
                            }}
                          />
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
                        {item.style && <p className="text-[9px] text-slate-500 mb-2 italic">Style: {item.style}</p>}
                        <div className="flex gap-2 mb-3">
                          {!roomItems.some(ri => ri._id === item._id) && (
                            <button
                              onClick={() => placeFromToolbox(item.data, item)}
                              disabled={state.isProcessing}
                              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                            >
                              {state.isProcessing && state.processingMode === 'object' ? (
                                <>
                                  <span className="animate-spin">⚙️</span> Generating 3D...
                                </>
                              ) : (
                                <>
                                  <PlusCircle className="w-4 h-4" /> Add to Room
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => openCheckout(item)}
                            className={`flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20 ${
                              roomItems.some(ri => ri._id === item._id) ? 'flex-none w-full' : ''
                            }`}
                          >
                            <ShoppingBag className="w-4 h-4" /> Buy
                          </button>
                        </div>
                        {state.user?.email === item.creator && (
                          <button
                            onClick={() => openEditListing(item)}
                            className="w-full py-2 mb-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[9px] font-black uppercase transition-all border border-slate-700"
                          >
                            ✏️ Edit Listing
                          </button>
                        )}
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

              {state.processingMode === 'chat' && currentTab === 'room' && (
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

              {(state.processingMode === 'room' || state.processingMode === 'object') && !state.isProcessing && currentTab === 'room' && (
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
                        style={{ color: '#ffffff' }}
                      >
                        Clear Room
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
                        {state.processingMode === 'room' ? 'CREATE ROOM' : 'ADD ITEM'}
                      </button>
                      <button onClick={() => setState(prev => ({ ...prev, image: null }))} className="p-4 bg-slate-800 text-slate-400 rounded-2xl">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </section>
              )}

              {state.isProcessing && currentTab === 'room' && (
                <div className="flex flex-col items-center justify-center h-48 text-center animate-pulse">
                  <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                  <h3 className="text-xs font-black italic uppercase tracking-widest text-indigo-400">
                    {state.processingMode === 'room' ? 'Mapping Geometry...' : 'Capturing Features...'}
                  </h3>
                </div>
              )}

              {state.roomData && !state.isProcessing && currentTab === 'room' && (
                <section className="space-y-4 pt-4 border-t border-slate-800/50">
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">My Room</h2>
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

        {/* Center View and Right Cart Panel */}
        <div className="flex-1 flex">
          {/* Center: Room View */}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#a5c9f3] to-[#87CEEB] p-8">
               <div className="w-32 h-32 bg-white/20 rounded-[3rem] backdrop-blur-xl border border-white/30 flex items-center justify-center mb-8 animate-bounce">
                <Box className="w-16 h-16 text-white" />
               </div>
               <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter drop-shadow-lg text-center px-4 leading-tight">Create Your Room</h2>
               <p className="text-white/70 font-bold uppercase tracking-widest text-[10px] mt-2 text-center max-w-xs">Snap a photo to generate your room design</p>
               
               <div className="mt-8 text-center">
                 <label className="inline-block cursor-pointer">
                   <div className="px-8 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-xl rounded-2xl border border-white/30 transition-all">
                     <input
                       type="file"
                       accept="image/*"
                       className="hidden"
                       onChange={handleImageUpload}
                     />
                     <span className="text-white font-bold text-sm uppercase flex items-center gap-3">
                       <Camera className="w-5 h-5" />
                       Upload Photo
                     </span>
                   </div>
                 </label>
                 {state.image && (
                   <button
                     onClick={processImage}
                     disabled={state.isProcessing}
                     className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-400 text-white rounded-xl font-bold text-xs uppercase transition-colors"
                   >
                     {state.isProcessing ? 'Processing...' : 'Analyze Photo'}
                   </button>
                 )}
               </div>
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
                  {selectedObject.isUserCreated !== false && !roomItems.some(ri => ri.objectId === selectedObject.id) && (
                    <button
                      onClick={addToToolbox}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                    >
                      <PackagePlus className="w-4 h-4" /> Add to Cart
                    </button>
                  )}
                  {state.user && state.user.accountType === 'seller' && (
                    selectedObject.isUserCreated !== false ? (
                      <button
                        onClick={() => setState(prev => ({ ...prev, showListingCreator: true }))}
                        className="flex-1 py-3 bg-slate-900 border border-slate-800 text-indigo-400 text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                      >
                        <ShoppingBag className="w-4 h-4" /> Sell
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 py-3 bg-red-600/20 border border-red-500/30 text-red-400 text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <X className="w-4 h-4" /> Can't sell
                      </button>
                    )
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

          {/* Right Sidebar: Room Items Cart */}
          <div className="w-80 border-l bg-white flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
              <h3 className="text-sm font-black uppercase text-indigo-600 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> Cart
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">Items added to your Cart</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {roomItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8 opacity-50">
                  <ShoppingBag className="w-10 h-10 mb-2 text-slate-300" />
                  <p className="text-[10px] font-black uppercase text-slate-500">No items added yet</p>
                  <p className="text-[9px] text-slate-400 mt-1">Click "Add to Room" in the shop</p>
                </div>
              ) : (
                <>
                  {roomItems.map(item => (
                    <div key={item._id} className="bg-slate-50 rounded-lg p-2 border border-slate-200 hover:border-indigo-300 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 truncate">{item.name}</h4>
                          <p className="text-[9px] text-green-600 font-semibold">${item.price}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => purchaseFromCart(item)}
                            className="p-1 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                            title="Purchase this item"
                          >
                            <ShoppingCart className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeRoomItem(item._id)}
                            className="p-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                            title="Remove from room"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
            </>
            )}
          </>
        )
        )}
      </main>
    </div>
  );
};

export default App;
