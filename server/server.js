import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { fetchShopifyProducts } from '../services/shopifyService.ts';

dotenv.config();

// Load .env from project root directory
const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(__filename));
dotenv.config({ path: path.join(projectRoot, '.env') });

// Set up __dirname for ES modules
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
app.use(cors());
// Increase payload limit to handle large base64 image uploads (up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Serve uploaded images as static files
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.send({ 
    status: 'ok', 
    db: mongoose.connection.readyState,
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    if (err.message.includes('IP address')) {
      console.error('👉 ACTION REQUIRED: Add this IP to Atlas Whitelist:', process.env.CURRENT_IP || 'Check curl ifconfig.me');
    }
  });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: '' },
  accountType: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
  shopifyLink: { type: String, default: '' },
  roomItems: [Object],  // Cart items stored per user
  savedRooms: [Object]
});

const User = mongoose.model('User', userSchema);

const marketplaceItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  imageUrl: { type: String },
  color: { type: String, required: true },
  type: { type: String, required: true },
  style: { type: String, default: 'modern' },
  creator: { type: String, required: true },
  data: { type: Object, required: true }, // VoxelObject data
  source: { type: String, default: 'user' }, // 'user' or 'shopify'
  createdAt: { type: Date, default: Date.now }
});

const MarketplaceItem = mongoose.model('MarketplaceItem', marketplaceItemSchema);

// User Analytics Schema - tracks user interactions with marketplace items
const userAnalyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceItem' },
  itemName: { type: String },
  itemType: { type: String },
  itemColor: { type: String },
  action: { type: String, enum: ['view', 'hover', 'scroll', 'add_to_room', 'remove_from_room', 'search'], required: true },
  timeSpent: { type: Number, default: 0 }, // milliseconds for hover/view actions
  timestamp: { type: Date, default: Date.now },
  searchQuery: { type: String } // for search actions
});

const UserAnalytics = mongoose.model('UserAnalytics', userAnalyticsSchema);

// Purchase Analytics Schema - tracks seller sales and earnings
const purchaseAnalyticsSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceItem', required: true },
  itemName: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  price: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  totalAmount: { type: String, required: true },
  purchasedAt: { type: Date, default: Date.now }
});

const PurchaseAnalytics = mongoose.model('PurchaseAnalytics', purchaseAnalyticsSchema);

// Helper function to save base64 image to disk
function saveBase64Image(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return null;
  }

  try {
    // Extract base64 data and format from data URL
    // Format: data:image/png;base64,iVBORw0K...
    let imageData;
    let fileExtension = 'png'; // default

    if (base64String.startsWith('data:')) {
      const matches = base64String.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (!matches) {
        console.error('❌ Invalid base64 format');
        return null;
      }
      fileExtension = matches[1];
      imageData = matches[2];
    } else {
      imageData = base64String;
    }

    // Decode and validate
    const buffer = Buffer.from(imageData, 'base64');
    if (buffer.length === 0) {
      console.error('❌ Empty image buffer');
      return null;
    }

    // Generate unique filename
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${fileExtension}`;
    const filepath = path.join(uploadsDir, filename);

    // Write to disk
    fs.writeFileSync(filepath, buffer);
    console.log(`💾 Image saved: ${filename} (${buffer.length} bytes)`);

    // Return URL path for serving
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('❌ Error saving image:', err);
    return null;
  }
}

app.post('/register', async (req, res) => {
  try {
    const { email, password, accountType } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      email, 
      password: hashedPassword,
      accountType: accountType || 'buyer'
    });
    await user.save();
    res.status(201).send({ message: 'User registered' });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).send('Invalid credentials');
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.send({ 
      token, 
      email: user.email, 
      userId: user._id,
      accountType: user.accountType || 'buyer',
      shopifyLink: user.shopifyLink || ''
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/update-account', async (req, res) => {
  try {
    const { email, name, currentPassword, newPassword, shopifyLink } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // If user is trying to change password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).send({ message: 'Current password is required to set a new password' });
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).send({ message: 'Current password is incorrect' });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    // Update name if provided
    if (name) {
      user.name = name;
    }

    // Update Shopify link if provided (for sellers)
    if (shopifyLink !== undefined) {
      user.shopifyLink = shopifyLink;
    }

    await user.save();
    res.send({ 
      message: 'Account updated successfully', 
      email: user.email, 
      name: user.name,
      accountType: user.accountType,
      shopifyLink: user.shopifyLink 
    });
  } catch (err) {
    console.error('Update account error:', err);
    res.status(500).send({ message: 'Error updating account: ' + err.message });
  }
});

// Save user's cart items to their account
app.post('/user-cart', async (req, res) => {
  try {
    const { email, roomItems } = req.body;
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    
    user.roomItems = roomItems || [];
    await user.save();
    console.log(`💾 Saved ${roomItems?.length || 0} cart items for ${email}`);
    res.send({ message: 'Cart saved successfully', roomItems: user.roomItems });
  } catch (err) {
    console.error('Save cart error:', err);
    res.status(500).send({ message: 'Error saving cart: ' + err.message });
  }
});

// Load user's cart items from their account
app.get('/user-cart/:email', async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    
    console.log(`📦 Loading cart for ${email}: ${user.roomItems?.length || 0} items`);
    res.send({ roomItems: user.roomItems || [] });
  } catch (err) {
    console.error('Load cart error:', err);
    res.status(500).send({ message: 'Error loading cart: ' + err.message });
  }
});

// Serve item image
app.get('/marketplace/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MarketplaceItem.findById(id);
    
    if (!item || !item.imageUrl) {
      return res.status(404).send({ error: 'Image not found' });
    }
    
    // The imageUrl is a base64 data URL, return it directly
    // Browser will handle the data: URL scheme
    res.set('Content-Type', 'application/json');
    res.send({ imageUrl: item.imageUrl });
  } catch (err) {
    console.error('Image serving error:', err);
    res.status(500).send({ error: 'Error loading image' });
  }
});

app.get('/marketplace', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { name: { $regex: search, $options: 'i' } };
    }
    const items = await MarketplaceItem.find(query).sort({ createdAt: -1 });
    console.log(`🛍️ [GET /marketplace] Returned ${items.length} items`);
    items.forEach((item, idx) => {
      console.log(`  Item ${idx + 1}: ${item.name} - Has image: ${!!item.imageUrl} (size: ${item.imageUrl?.length || 0} bytes)`);
    });
    res.send(items);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/marketplace', async (req, res) => {
  try {
    const { name, price, description, imageUrl, color, type, style, creator, data } = req.body;
    
    // Process image - save to disk and get URL
    let savedImageUrl = null;
    if (imageUrl) {
      console.log(`📸 [POST /marketplace] Creating listing: "${name}"`);
      console.log(`   Image size received: ${imageUrl.length} bytes`);
      
      // Save base64 image to disk
      savedImageUrl = saveBase64Image(imageUrl);
      
      if (savedImageUrl) {
        console.log(`✅ Image saved to disk at: ${savedImageUrl}`);
      } else {
        console.warn(`⚠️ Failed to save image to disk, storing null`);
      }
    } else {
      console.log(`📸 [POST /marketplace] Creating listing: "${name}" - NO IMAGE PROVIDED`);
    }
    
    const item = new MarketplaceItem({ 
      name, 
      price, 
      description, 
      imageUrl: savedImageUrl,  // Store file URL, not base64
      color, 
      type, 
      style, 
      creator, 
      data 
    });
    await item.save();
    console.log(`✅ [POST /marketplace] Listing saved with ID: ${item._id}, image URL: ${savedImageUrl}`);
    
    // Send back the saved item with its ID
    res.status(201).send({
      _id: item._id,
      name: item.name,
      price: item.price,
      description: item.description,
      imageUrl: item.imageUrl,
      color: item.color,
      type: item.type,
      style: item.style,
      creator: item.creator,
      data: item.data
    });
  } catch (err) {
    console.error(`❌ [POST /marketplace] Error:`, err.message);
    res.status(400).send(err.message);
  }
});

app.delete('/marketplace/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body; // In a real app, use JWT for this
    const item = await MarketplaceItem.findById(id);
    if (!item) return res.status(404).send('Not found');
    if (item.creator !== email) return res.status(403).send('Forbidden');
    
    await MarketplaceItem.findByIdAndDelete(id);
    res.send({ message: 'Deleted' });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Update marketplace item with generated 3D data (for Shopify products)
app.patch('/marketplace/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, dataSynced } = req.body;
    
    if (!data || !id) {
      return res.status(400).send('Missing required fields: id, data');
    }
    
    const updated = await MarketplaceItem.findByIdAndUpdate(
      id,
      { data, dataSynced: dataSynced || true },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).send('Marketplace item not found');
    }
    
    console.log(`🔄 [PATCH /marketplace/:id] Updated 3D data for: "${updated.name}"`);
    res.send(updated);
  } catch (err) {
    console.error(`❌ [PATCH /marketplace/:id] Error:`, err.message);
    res.status(500).send(err.message);
  }
});

app.put('/marketplace/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, price, description, style, type } = req.body;
    const item = await MarketplaceItem.findById(id);
    if (!item) return res.status(404).send('Not found');
    if (item.creator !== email) return res.status(403).send('Forbidden');
    
    const updated = await MarketplaceItem.findByIdAndUpdate(
      id,
      { name, price, description, style, type },
      { new: true }
    );
    console.log(`✏️ [PUT /marketplace/:id] Updated listing: "${name}"`);
    res.send(updated);
  } catch (err) {
    console.error(`❌ [PUT /marketplace/:id] Error:`, err.message);
    res.status(400).send(err.message);
  }
});

app.post('/save-room', async (req, res) => {
  try {
    const { userId, roomData } = req.body;
    await User.findByIdAndUpdate(userId, { $set: { savedRooms: [roomData] } }); // Simplification: keeps one last room for now
    res.send({ message: 'Room saved' });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/load-room/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).send('User not found');
    res.send(user.savedRooms[0] || null);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Track user analytics
app.post('/analytics', async (req, res) => {
  try {
    const { userId, itemId, itemName, itemType, itemColor, action, timeSpent, searchQuery } = req.body;
    
    const analytics = new UserAnalytics({
      userId,
      itemId,
      itemName,
      itemType,
      itemColor,
      action,
      timeSpent: timeSpent || 0,
      searchQuery
    });
    
    await analytics.save();
    res.status(201).send({ message: 'Analytics recorded' });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get personalized recommendations for a user
app.get('/recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;

    // Get all user analytics
    const userAnalytics = await UserAnalytics.find({ userId }).lean();
    
    if (userAnalytics.length === 0) {
      // Return top rated items if user has no history
      const topItems = await MarketplaceItem.find().sort({ createdAt: -1 }).limit(parseInt(limit)).lean();
      return res.send(topItems);
    }

    // Calculate item scores based on user behavior
    const itemScores = new Map();
    const userInteractions = new Map();

    for (const record of userAnalytics) {
      const itemId = record.itemId?.toString();
      if (!itemId) continue;

      if (!userInteractions.has(itemId)) {
        userInteractions.set(itemId, {
          type: record.itemType,
          color: record.itemColor,
          name: record.itemName,
          views: 0,
          hovers: 0,
          scrolls: 0,
          adds: 0,
          removes: 0,
          totalTimeSpent: 0
        });
      }

      const interaction = userInteractions.get(itemId);
      switch (record.action) {
        case 'view':
          interaction.views += 1;
          interaction.totalTimeSpent += record.timeSpent || 0;
          break;
        case 'hover':
          interaction.hovers += 2;
          interaction.totalTimeSpent += record.timeSpent || 0;
          break;
        case 'scroll':
          interaction.scrolls += 0.5;
          break;
        case 'add_to_room':
          interaction.adds += 5;
          break;
        case 'remove_from_room':
          interaction.removes -= 2;
          break;
      }
    }

    // Calculate item type and color preferences
    const typePreferences = {};
    const colorPreferences = {};

    for (const [, interaction] of userInteractions) {
      const score = interaction.views + interaction.hovers + interaction.scrolls + interaction.adds - interaction.removes + (interaction.totalTimeSpent / 1000);
      
      if (score > 0) {
        typePreferences[interaction.type] = (typePreferences[interaction.type] || 0) + score;
        colorPreferences[interaction.color] = (colorPreferences[interaction.color] || 0) + score;
      }
    }

    // Find similar items from marketplace
    const similarItems = await MarketplaceItem.find({
      $or: [
        { type: { $in: Object.keys(typePreferences).slice(0, 3) } },
        { color: { $in: Object.keys(colorPreferences).slice(0, 3) } }
      ]
    }).lean();

    // Score and sort items
    const recommendations = similarItems
      .filter(item => !userInteractions.has(item._id.toString())) // Exclude items user already interacted with
      .map(item => ({
        ...item,
        recommendationScore: 
          (typePreferences[item.type] || 0) * 0.6 + 
          (colorPreferences[item.color] || 0) * 0.4
      }))
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, parseInt(limit))
      .map(({ recommendationScore, ...item }) => item); // Remove recommendation score from response

    res.send(recommendations.length > 0 ? recommendations : similarItems.slice(0, parseInt(limit)));
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).send(err.message);
  }
});

// Get user's interaction history with items
app.get('/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const analytics = await UserAnalytics.find({ userId })
      .sort({ timestamp: -1 })
      .limit(50);
    res.send(analytics);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Track purchase for seller analytics
app.post('/track-purchase', async (req, res) => {
  try {
    const { buyerId, buyerEmail, itemId, itemName, sellerEmail, price, quantity } = req.body;
    
    console.log('📦 Received purchase tracking request:', {
      buyerEmail,
      sellerEmail,
      itemName,
      quantity,
      price
    });
    
    // Validate required fields
    if (!buyerEmail || !sellerEmail || !itemName || !itemId) {
      console.error('❌ Missing required fields:', { buyerEmail, sellerEmail, itemName, itemId });
      return res.status(400).send({ error: 'Missing required fields' });
    }
    
    const totalAmount = (parseFloat(price) * quantity).toFixed(2);
    
    const purchase = new PurchaseAnalytics({
      itemId,
      itemName,
      sellerEmail,
      buyerEmail,
      buyerId: buyerId || null,
      price,
      quantity,
      totalAmount
    });
    
    const savedPurchase = await purchase.save();
    console.log(`💰 Purchase saved to MongoDB: ${itemName} sold by ${sellerEmail} for $${totalAmount}`, savedPurchase._id);
    res.status(201).send({ message: 'Purchase tracked', purchase: savedPurchase });
  } catch (err) {
    console.error('❌ Error tracking purchase:', err.message, err);
    res.status(500).send({ error: err.message });
  }
});

// Get seller analytics (earnings, views, hover time)
app.get('/seller-analytics/:sellerEmail', async (req, res) => {
  try {
    const sellerEmail = decodeURIComponent(req.params.sellerEmail);
    console.log(`\n📊 === FETCHING ANALYTICS FOR SELLER: ${sellerEmail} ===`);
    
    // Get all purchases for this seller
    const purchases = await PurchaseAnalytics.find({ sellerEmail }).lean();
    console.log(`✓ Found ${purchases.length} purchases in PurchaseAnalytics`);
    if (purchases.length > 0) {
      purchases.forEach(p => console.log(`  - ${p.itemName}: $${p.totalAmount} from ${p.buyerEmail}`));
    }
    
    // Calculate total earnings
    const totalEarnings = purchases.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0).toFixed(2);
    console.log(`✓ Total Earnings: $${totalEarnings}`);
    
    // Get all analytics for items created by this seller
    const sellerItems = await MarketplaceItem.find({ creator: sellerEmail }).lean();
    const sellerItemIds = sellerItems.map(item => item._id);
    console.log(`✓ Found ${sellerItems.length} items created by seller`);
    if (sellerItemIds.length > 0) {
      sellerItems.forEach(item => console.log(`  - ${item.name} (ID: ${item._id})`));
    }
    
    // Get all user interactions with this seller's items
    const itemAnalytics = await UserAnalytics.find({
      itemId: { $in: sellerItemIds }
    }).lean();
    console.log(`✓ Found ${itemAnalytics.length} user interactions with seller's items`);
    
    // Count views and add-to-room actions
    const views = itemAnalytics.filter(a => a.action === 'view').length;
    const addToRoomActions = itemAnalytics.filter(a => a.action === 'add_to_room').length;
    
    console.log(`✓ Total Views: ${views}`);
    console.log(`✓ Total Add-to-Room Actions: ${addToRoomActions}`);
    
    // Group analytics by item and calculate earnings per item
    const itemStats = {};
    sellerItemIds.forEach(id => {
      const idStr = id.toString();
      itemStats[idStr] = {
        views: 0,
        addToRoomCount: 0,
        itemName: sellerItems.find(item => item._id.toString() === idStr)?.name || 'Unknown',
        earnings: 0
      };
    });
    
    // Add user interaction stats
    itemAnalytics.forEach(a => {
      const itemIdStr = a.itemId?.toString();
      if (itemIdStr && itemStats[itemIdStr]) {
        if (a.action === 'view') {
          itemStats[itemIdStr].views += 1;
        }
        if (a.action === 'add_to_room') {
          itemStats[itemIdStr].addToRoomCount += 1;
        }
      }
    });
    
    // Add earnings per item from purchases
    purchases.forEach(p => {
      for (const [itemIdStr, stats] of Object.entries(itemStats)) {
        if (p.itemId.toString() === itemIdStr) {
          stats.earnings = (parseFloat(stats.earnings || 0) + parseFloat(p.totalAmount)).toFixed(2);
        }
      }
    });
    
    // Convert to array and sort by earnings (highest to lowest)
    const sortedItemStats = Object.entries(itemStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => parseFloat(b.earnings || 0) - parseFloat(a.earnings || 0))
      .reduce((acc, item) => {
        acc[item.id] = { ...item };
        delete acc[item.id].id;
        return acc;
      }, {});
    
    const recentPurchases = purchases.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)).slice(0, 10);
    
    const analyticsData = {
      totalEarnings,
      totalSales: purchases.length,
      totalViews: views,
      totalAddToRoom: addToRoomActions,
      itemStats: sortedItemStats,
      recentPurchases
    };
    
    console.log(`\n✅ Analytics response:`, analyticsData);
    console.log(`=== END ANALYTICS FETCH ===\n`);
    
    res.send(analyticsData);
  } catch (err) {
    console.error('❌ Error getting seller analytics:', err);
    res.status(500).send({ error: err.message });
  }
});

app.post('/api/openrouter', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) return res.status(400).send({ error: "Prompt is required" });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",   // keep your model
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    res.send(data);
  } catch (err) {
    console.error('OpenRouter Error:', err);
    res.status(500).send({ error: err.message });
  }
});

// Shopify sync endpoint - manually trigger sync
app.post('/api/shopify/sync', async (req, res) => {
  try {
    console.log('🔄 [Shopify Sync] Starting manual sync...');
    
    const shopifyProducts = await fetchShopifyProducts();
    
    if (shopifyProducts.length === 0) {
      console.log('⚠️ [Shopify Sync] No products to sync');
      return res.status(200).send({ message: 'No products to sync', synced: 0 });
    }

    let syncedCount = 0;
    let skippedCount = 0;

    for (const product of shopifyProducts) {
      try {
        // Check for duplicates by name
        const existingItem = await MarketplaceItem.findOne({ name: product.name });
        
        if (existingItem) {
          console.log(`⏭️  [Shopify Sync] Skipping duplicate: ${product.name}`);
          skippedCount++;
          continue;
        }

        // Upsert (insert or update if exists)
        const result = await MarketplaceItem.updateOne(
          { name: product.name, source: 'shopify' },
          { $set: product },
          { upsert: true }
        );

        if (result.upsertedId) {
          console.log(`✅ [Shopify Sync] Inserted: ${product.name}`);
          syncedCount++;
        } else if (result.modifiedCount > 0) {
          console.log(`🔄 [Shopify Sync] Updated: ${product.name}`);
          syncedCount++;
        }
      } catch (error) {
        console.error(`❌ [Shopify Sync] Error syncing product ${product.name}:`, error.message);
        skippedCount++;
      }
    }

    console.log(`✨ [Shopify Sync] Complete: ${syncedCount} synced, ${skippedCount} skipped`);
    res.status(200).send({ 
      message: 'Sync completed',
      synced: syncedCount,
      skipped: skippedCount,
      total: shopifyProducts.length
    });
  } catch (error) {
    console.error('❌ [Shopify Sync] Error:', error.message);
    res.status(500).send({ error: error.message });
  }
});

// Async function to execute Shopify sync
async function executeShopifySync() {
  try {
    console.log('🔄 [Cron] Running scheduled Shopify sync...');
    
    const shopifyProducts = await fetchShopifyProducts();
    
    if (shopifyProducts.length === 0) {
      console.log('⚠️ [Cron] No products to sync');
      return;
    }

    let syncedCount = 0;
    let skippedCount = 0;

    for (const product of shopifyProducts) {
      try {
        const existingItem = await MarketplaceItem.findOne({ name: product.name });
        
        if (existingItem) {
          console.log(`⏭️  [Cron] Skipping duplicate: ${product.name}`);
          skippedCount++;
          continue;
        }

        const result = await MarketplaceItem.updateOne(
          { name: product.name, source: 'shopify' },
          { $set: product },
          { upsert: true }
        );

        if (result.upsertedId) {
          console.log(`✅ [Cron] Inserted: ${product.name}`);
          syncedCount++;
        } else if (result.modifiedCount > 0) {
          console.log(`🔄 [Cron] Updated: ${product.name}`);
          syncedCount++;
        }
      } catch (error) {
        console.error(`❌ [Cron] Error syncing product ${product.name}:`, error.message);
        skippedCount++;
      }
    }

    console.log(`✨ [Cron] Sync complete: ${syncedCount} synced, ${skippedCount} skipped`);
  } catch (error) {
    console.error('❌ [Cron] Error executing Shopify sync:', error.message);
  }
}

// Sync Shopify products on server startup
console.log('⏳ Running initial Shopify sync on server startup...');
executeShopifySync();

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Recommendations: http://localhost:${PORT}/recommendations/:userId`);
  console.log(`🛒 Shopify sync (manual): POST http://localhost:${PORT}/api/shopify/sync`);
  console.log(`⏰ Shopify sync (automatic): On server startup/reload`);
});
