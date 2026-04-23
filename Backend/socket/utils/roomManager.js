/**
 * socket/utils/roomManager.js — Room Management Utilities
 */

// Store connected users
const connectedUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId
const userRooms = new Map(); // userId -> Set of roomIds

/**
 * Generate room ID for direct chat
 */
const getDirectRoomId = (userId1, userId2) => {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

/**
 * Register user connection
 */
const registerUser = (userId, socketId) => {
  const oldSocketId = connectedUsers.get(userId);
  if (oldSocketId) userSockets.delete(oldSocketId);
  connectedUsers.set(userId, socketId);
  userSockets.set(socketId, userId);
};

/**
 * Remove user connection
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
 */
const getUserSocketId = (userId) => {
  return connectedUsers.get(userId?.toString()) || null;
};

/**
 * Check if user is online
 */
const isUserOnline = (userId) => {
  return connectedUsers.has(userId?.toString());
};

/**
 * Add user to room tracking
 */
const addUserToRoom = (userId, roomId) => {
  if (!userRooms.has(userId)) userRooms.set(userId, new Set());
  userRooms.get(userId).add(roomId);
};

/**
 * Remove user from room tracking
 */
const removeUserFromRoom = (userId, roomId) => {
  if (userRooms.has(userId)) userRooms.get(userId).delete(roomId);
};

/**
 * Get all rooms a user is in
 */
const getUserRooms = (userId) => {
  return userRooms.get(userId) || new Set();
};

/**
 * Get all online users
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
