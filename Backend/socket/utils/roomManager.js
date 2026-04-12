/**
 * socket/utils/roomManager.js — Room Management Utilities
 *
 * Manages socket rooms and user tracking
 */

// Store connected users
const connectedUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId
const userRooms = new Map(); // userId -> Set of roomIds

/**
 * Generate room ID for direct chat (1-on-1)
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} - Sorted room ID
 */
const getDirectRoomId = (userId1, userId2) => {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

/**
 * Register user connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
const registerUser = (userId, socketId) => {
  const oldSocketId = connectedUsers.get(userId);
  if (oldSocketId) {
    userSockets.delete(oldSocketId);
  }
  connectedUsers.set(userId, socketId);
  userSockets.set(socketId, userId);
};

/**
 * Remove user connection
 * @param {string} socketId - Socket ID
 */
const unregisterUser = (socketId) => {
  const userId = userSockets.get(socketId);
  if (userId) {
    connectedUsers.delete(userId);
    userRooms.delete(userId);
  }
  userSockets.delete(socketId);
};

/**
 * Get socket ID for a user
 * @param {string} userId - User ID
 * @returns {string|null} - Socket ID or null
 */
const getUserSocketId = (userId) => {
  return connectedUsers.get(userId.toString()) || null;
};

/**
 * Check if user is online
 * @param {string} userId - User ID
 * @returns {boolean} - Online status
 */
const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

/**
 * Add user to room tracking
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 */
const addUserToRoom = (userId, roomId) => {
  if (!userRooms.has(userId)) {
    userRooms.set(userId, new Set());
  }
  userRooms.get(userId).add(roomId);
};

/**
 * Remove user from room tracking
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 */
const removeUserFromRoom = (userId, roomId) => {
  if (userRooms.has(userId)) {
    userRooms.get(userId).delete(roomId);
  }
};

/**
 * Get all rooms a user is in
 * @param {string} userId - User ID
 * @returns {Set} - Set of room IDs
 */
const getUserRooms = (userId) => {
  return userRooms.get(userId) || new Set();
};

/**
 * Get all online users
 * @returns {Array} - Array of online user IDs
 */
const getOnlineUsers = () => {
  return Array.from(connectedUsers.keys());
};

module.exports = {
  connectedUsers,
  userSockets,
  getDirectRoomId,
  registerUser,
  unregisterUser,
  getUserSocketId,
  isUserOnline,
  addUserToRoom,
  removeUserFromRoom,
  getUserRooms,
  getOnlineUsers,
};
