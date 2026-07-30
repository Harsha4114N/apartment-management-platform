const { Server } = require('socket.io');

let io = null;

/**
 * Builds a consistent CORS origin validator used by both Express and Socket.io.
 * In production, only CLIENT_URL is allowed. In dev, all origins are accepted.
 * Requests with no origin (server-to-server, mobile apps) are always allowed.
 */
function createCorsOrigin() {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter(Boolean);

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  };
}

/**
 * Initializes Socket.io on the given HTTP server.
 * Must be called once during server startup.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: createCorsOrigin(),
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join a room scoped to a specific societyId so we can target broadcasts
    socket.on('join-society', (societyId) => {
      if (societyId) {
        socket.join(`society:${societyId}`);
        console.log(`[Socket.io] ${socket.id} joined society:${societyId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[Socket.io] Initialized successfully.');
  return io;
}

/**
 * Returns the existing Socket.io instance.
 * Throws if called before initSocket().
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io must be initialized before calling getIO()');
  }
  return io;
}

module.exports = { initSocket, getIO };
