/**
 * socket/handlers/userHandler.js — User Status Event Handlers
 *
 * Handles user online/offline status and presence
 */

const User = require("../../models/User");
const {
  registerUser,
  unregisterUser,
  getOnlineUsers,
} = require("../utils/roomManager");

const EVENTS = {
  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",
  GET_ONLINE_USERS: "get_online_users",
  ONLINE_USERS: "online_users",
};

/**
 * Setup user status handlers
 * @param {Object} io - Socket.IO server
 * @param {Object} socket - Socket instance
 */
const setupUserHandlers = (io, socket) => {
  const userId = socket.userId;
  const user = socket.user;

  /**
   * Handle user connection (called automatically)
   */
  const handleConnect = async () => {
    // Register user
    registerUser(userId, socket.id);

    // Update user status in database
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
      socketId: socket.id,
    });

    // Broadcast online status to all connected users
    io.emit(EVENTS.USER_ONLINE, {
      userId,
      userInfo: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      timestamp: new Date(),
    });

    console.log(`✅ User ${user.name} (${userId}) is now online`);
  };

  /**
   * Handle user disconnection
   */
  const handleDisconnect = async () => {
    // Unregister user
    unregisterUser(socket.id);

    // Update user status in database
    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date(),
      socketId: "",
    });

    // Broadcast offline status
    io.emit(EVENTS.USER_OFFLINE, {
      userId,
      lastSeen: new Date(),
    });

    console.log(`❌ User ${user.name} (${userId}) went offline`);
  };

  /**
   * Get all online users
   */
  socket.on(EVENTS.GET_ONLINE_USERS, () => {
    const onlineUsers = getOnlineUsers();
    socket.emit(EVENTS.ONLINE_USERS, { users: onlineUsers });
  });

  // Call handleConnect immediately
  handleConnect();

  // Return handlers for external use
  return { handleDisconnect };
};

module.exports = { setupUserHandlers, EVENTS };
