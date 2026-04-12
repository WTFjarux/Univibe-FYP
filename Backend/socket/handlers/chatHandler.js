/**
 * socket/handlers/chatHandler.js — Real-time Chat Event Handlers
 *
 * Handles all chat-related socket events
 */

const Message = require("../../models/Message");
const ChatRoom = require("../../models/ChatRoom");
const Profile = require("../../models/Profile");
const {
  getDirectRoomId,
  addUserToRoom,
  removeUserFromRoom,
} = require("../utils/roomManager");

// Socket event constants
const EVENTS = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",
  TYPING: "typing",
  STOP_TYPING: "stop_typing",
  MESSAGE_DELIVERED: "message_delivered",
  MESSAGE_READ: "message_read",
  GET_MESSAGES: "get_messages",
  MESSAGES_HISTORY: "messages_history",
  ERROR: "error",
};

/**
 * Setup chat event handlers
 * @param {Object} io - Socket.IO server
 * @param {Object} socket - Socket instance
 */
const setupChatHandlers = (io, socket) => {
  const userId = socket.userId;
  const user = socket.user;

  /**
   * Join a chat room
   */
  socket.on(
    EVENTS.JOIN_ROOM,
    async ({ roomId, type = "direct", otherUserId = null }) => {
      try {
        let finalRoomId = roomId;

        // For direct messages, generate room ID if not provided
        if (type === "direct" && otherUserId) {
          finalRoomId = getDirectRoomId(userId, otherUserId);

          // Create or get chat room in database
          let chatRoom = await ChatRoom.findOne({ roomId: finalRoomId });
          if (!chatRoom) {
            chatRoom = new ChatRoom({
              roomId: finalRoomId,
              type: "direct",
              participants: [
                { userId, joinedAt: new Date(), role: "member" },
                { userId: otherUserId, joinedAt: new Date(), role: "member" },
              ],
              createdBy: userId,
            });
            await chatRoom.save();
          }
        }

        // Join socket room
        socket.join(finalRoomId);
        addUserToRoom(userId, finalRoomId);

        socket.emit("room_joined", {
          roomId: finalRoomId,
          success: true,
        });

        console.log(`✅ User ${user.name} joined room: ${finalRoomId}`);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit(EVENTS.ERROR, { message: "Failed to join room" });
      }
    },
  );

  /**
   * Leave a chat room
   */
  socket.on(EVENTS.LEAVE_ROOM, ({ roomId }) => {
    try {
      socket.leave(roomId);
      removeUserFromRoom(userId, roomId);

      socket.emit("room_left", {
        roomId,
        success: true,
      });

      console.log(`👋 User ${user.name} left room: ${roomId}`);
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  });

  /**
   * Send a message
   */
  socket.on(
    EVENTS.SEND_MESSAGE,
    async ({ roomId, message, type = "text", replyTo = null }) => {
      try {
        if (!roomId || !message) {
          socket.emit(EVENTS.ERROR, {
            message: "Room ID and message are required",
          });
          return;
        }

        // Get user profile for avatar
        const profile = await Profile.findOne({ user: userId });

        // Create message object
        const messageData = {
          sender: userId,
          senderName: user.name,
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message,
          type,
          replyTo,
          readBy: [{ userId, readAt: new Date() }],
          status: "sent",
        };

        // Save to database
        const savedMessage = new Message(messageData);
        await savedMessage.save();

        // Update chat room last message
        await ChatRoom.findOneAndUpdate(
          { roomId },
          {
            lastMessage: {
              message: message.substring(0, 100),
              sender: userId,
              sentAt: new Date(),
            },
            $inc: { messageCount: 1 },
          },
          { upsert: true },
        );

        // Prepare response
        const responseMessage = {
          ...messageData,
          _id: savedMessage._id,
          createdAt: savedMessage.createdAt,
          messageId: savedMessage._id,
        };

        // Emit to sender (delivery confirmation)
        socket.emit(EVENTS.MESSAGE_DELIVERED, responseMessage);

        // Emit to everyone else in the room
        socket.to(roomId).emit(EVENTS.RECEIVE_MESSAGE, responseMessage);

        console.log(`📨 Message sent to room ${roomId} from ${user.name}`);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit(EVENTS.ERROR, { message: "Failed to send message" });
      }
    },
  );

  /**
   * Handle typing indicator
   */
  socket.on(EVENTS.TYPING, ({ roomId }) => {
    socket.to(roomId).emit(EVENTS.TYPING, {
      userId,
      userName: user.name,
      roomId,
    });
  });

  /**
   * Handle stop typing indicator
   */
  socket.on(EVENTS.STOP_TYPING, ({ roomId }) => {
    socket.to(roomId).emit(EVENTS.STOP_TYPING, {
      userId,
      roomId,
    });
  });

  /**
   * Mark messages as read
   */
  socket.on(EVENTS.MESSAGE_READ, async ({ roomId, messageIds }) => {
    try {
      await Message.updateMany(
        { _id: { $in: messageIds }, "readBy.userId": { $ne: userId } },
        {
          $addToSet: { readBy: { userId, readAt: new Date() } },
          $set: { isRead: true, status: "read" },
        },
      );

      // Notify room that messages were read
      socket.to(roomId).emit(EVENTS.MESSAGE_READ, {
        userId,
        roomId,
        messageIds,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  /**
   * Get message history
   */
  socket.on(
    EVENTS.GET_MESSAGES,
    async ({ roomId, limit = 50, before = null }) => {
      try {
        let query = { roomId, isDeleted: false };
        if (before) {
          query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("sender", "name email")
          .lean();

        socket.emit(EVENTS.MESSAGES_HISTORY, {
          roomId,
          messages: messages.reverse(),
          hasMore: messages.length === limit,
        });
      } catch (error) {
        console.error("Error getting message history:", error);
        socket.emit(EVENTS.ERROR, { message: "Failed to get message history" });
      }
    },
  );
};

module.exports = { setupChatHandlers, EVENTS };
