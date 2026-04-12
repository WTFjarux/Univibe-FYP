/**
 * middleware/socketAuth.js — JWT Authentication for Socket.IO
 *
 * Authenticates socket connections using JWT token from handshake
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authenticate socket connection
 * @param {Object} socket - Socket.IO socket instance
 * @returns {Promise<Object>} - Authenticated user
 */
const authenticateSocket = async (socket) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      throw new Error("Authentication token missing");
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new Error("User not found");
    }

    // Attach user info to socket
    socket.user = user;
    socket.userId = user._id.toString();

    return user;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

/**
 * Socket.IO middleware for authentication
 */
const socketAuthMiddleware = (socket, next) => {
  authenticateSocket(socket)
    .then(() => next())
    .catch((error) => next(new Error(error.message)));
};

module.exports = { authenticateSocket, socketAuthMiddleware };
