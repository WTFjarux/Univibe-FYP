/**
 * socket/handlers/callHandler.js — WebRTC Signaling for Future Calls
 *
 * Placeholder handlers for audio/video call signaling
 */

const { getUserSocketId, isUserOnline } = require("../utils/roomManager");

const EVENTS = {
  CALL_USER: "call_user",
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice_candidate",
  END_CALL: "end_call",
  CALL_REJECTED: "call_rejected",
  CALL_ACCEPTED: "call_accepted",
  CALL_ERROR: "call_error",
};

/**
 * Setup WebRTC signaling handlers
 * @param {Object} io - Socket.IO server
 * @param {Object} socket - Socket instance
 */
const setupCallHandlers = (io, socket) => {
  const userId = socket.userId;
  const user = socket.user;

  /**
   * Initiate a call to another user
   */
  socket.on(
    EVENTS.CALL_USER,
    ({ targetUserId, callType = "video", offer = null }) => {
      try {
        const targetSocketId = getUserSocketId(targetUserId);

        if (!targetSocketId || !isUserOnline(targetUserId)) {
          socket.emit(EVENTS.CALL_ERROR, { message: "User is offline" });
          return;
        }

        // Send call request to target user
        io.to(targetSocketId).emit(EVENTS.CALL_USER, {
          fromUserId: userId,
          fromUserInfo: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          callType,
          offer,
          timestamp: new Date(),
        });

        console.log(
          `📞 Call initiated from ${user.name} to user ${targetUserId}`,
        );
      } catch (error) {
        console.error("Error initiating call:", error);
        socket.emit(EVENTS.CALL_ERROR, { message: "Failed to initiate call" });
      }
    },
  );

  /**
   * Accept a call
   */
  socket.on(EVENTS.CALL_ACCEPTED, ({ targetUserId }) => {
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(EVENTS.CALL_ACCEPTED, {
        fromUserId: userId,
        timestamp: new Date(),
      });
    }
  });

  /**
   * Reject a call
   */
  socket.on(EVENTS.CALL_REJECTED, ({ targetUserId }) => {
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(EVENTS.CALL_REJECTED, {
        fromUserId: userId,
        timestamp: new Date(),
      });
    }
  });

  /**
   * Send WebRTC offer
   */
  socket.on(EVENTS.OFFER, ({ targetUserId, offer }) => {
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(EVENTS.OFFER, {
        fromUserId: userId,
        offer,
      });
    }
  });

  /**
   * Send WebRTC answer
   */
  socket.on(EVENTS.ANSWER, ({ targetUserId, answer }) => {
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(EVENTS.ANSWER, {
        fromUserId: userId,
        answer,
      });
    }
  });

  /**
   * Send ICE candidate
   */
  socket.on(EVENTS.ICE_CANDIDATE, ({ targetUserId, candidate }) => {
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(EVENTS.ICE_CANDIDATE, {
        fromUserId: userId,
        candidate,
      });
    }
  });

  /**
   * End a call
   */
  socket.on(EVENTS.END_CALL, ({ targetUserId }) => {
    const targetSocketId = getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit(EVENTS.END_CALL, {
        fromUserId: userId,
        timestamp: new Date(),
      });
    }
  });
};

module.exports = { setupCallHandlers, EVENTS };
