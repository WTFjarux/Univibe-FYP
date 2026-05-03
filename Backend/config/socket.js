/**
 * config/socket.js — Socket.IO Server Configuration
 *
 * Sets up Socket.IO with CORS and authentication
 */

const { Server } = require("socket.io");
const { socketAuthMiddleware } = require("../middleware/socketAuth");

/**
 * Create and configure Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} - Configured Socket.IO server
 */
const setupSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN?.split(",") || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Connection settings
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket"],
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  return io;
};

module.exports = { setupSocketIO };
