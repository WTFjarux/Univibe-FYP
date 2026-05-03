/**
 * socket/handlers/userHandler.js — User Status Event Handlers
 *
 * Handles user online/offline status and presence
 */

const User = require("../../models/User");
const Profile = require("../../models/Profile");
const { registerUser, unregisterUser } = require("../utils/roomManager");

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
 * @returns {Function} cleanup function to call on disconnect
 */
const setupUserHandlers = (io, socket) => {
  const userId = socket.userId;
  const user = socket.user;
  let isCleanedUp = false;

  /**
   * Mark user as online when they connect
   */
  const markUserOnline = () => {
    // Register in room manager immediately (sync)
    registerUser(userId, socket.id);

    // Update database and notify connections (async, don't block)
    (async () => {
      try {
        const dbUser = await User.findById(userId);
        if (!dbUser) {
          console.error(`❌ User not found: ${userId}`);
          return;
        }

        await dbUser.updateOnlineStatus(true, socket.id);
        console.log(`🟢 ${dbUser.name} is now ONLINE`);

        // Notify connections
        const currentUser = await User.findById(userId)
          .select("connections")
          .lean();

        if (currentUser?.connections?.length > 0) {
          const profile = await Profile.findOne({ user: userId })
            .select("profilePicture")
            .lean();

          const onlineData = {
            userId,
            name: dbUser.name,
            username: dbUser.username || "",
            profilePicture: profile?.profilePicture || "",
            isOnline: true,
            lastSeen: new Date(),
          };

          currentUser.connections.forEach((connectionId) => {
            io.to(`user_${connectionId.toString()}`).emit(
              EVENTS.USER_ONLINE,
              onlineData,
            );
          });
        }
      } catch (error) {
        console.error("❌ Error marking user online:", error);
      }
    })();
  };

  /**
   * Mark user as offline when they disconnect
   */
  const markUserOffline = async () => {
    if (isCleanedUp) return; // Prevent double execution
    isCleanedUp = true;

    try {
      // Check if user has other active sockets (multi-device)
      const sockets = await io.in(`user_${userId}`).fetchSockets();
      const otherSockets = sockets.filter((s) => s.id !== socket.id);

      if (otherSockets.length > 0) {
        console.log(
          `ℹ️ ${user?.name || userId} has ${otherSockets.length} other active sockets`,
        );
        unregisterUser(socket.id);
        return;
      }

      // No other sockets - user is truly offline
      const dbUser = await User.findById(userId);
      if (dbUser) {
        await dbUser.updateOnlineStatus(false);
        console.log(`🔴 ${dbUser.name} is now OFFLINE`);

        // Notify connections
        const currentUser = await User.findById(userId)
          .select("connections")
          .lean();

        if (currentUser?.connections?.length > 0) {
          const offlineData = {
            userId,
            lastSeen: new Date(),
          };

          currentUser.connections.forEach((connectionId) => {
            io.to(`user_${connectionId.toString()}`).emit(
              EVENTS.USER_OFFLINE,
              offlineData,
            );
          });
        }
      }

      // Clean up room manager
      unregisterUser(socket.id);
    } catch (error) {
      console.error("❌ Error marking user offline:", error);
    }
  };

  /**
   * Get online users from user's connections
   */
  socket.on(EVENTS.GET_ONLINE_USERS, async () => {
    try {
      const currentUser = await User.findById(userId)
        .select("connections")
        .lean();

      if (!currentUser?.connections?.length) {
        socket.emit(EVENTS.ONLINE_USERS, { users: [] });
        return;
      }

      const onlineUsers = await User.find({
        _id: { $in: currentUser.connections },
        isOnline: true,
      })
        .select("name username isOnline lastSeen")
        .lean();

      // Get profile pictures
      const onlineIds = onlineUsers.map((u) => u._id);
      const profiles = await Profile.find({ user: { $in: onlineIds } })
        .select("user profilePicture")
        .lean();

      const profileMap = {};
      profiles.forEach((p) => {
        profileMap[p.user.toString()] = p.profilePicture || null;
      });

      socket.emit(EVENTS.ONLINE_USERS, {
        users: onlineUsers.map((u) => ({
          userId: u._id,
          name: u.name,
          username: u.username,
          profilePicture: profileMap[u._id.toString()] || null,
          isOnline: true,
          lastSeen: u.lastSeen,
        })),
      });
    } catch (error) {
      console.error("Error getting online users:", error);
      socket.emit(EVENTS.ONLINE_USERS, { users: [] });
    }
  });

  // Mark user online immediately on connection
  markUserOnline();

  // Return cleanup function for disconnect
  return markUserOffline;
};

module.exports = { setupUserHandlers, EVENTS };
