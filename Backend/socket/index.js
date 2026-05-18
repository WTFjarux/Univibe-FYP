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
  // =============================================================================
  // HELPER: Force logout a specific user (used by admin controllers)
  // =============================================================================
  io.forceUserLogout = (targetUserId, data = {}) => {
    if (!targetUserId) {
      console.error("❌ forceUserLogout: No user ID provided");
      return false;
    }

    try {
      const userId = targetUserId.toString();
      const roomName = `user_${userId}`;

      console.log(`🔒 Force logout initiated for user: ${userId}`);

      const logoutData = {
        message:
          data.message || "Your account has been actioned by an administrator.",
        code: data.code || "FORCE_LOGOUT",
        reason: data.reason || "",
        timestamp: new Date().toISOString(),
      };

      // Step 1: Emit to the user's personal room
      io.to(roomName).emit("force_logout", logoutData);

      // Step 2: Get all socket IDs in the user's room
      const socketsInRoom = io.sockets.adapter.rooms.get(roomName);

      if (socketsInRoom && socketsInRoom.size > 0) {
        console.log(
          `📡 Found ${socketsInRoom.size} active socket(s) for user ${userId}`,
        );

        socketsInRoom.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket && socket.connected) {
            // Send directly to each socket to ensure delivery
            socket.emit("force_logout", {
              ...logoutData,
              immediate: true,
            });

            // Disconnect after a short delay to allow event delivery to client
            setTimeout(() => {
              if (socket.connected) {
                socket.disconnect(true);
                console.log(
                  `🔌 Force disconnected socket ${socketId} for user ${userId}`,
                );
              }
            }, 500);
          }
        });
      } else {
        console.log(
          `ℹ️ No active sockets found for user ${userId} (user may be offline)`,
        );
      }

      return true;
    } catch (error) {
      console.error(
        `❌ Error in forceUserLogout for user ${targetUserId}:`,
        error.message,
      );
      return false;
    }
  };

  // =============================================================================
  // HELPER: Notify all connected admins
  // =============================================================================
  io.notifyAdmins = (event, data) => {
    console.log(`📢 Notifying admins: ${event}`);
    io.to("admin_room").emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  };

  // =============================================================================
  // HELPER: Check if a user has active socket connections
  // =============================================================================
  io.isUserOnline = (userId) => {
    if (!userId) return false;
    const roomName = `user_${userId}`;
    const sockets = io.sockets.adapter.rooms.get(roomName);
    return sockets ? sockets.size > 0 : false;
  };

  // =============================================================================
  // CONNECTION HANDLER
  // =============================================================================
  io.on("connection", (socket) => {
    const userId = socket.userId;
    const userName = socket.user?.name || "Unknown";

    console.log(
      `🔌 New socket connection: ${socket.id} for user ${userName} (${userId})`,
    );

    // Join user's personal room for targeted events
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`📨 User ${userName} joined personal room: user_${userId}`);
    }

    // Join admin room if user is an admin
    if (socket.user?.role === "admin") {
      socket.join("admin_room");
      console.log(`🛡️ Admin ${userName} joined admin room`);
    }

    // ===========================================================================
    // SETUP HANDLERS
    // ===========================================================================

    // Setup user handlers FIRST (marks user online, handles presence)
    const cleanup = setupUserHandlers(io, socket);

    // Setup chat handlers
    setupChatHandlers(io, socket);

    // Setup call handlers
    setupCallHandlers(io, socket);

    // ===========================================================================
    // CLIENT-INITIATED EVENTS
    // ===========================================================================

    // Client acknowledges force logout (for logging)
    socket.on("force_logout_acknowledged", (data) => {
      console.log(
        `✅ User ${userId} acknowledged force logout: ${data?.code || "N/A"}`,
      );
    });

    // ===========================================================================
    // DISCONNECTION
    // ===========================================================================
    socket.on("disconnect", async () => {
      try {
        if (cleanup) {
          await cleanup();
        }
      } catch (error) {
        console.error(`Error during cleanup for ${userId}:`, error.message);
      }
      console.log(
        `🔌 Socket disconnected: ${socket.id} for user ${userName} (${userId})`,
      );
    });

    // ===========================================================================
    // ERROR HANDLING
    // ===========================================================================
    socket.on("error", (error) => {
      console.error(`Socket error for ${userId}:`, error.message);
    });
  });

  console.log("✅ Socket.IO initialized with force logout support");
  return io;
};

module.exports = { initializeSocketIO };
