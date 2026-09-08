const logger = require('../utils/logger');

/**
 * Queue Socket Handler
 * Manages WebSocket rooms for live queue broadcasts per procurement centre.
 */
const initQueueSocket = (io) => {
  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    // Client joins a centre-specific room for live queue updates
    socket.on('join_centre_queue', (centreId) => {
      if (!centreId) {
        socket.emit('error', { message: 'centreId is required to join a queue room' });
        return;
      }
      const room = `centre_${centreId}`;
      socket.join(room);
      logger.info(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
      socket.emit('joined_queue', { centreId, room, message: `Joined live queue feed for centre ${centreId}` });
    });

    // Client leaves a centre room
    socket.on('leave_centre_queue', (centreId) => {
      const room = `centre_${centreId}`;
      socket.leave(room);
      logger.info(`[Socket.IO] Socket ${socket.id} left room ${room}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

/**
 * Broadcast updated queue state to all connected clients in a centre room.
 * @param {object} io - Socket.IO server instance
 * @param {string} centreId - The centre whose queue was updated
 * @param {object} queueData - The updated queue snapshot to broadcast
 */
const broadcastQueueUpdate = (io, centreId, queueData) => {
  if (!io) {
    logger.warn('[Socket.IO] io instance not available for broadcast');
    return;
  }
  const room = `centre_${centreId}`;
  io.to(room).emit('queue_update', {
    centreId,
    updatedAt: new Date().toISOString(),
    ...queueData
  });
  logger.info(`[Socket.IO] Broadcast queue_update to room ${room}`);
};

module.exports = {
  initQueueSocket,
  broadcastQueueUpdate
};
