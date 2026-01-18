import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
// Increase payload limit to handle large base64 image uploads (up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
  savedRooms: [Object]
});

const User = mongoose.model('User', userSchema);

const marketplaceItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  color: { type: String, required: true },
  type: { type: String, required: true },
  creator: { type: String, required: true },
  data: { type: Object, required: true }, // VoxelObject data
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

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
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
    res.send({ token, email: user.email, userId: user._id }); // Explicitly return userId
  } catch (err) {
    res.status(500).send(err.message);
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
    const { name, price, description, imageUrl, color, type, creator, data } = req.body;
    console.log(`📸 [POST /marketplace] Creating listing: "${name}" - Image size: ${imageUrl?.length || 0} bytes`);
    const item = new MarketplaceItem({ name, price, description, imageUrl, color, type, creator, data });
    await item.save();
    console.log(`✅ [POST /marketplace] Listing saved with ID: ${item._id}`);
    res.status(201).send(item);
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



const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Recommendations: http://localhost:${PORT}/recommendations/:userId`);
});
