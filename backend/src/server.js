const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const routes = require('./routes');
const logger = require('./utils/logger');
const { errorResponse } = require('./utils/apiResponse');
const { initQueueSocket } = require('./socket/queue.socket');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

const authService = require('./services/authService');
const centreService = require('./services/centreService');
const cropPriceService = require('./services/cropPriceService');

// Connect to Database & Seed Administrative Staff, Official APMC Centres, and Crop Prices
connectDB().then(() => {
  authService.seedStaffRegistry().catch((err) => logger.warn(`Staff seed notice: ${err.message}`));
  centreService.ensureOfficialCentres().catch((err) => logger.warn(`Centre sync notice: ${err.message}`));
  cropPriceService.seedCropPrices().catch((err) => logger.warn(`Crop price sync notice: ${err.message}`));
});
// Prime in-memory fallbacks immediately
authService.seedStaffRegistry().catch(() => {});
centreService.ensureOfficialCentres().catch(() => {});
cropPriceService.seedCropPrices().catch(() => {});


// CORS Configuration - Permissive for dev and Vite frontend ports
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5185';
const allowedOrigins = [
  clientUrl,
  'http://localhost:5185',
  'http://127.0.0.1:5185',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) or matching origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive CORS for development & demo
  },
  credentials: true
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize modular Socket.IO queue handler
initQueueSocket(io);

// Attach io to request object for use in controllers/services if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint with database connection status
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'disconnected',
    cluster: isDbConnected ? (mongoose.connection.host || 'MongoDB Atlas') : 'offline_fallback',
    service: 'KisanQ Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', routes);

// 404 Route Handler
app.use((req, res) => {
  return errorResponse(res, `Route not found: ${req.originalUrl}`, 404);
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack });
  return errorResponse(res, 'Internal server error', 500, process.env.NODE_ENV === 'development' ? err.message : null);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`[Server] KisanQ backend running on port ${PORT}`);
  logger.info(`[Server] Health check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, server, io };
