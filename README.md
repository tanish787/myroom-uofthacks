# MyRoom: Architect

> A 3D room designer and decoration platform built with React, Three.js, and Node.js. Create, customize, and shop for voxel-based furniture in an interactive 3D environment.

<div align="center">

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-0.182-black?logo=three.js)](https://threejs.org)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org)

</div>

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Key Features Deep Dive](#-key-features-deep-dive)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributors](#-contributors)
- [License](#-license)

## 🎯 Project Overview

**MyRoom: Architect** combines 3D visualization, AI-powered design assistance, and e-commerce. Users can:

- **Design 3D Rooms**: Create and customize voxel-based room layouts with an intuitive 3D editor
- **AI Assistance**: Use Google Gemini AI to generate design suggestions, analyze room layouts, and auto-decorate spaces
- **Marketplace**: Browse and purchase furniture items from other sellers (with Shopify integration for sellers)
- **User Accounts**: Create accounts as buyers or sellers with JWT authentication
- **Seller Dashboard**: Sellers can upload custom furniture items to the marketplace

This project was built for **UofTHacks13 (2026)** hackathon and demonstrates full-stack development with real-time 3D graphics, AI integration, and e-commerce capabilities.

## Features

### 3D Room Editor
- **Voxel-based Design**: Create furniture and room elements using a simple voxel system
- **Real-time 3D Visualization**: Interactive Three.js/React-Three-Fiber rendering
- **Multiple Views**: Toggle between camera view, object visibility, and rotation controls
- **Room Customization**: Adjust wall colors, floor colors, and room dimensions
- **Object Properties**: Edit name, type, position, rotation, color, and description for each object

### AI-Powered Features
- **Room Analysis**: Upload images or describe your room, and AI generates design suggestions
- **Auto-Decoration**: AI automatically suggests and places furniture in your room
- **Object Refinement**: Get AI suggestions to improve individual furniture pieces
- **Conversational Design**: Chat-based interface for back-and-forth design iterations
- **Smart Suggestions**: AI-powered recommendations based on room type and style

### Marketplace
- **Browse Items**: Search, filter, and sort marketplace items by category
- **Pagination**: Efficient loading with 50 items per page
- **User Purchases**: Add items to cart and complete purchases
- **Seller Integration**: Shopify integration for sellers to link products
- **Item Details**: View full details, dimensions, and creator information

### User Management
- **Authentication**: Secure JWT-based authentication
- **Account Types**: Separate buyer and seller account types
- **Seller Dashboard**: Manage and upload custom furniture items
- **Profile Management**: Edit user information and account settings
- **Purchase History**: Track past purchases and items added to cart

### Shopify Integration
- **Seller Store Sync**: Automatically sync Shopify store products to marketplace
- **Product Linking**: Link marketplace items to Shopify products for direct sales
- **Cron Jobs**: Scheduled syncing of Shopify inventory
- **Buy on Shopify Button**: Direct checkout for Shopify-linked items

## Tech Stack

### Frontend
- **React 19**: Modern UI library with hooks
- **TypeScript 5.8**: Type-safe development
- **Vite 6**: Fast build tool and dev server
- **Three.js 0.182**: 3D graphics library
- **React-Three-Fiber 9.5**: React renderer for Three.js
- **@react-three/drei 10.7**: Utilities for React-Three-Fiber
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library

### Backend
- **Node.js**: JavaScript runtime
- **Express 5.2**: Web framework
- **Mongoose 9.1**: MongoDB object modeling
- **MongoDB Atlas**: Cloud database (connection pooling: 50 max)
- **bcryptjs 3.0**: Password hashing
- **jsonwebtoken 9.0**: JWT authentication
- **CORS 2.8**: Cross-origin resource sharing
- **node-cron 4.2**: Task scheduling for Shopify sync
- **node-fetch 3.3**: HTTP client
- **dotenv 17.2**: Environment configuration

### External APIs
- **Google Gemini API**: AI-powered room analysis and design suggestions
- **Shopify Storefront API**: Product synchronization
- **OpenRouter API**: Alternative AI inference (optional)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **Git** (for cloning the repository)

Optional:
- **MongoDB Account** (for local development, Atlas is recommended)
- **Shopify Developer Account** (for seller features)
- **Google Gemini API Key** (for AI features)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/voxelroom-architect.git
cd voxelroom-architect
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

## Environment Setup

### Frontend Configuration

Create a `.env` file in the project root with the following variables:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_OPENROUTER_API_KEY=your_openrouter_key_here
```

### Backend Configuration

Create a `.env` file in the `server/` directory:

```env
# MongoDB Configuration
MONGODB_URI=your-MONGODB-ATLAS-key

# Shopify Configuration
SHOPIFY_STORE_NAME=your-store-name
SHOPIFY_ACCESS_TOKEN=your_shopify_token

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret (generate a strong random string)
JWT_SECRET=your_jwt_secret_key_here
```

### Obtaining API Keys

**Google Gemini API:**
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create a new API key
3. Copy and paste it to your `.env` file

**Shopify API:**
1. Create a [Shopify Developer Account](https://www.shopify.com/partners)
2. Create a custom app and generate access tokens
3. Add to your backend `.env` file

**MongoDB Atlas:**
1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string
3. Add to your backend `.env` file

## Running the Application

### Development Mode

#### Terminal 1: Start the Frontend (Vite Dev Server)

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

#### Terminal 2: Start the Backend Server

```bash
cd server
node server.js
```

Or use npm script:

```bash
cd server
npm start
```

The backend API will be available at `http://localhost:5000`

### Production Build

```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
voxelroom-architect/
├── src/
│   ├── App.tsx                 # Main application component
│   ├── index.tsx              # React entry point
│   ├── types.ts               # TypeScript type definitions
│   ├── services/
│   │   ├── geminiService.ts   # Google Gemini AI integration
│   │   └── shopifyService.ts  # Shopify API integration
│   ├── components/
│   │   ├── VoxelScene.tsx     # 3D scene renderer with Three.js
│   │   └── VoxelObject.tsx    # Individual voxel object renderer
│   └── styles/
│       └── tailwind.css       # Tailwind CSS configuration
├── server/
│   ├── server.js              # Express server & API endpoints
│   ├── .env                   # Backend environment variables
│   └── node_modules/
├── public/
│   └── index.html             # HTML template
├── index.html                 # Vite entry HTML
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Frontend dependencies
└── README.md                  # This file
```

## API Documentation

### Authentication Endpoints

#### POST `/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "accountType": "buyer" // or "seller"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here"
}
```

#### POST `/auth/login`
Login to an existing account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": { "email": "user@example.com", "name": "John Doe", ... }
}
```

### Marketplace Endpoints

#### GET `/marketplace?page=1&limit=50&search=chair`
Fetch paginated marketplace items.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `search` (optional): Search term

**Response:**
```json
{
  "items": [
    {
      "_id": "...",
      "name": "Modern Chair",
      "creator": "seller@example.com",
      "source": "marketplace",
      "price": 99.99,
      "category": "furniture",
      "shopifyLink": "https://shop.myshopify.com/products/..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3,
    "hasMore": true
  }
}
```

#### GET `/marketplace/:id/full`
Get complete item details including voxel data.

**Response:**
```json
{
  "_id": "...",
  "name": "Modern Chair",
  "parts": [ ... ],
  "position": [0, 0, 0],
  "rotation": 0,
  "color": "#FF5733",
  "description": "Comfortable modern chair"
}
```

#### POST `/marketplace`
Create a new marketplace item (seller only).

**Request Body:**
```json
{
  "name": "New Furniture",
  "category": "furniture",
  "price": 99.99,
  "description": "Furniture description",
  "parts": [ ... ]
}
```

### Room Management Endpoints

#### POST `/rooms`
Save a room design.

#### GET `/rooms/:id`
Load a saved room design.

### Health Check

#### GET `/health`
Check server and database status.

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 3600
}
```

## 🎮 Key Features Deep Dive

### 3D Voxel System

Objects are represented as collections of voxel parts:

```typescript
interface VoxelPart {
  offset: [number, number, number];      // Position relative to object
  dimensions: [number, number, number];  // Size in voxels
  color?: string;                         // RGB or HEX color
}

interface VoxelObject {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: number;
  parts: VoxelPart[];
  color: string;
  description: string;
}
```

### AI Integration

The app uses Google Gemini API for:
- **Room Analysis**: Upload a photo, AI understands the room layout
- **Design Suggestions**: Get furniture recommendations
- **Auto-decoration**: AI places furniture automatically
- **Object Refinement**: Improve furniture designs

Example AI prompt:
```
Analyze this room image and suggest furniture placement for a modern minimalist style.
Then generate voxel coordinates for each suggested piece.
```

### Marketplace Features

- **Search & Filter**: Full-text search on item names and descriptions
- **Pagination**: Efficiently load marketplace with 50 items per page
- **Creator Info**: See who created each item
- **Shopify Integration**: Sellers can link marketplace items to Shopify products
- **Shopping Cart**: Add items and manage purchases

### Database Connection

MongoDB connection pool configuration:
- **Max Pool Size**: 50 concurrent connections
- **Min Pool Size**: 5 persistent connections
- **Timeouts**: 15s connection, 60s socket, optimized for performance

## Development

### Adding New Features

1. **New AI Capabilities**:
   - Update `services/geminiService.ts`
   - Add new prompt templates and API calls

2. **New Marketplace Items**:
   - Create voxel parts in `App.tsx`
   - Add item to database via POST `/marketplace`

3. **New Room Features**:
   - Update `VoxelScene.tsx` for rendering
   - Update `types.ts` for data structure
   - Add corresponding backend endpoints

### Code Style

- Use TypeScript for type safety
- Follow React hooks best practices
- Use Tailwind CSS for styling
- Keep components focused and reusable

## Contributors

- **Team**: Tanish Ariyur, Ryan Gao, Brian Xiao, Subodh Thallada
- **Technologies**: React, Three.js, Node.js, MongoDB, Google Gemini API

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support & Questions

For questions or issues:
- Open an issue on GitHub
- Contact the development team
- Check the documentation in `/docs`

## Acknowledgments

- University of Toronto Computer Science Student Association for hosting UofTHacks13!
- Google Gemini API for AI capabilities
- Three.js community for 3D graphics
- React ecosystem for frontend framework
- MongoDB Atlas for reliable database hosting
- Shopify for e-commerce integration

---
