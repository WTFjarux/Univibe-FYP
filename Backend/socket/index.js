/**
 * socket/index.js — Socket.IO Server Setup
 *
 * Initializes all socket handlers and manages connections
 */

const { setupChatHandlers } = require("./handlers/chatHandler");
const { setupUserHandlers } = require("./handlers/userHandler");
const { setupCallHandlers } = require("./handlers/callHandler");

/**
 * Initialize Socket.IO with all handlers
 * @param {Object} io - Socket.IO server instance
 */
const initializeSocketIO = (io) => {
  io.on("connection", (socket) => {
    console.log(
      `🔌 New socket connection: ${socket.id} for user ${socket.user?.name || socket.userId}`,
    );

    // Setup all handlers
    setupChatHandlers(io, socket);
    setupCallHandlers(io, socket);
    const { handleDisconnect } = setupUserHandlers(io, socket);

    // Handle disconnection
    socket.on("disconnect", async () => {
      if (handleDisconnect) {
        await handleDisconnect();
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.userId}:`, error);
    });
  });

  return io;
};

module.exports = { initializeSocketIO };
