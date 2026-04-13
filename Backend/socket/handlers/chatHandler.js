/**
 * socket/handlers/chatHandler.js — Real-time Chat Event Handlers
 *
 * Handles all chat-related socket events including text, images, and audio messages
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
  AUDIO_PLAYED: "audio_played",
  DELETE_MESSAGE: "delete_message",
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
   * Send a message (supports text, image, audio, file)
   */
  socket.on(
    EVENTS.SEND_MESSAGE,
    async ({
      roomId,
      message,
      type = "text",
      replyTo = null,
      mediaUrl = null,
      duration = null,
    }) => {
      try {
        if (!roomId || (!message && type !== "audio")) {
          socket.emit(EVENTS.ERROR, {
            message: "Room ID and message content are required",
          });
          return;
        }

        // Get user profile for avatar
        const profile = await Profile.findOne({ user: userId });

        // Create message object with audio support
        const messageData = {
          sender: userId,
          senderName: user.name,
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message: type === "audio" ? "🎤 Voice message" : message,
          type,
          replyTo,
          readBy: [{ userId, readAt: new Date() }],
          status: "sent",
        };

        // Add audio-specific fields
        if (type === "audio" && mediaUrl) {
          messageData.mediaUrl = mediaUrl;
          messageData.duration = duration || 0;
          messageData.mediaSize = 0; // Will be updated from file
        }

        // Save to database
        const savedMessage = new Message(messageData);
        await savedMessage.save();

        // Update chat room last message
        const lastMessageText =
          type === "audio"
            ? "🎤 Voice message"
            : message?.substring(0, 100) || "Media message";

        await ChatRoom.findOneAndUpdate(
          { roomId },
          {
            lastMessage: {
              message: lastMessageText,
              sender: userId,
              sentAt: new Date(),
            },
            $inc: { messageCount: 1 },
          },
          { upsert: true },
        );

        // Prepare response with full message data
        const responseMessage = {
          ...messageData,
          _id: savedMessage._id,
          createdAt: savedMessage.createdAt,
          messageId: savedMessage._id,
          duration: savedMessage.duration,
          mediaUrl: savedMessage.mediaUrl,
        };

        // Emit to sender (delivery confirmation)
        socket.emit(EVENTS.MESSAGE_DELIVERED, responseMessage);

        // Emit to everyone else in the room
        socket.to(roomId).emit(EVENTS.RECEIVE_MESSAGE, responseMessage);

        console.log(
          `📨 ${type} message sent to room ${roomId} from ${user.name}`,
        );
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit(EVENTS.ERROR, { message: "Failed to send message" });
      }
    },
  );

  /**
   * Delete a message (soft delete) and broadcast to room
   */
  socket.on(EVENTS.DELETE_MESSAGE, async ({ messageId, roomId }) => {
    try {
      // Verify the message exists
      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit(EVENTS.ERROR, { message: "Message not found" });
        return;
      }

      // Check if user is authorized to delete (must be sender)
      if (message.sender.toString() !== userId) {
        socket.emit(EVENTS.ERROR, {
          message: "Not authorized to delete this message",
        });
        return;
      }

      // Perform soft delete
      message.isDeleted = true;
      message.deletedFor.push(userId);
      await message.save();

      // Update chat room's last message to the most recent non-deleted message
      const lastMessage = await Message.findOne({
        roomId: message.roomId,
        isDeleted: false,
        deletedFor: { $ne: userId },
      })
        .sort({ createdAt: -1 })
        .lean();

      await ChatRoom.findOneAndUpdate(
        { roomId: message.roomId },
        {
          lastMessage: lastMessage
            ? {
                message:
                  lastMessage.type === "audio"
                    ? "🎤 Voice message"
                    : lastMessage.message,
                sender: lastMessage.sender,
                sentAt: lastMessage.createdAt,
              }
            : null,
          updatedAt: lastMessage?.createdAt || new Date(),
        },
      );

      // Broadcast to everyone in the room that a message was deleted
      io.to(roomId).emit("message_deleted", {
        roomId,
        messageId,
        deletedBy: userId,
        timestamp: new Date(),
      });

      console.log(
        `🗑️ Message ${messageId} deleted by ${user.name} in room ${roomId}`,
      );
    } catch (error) {
      console.error("Error deleting message:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to delete message" });
    }
  });

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
   * Mark audio message as played
   */
  socket.on(EVENTS.AUDIO_PLAYED, async ({ messageId, roomId }) => {
    try {
      await Message.markAudioAsPlayed(messageId, userId);

      // Notify room that audio was played (optional)
      socket.to(roomId).emit(EVENTS.AUDIO_PLAYED, {
        userId,
        messageId,
        roomId,
      });
    } catch (error) {
      console.error("Error marking audio as played:", error);
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

        // Add formatted duration for audio messages
        const formattedMessages = messages.map((msg) => ({
          ...msg,
          formattedDuration: msg.duration
            ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, "0")}`
            : null,
        }));

        socket.emit(EVENTS.MESSAGES_HISTORY, {
          roomId,
          messages: formattedMessages.reverse(),
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
