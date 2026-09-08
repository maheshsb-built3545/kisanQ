const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
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

// Connect to Database
connectDB();

// CORS Configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
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
