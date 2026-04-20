/**
 * socket/handlers/chatHandler.js — Real-time Chat Event Handlers
 *
 * Handles all chat-related socket events including text, images, audio, and replies
 * with support for optimistic message updates via tempId tracking
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
   * Send a message with reply support and tempId acknowledgment
   * FULLY UPDATED: Handles text, audio, and all message types with real-time delivery
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
      tempId = null,
    }) => {
      try {
        // Validation
        if (!roomId || (!message && type !== "audio")) {
          const errorResponse = {
            success: false,
            error: "Room ID and message content are required",
          };
          if (tempId) errorResponse.tempId = tempId;
          socket.emit(EVENTS.ERROR, errorResponse);
          return;
        }

        console.log(
          `📤 Sending ${type} message${tempId ? ` with tempId: ${tempId}` : ""} to room: ${roomId}`,
        );

        // Get user profile for avatar
        const profile = await Profile.findOne({ user: userId });

        // Create message object
        const messageData = {
          sender: userId,
          senderName: user.name,
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message: type === "audio" ? "🎤 Voice message" : message,
          type,
          readBy: [{ userId, readAt: new Date() }],
          status: "sent",
          createdAt: new Date(),
        };

        // Add audio-specific fields (CRITICAL for voice messages)
        if (type === "audio") {
          if (!mediaUrl) {
            console.error("❌ Audio message missing mediaUrl");
            const errorResponse = {
              success: false,
              error: "Audio message requires mediaUrl",
            };
            if (tempId) errorResponse.tempId = tempId;
            socket.emit(EVENTS.ERROR, errorResponse);
            return;
          }
          messageData.mediaUrl = mediaUrl;
          messageData.duration = duration || 0;
          messageData.mediaSize = 0;
          console.log(
            `🎤 Audio message details - URL: ${mediaUrl}, Duration: ${duration}s`,
          );
        }

        // Add replyTo data if present
        if (replyTo && replyTo.messageId) {
          try {
            const mongoose = require("mongoose");
            if (mongoose.Types.ObjectId.isValid(replyTo.messageId)) {
              console.log(
                `🔍 Looking up original message: ${replyTo.messageId}`,
              );
              const originalMessage = await Message.findById(replyTo.messageId);

              if (originalMessage && !originalMessage.isDeleted) {
                messageData.replyTo = {
                  messageId: replyTo.messageId,
                  message: (
                    originalMessage.message || "Media message"
                  ).substring(0, 100),
                  senderName: originalMessage.senderName || "Unknown",
                };
                console.log(
                  `✅ Attached replyTo context for sender: ${messageData.replyTo.senderName}`,
                );
              }
            }
          } catch (err) {
            console.error("⚠️ Error processing replyTo context:", err);
          }
        }

        // Save to database
        const savedMessage = new Message(messageData);
        await savedMessage.save();
        console.log(`💾 Message saved to DB with ID: ${savedMessage._id}`);

        // Fetch the complete message with populated fields
        const populatedMessage = await Message.findById(savedMessage._id)
          .populate("sender", "name email")
          .lean();

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
          ...populatedMessage,
          _id: savedMessage._id,
          createdAt: savedMessage.createdAt,
          messageId: savedMessage._id,
          duration: savedMessage.duration,
          mediaUrl: savedMessage.mediaUrl,
          type: savedMessage.type,
        };

        // Send delivery confirmation to sender with tempId mapping
        const deliveryConfirmation = {
          success: true,
          messageId: savedMessage._id,
          message: responseMessage,
          _id: savedMessage._id,
          createdAt: savedMessage.createdAt,
        };

        if (tempId) {
          deliveryConfirmation.tempId = tempId;
          console.log(
            `✅ Delivery confirmation sent: tempId ${tempId} → messageId ${savedMessage._id}`,
          );
        }

        socket.emit(EVENTS.MESSAGE_DELIVERED, deliveryConfirmation);

        // CRITICAL: Broadcast to everyone else in the room
        // This ensures real-time delivery for all message types including audio
        socket.to(roomId).emit(EVENTS.RECEIVE_MESSAGE, responseMessage);
        console.log(
          `📡 Broadcasted ${type} message to room ${roomId} (${socket.adapter.rooms.get(roomId)?.size || 0} recipients)`,
        );

        console.log(
          `✅ ${type.toUpperCase()} message sent successfully - Room: ${roomId}, Sender: ${user.name}${tempId ? `, TempID: ${tempId}` : ""}`,
        );
      } catch (error) {
        console.error("❌ CRITICAL ERROR in SEND_MESSAGE handler:");
        console.error("   Error Message:", error.message);
        console.error("   Stack Trace:", error.stack);

        const errorResponse = {
          success: false,
          message: "Failed to send message",
          error: error.message,
        };

        if (tempId) errorResponse.tempId = tempId;

        socket.emit(EVENTS.ERROR, errorResponse);
      }
    },
  );

  /**
   * Handle audio played confirmation
   */
  socket.on(EVENTS.AUDIO_PLAYED, async ({ messageId, roomId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { playedBy: userId },
        isPlayed: true,
      });

      // Notify sender that audio was played (optional)
      socket.to(roomId).emit(EVENTS.AUDIO_PLAYED, {
        userId,
        messageId,
        roomId,
        playedAt: new Date(),
      });

      console.log(`🎧 Audio message ${messageId} played by ${user.name}`);
    } catch (error) {
      console.error("Error marking audio as played:", error);
    }
  });

  /**
   * Delete a message (soft delete) and broadcast to room
   */
  socket.on(EVENTS.DELETE_MESSAGE, async ({ messageId, roomId }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit(EVENTS.ERROR, { message: "Message not found" });
        return;
      }

      if (message.sender.toString() !== userId) {
        socket.emit(EVENTS.ERROR, {
          message: "Not authorized to delete this message",
        });
        return;
      }

      message.isDeleted = true;
      message.deletedFor.push(userId);
      await message.save();

      // Update chat room's last message
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
          $set: { status: "read" },
        },
      );

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
