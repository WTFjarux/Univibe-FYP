/**
 * config/socketInstance.js
 *
 * Centralized Socket.IO instance for use across the application
 * This allows controllers and services to emit events without circular dependencies
 *
 * Usage:
 *   const { getIO } = require("../config/socketInstance");
 *   const io = getIO();
 *   io.to(`user_${userId}`).emit("force_logout", { message: "..." });
 */

let io = null;

/**
 * Set the Socket.IO instance
 * Called once during server initialization
 * @param {Object} socketIO - Socket.IO server instance
 */
const setIO = (socketIO) => {
  if (!socketIO) {
    console.error("❌ Attempted to set null/undefined Socket.IO instance");
    return;
  }

  io = socketIO;
  console.log("✅ Socket.IO instance stored globally");
};

/**
 * Get the Socket.IO instance
 * @returns {Object|null} - Socket.IO server instance or null if not initialized
 */
const getIO = () => {
  if (!io) {
    console.warn(
      "⚠️ Socket.IO not initialized! Call setIO() during server startup first.",
    );
    return null;
  }
  return io;
};

/**
 * Check if Socket.IO is initialized
 * @returns {boolean}
 */
const isIOInitialized = () => {
  return io !== null;
};

module.exports = {
  setIO,
  getIO,
  isIOInitialized,
};
