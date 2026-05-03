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
    const userId = socket.userId;
    const userName = socket.user?.name || "Unknown";

    console.log(
      `🔌 New socket connection: ${socket.id} for user ${userName} (${userId})`,
    );

    // Join user's personal room for targeted events
    if (userId) {
      socket.join(`user_${userId}`);
    }

    // ✅ IMPORTANT: Setup user handlers FIRST
    // This marks the user as online BEFORE any room joins happen
    const cleanup = setupUserHandlers(io, socket);

    // Setup chat and call handlers AFTER user is registered
    setupChatHandlers(io, socket);
    setupCallHandlers(io, socket);

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        if (cleanup) {
          await cleanup();
        }
      } catch (error) {
        console.error(`Error during disconnect for ${userId}:`, error);
      }
      console.log(`🔌 Socket disconnected: ${socket.id} (${userName})`);
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for ${userId}:`, error.message);
    });
  });

  console.log("✅ Socket.IO initialized and listening for connections");
  return io;
};

module.exports = { initializeSocketIO };
