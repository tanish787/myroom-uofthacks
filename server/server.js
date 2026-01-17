const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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
    res.send(items);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/marketplace', async (req, res) => {
  try {
    const { name, price, description, imageUrl, color, type, creator, data } = req.body;
    const item = new MarketplaceItem({ name, price, description, imageUrl, color, type, creator, data });
    await item.save();
    res.status(201).send(item);
  } catch (err) {
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

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
