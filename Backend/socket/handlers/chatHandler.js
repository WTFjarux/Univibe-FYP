/**
 * socket/handlers/chatHandler.js — Real-time Chat Event Handlers
 */

const Message = require("../../models/Message");
const ChatRoom = require("../../models/ChatRoom");
const Profile = require("../../models/Profile");
const {
  getDirectRoomId,
  addUserToRoom,
  removeUserFromRoom,
  getUserSocketId,
  isUserOnline,
} = require("../utils/roomManager");

const EVENTS = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",
  MESSAGE_DELIVERED: "message_delivered",
  MESSAGE_DELIVERED_TO_RECIPIENT: "message_delivered_to_recipient",
  MARK_READ: "mark_read",
  MESSAGES_READ: "messages_read",
  MESSAGES_MARKED_READ: "messages_marked_read",
  MARK_MESSAGE_READ: "mark_message_read",
  MESSAGE_READ: "message_read",
  TYPING: "typing",
  STOP_TYPING: "stop_typing",
  GET_MESSAGES: "get_messages",
  MESSAGES_HISTORY: "messages_history",
  AUDIO_PLAYED: "audio_played",
  DELETE_MESSAGE: "delete_message",
  MESSAGE_DELETED: "message_deleted",
  ADD_REACTION: "add_reaction",
  REMOVE_REACTION: "remove_reaction",
  REACTION_ADDED: "reaction_added",
  REACTION_REMOVED: "reaction_removed",
  ERROR: "error",
  MESSAGE_ERROR: "message_error",
};

const setupChatHandlers = (io, socket) => {
  const userId = socket.userId;
  const user = socket.user;

  /**
   * Join a chat room
   */
  socket.on(EVENTS.JOIN_ROOM, async ({ roomId, otherUserId = null }) => {
    try {
      let finalRoomId = roomId;

      if (!finalRoomId && otherUserId) {
        finalRoomId = getDirectRoomId(userId, otherUserId);
      }

      if (!finalRoomId) {
        socket.emit(EVENTS.ERROR, { message: "Room ID is required" });
        return;
      }

      socket.join(finalRoomId);
      addUserToRoom(userId, finalRoomId);

      let chatRoom = await ChatRoom.findOne({ roomId: finalRoomId });
      if (!chatRoom) {
        const otherId =
          otherUserId || finalRoomId.split("_").find((id) => id !== userId);
        chatRoom = new ChatRoom({
          roomId: finalRoomId,
          type: "direct",
          participants: [userId, otherId].filter(Boolean),
          createdBy: userId,
        });
        await chatRoom.save();
      }

      socket.emit("room_joined", {
        roomId: finalRoomId,
        success: true,
      });

      // 🔴 Notify others in the room that this user joined
      socket.to(finalRoomId).emit("user_joined_room", {
        userId,
        roomId: finalRoomId,
      });

      console.log(
        `✅ User ${user?.name || userId} joined room: ${finalRoomId}`,
      );
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to join room" });
    }
  });

  /**
   * Leave a chat room
   */
  socket.on(EVENTS.LEAVE_ROOM, ({ roomId }) => {
    try {
      socket.leave(roomId);
      removeUserFromRoom(userId, roomId);
      socket.emit("room_left", { roomId, success: true });
      console.log(`👋 User ${user?.name || userId} left room: ${roomId}`);
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  });

  /**
   * Send a message with full read receipt support
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
        if (!roomId || (!message && type !== "audio")) {
          const errorResponse = {
            success: false,
            error: "Room ID and message content are required",
          };
          if (tempId) errorResponse.tempId = tempId;
          socket.emit(EVENTS.MESSAGE_ERROR, errorResponse);
          return;
        }

        console.log(`📤 Sending ${type} message to room: ${roomId}`);

        const profile = await Profile.findOne({ user: userId });

        const messageData = {
          sender: userId,
          senderName: user?.name || "Unknown",
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message: type === "audio" ? "🎤 Voice message" : message,
          type,
          readBy: [{ user: userId, readAt: new Date() }],
          deliveredTo: [{ user: userId, deliveredAt: new Date() }],
          status: "sent",
          createdAt: new Date(),
        };

        if (type === "audio") {
          if (!mediaUrl) {
            const errorResponse = {
              success: false,
              error: "Audio message requires mediaUrl",
            };
            if (tempId) errorResponse.tempId = tempId;
            socket.emit(EVENTS.MESSAGE_ERROR, errorResponse);
            return;
          }
          messageData.mediaUrl = mediaUrl;
          messageData.duration = duration || 0;
        }

        if (replyTo?.messageId) {
          messageData.replyTo = {
            messageId: replyTo.messageId,
            message: replyTo.message || "Media message",
            senderName: replyTo.senderName || "Unknown",
            senderId: replyTo.senderId || null,
            type: replyTo.type || "text",
            mediaUrl: replyTo.mediaUrl || null,
            duration: replyTo.duration || null,
          };
        }

        const savedMessage = new Message(messageData);
        await savedMessage.save();

        const populatedMessage = await Message.findById(savedMessage._id)
          .populate("sender", "name email avatar")
          .populate("readBy.user", "name avatar")
          .lean();

        if (tempId) {
          populatedMessage.tempId = tempId;
        }

        const lastMessageText =
          type === "audio" ? "🎤 Voice message" : message?.substring(0, 100);

        await ChatRoom.findOneAndUpdate(
          { roomId },
          {
            lastMessage: {
              message: lastMessageText,
              sentAt: new Date(),
              senderId: userId,
              senderName: user?.name || "Unknown",
              type,
              readBy: [userId],
            },
            updatedAt: new Date(),
            $inc: { messageCount: 1 },
          },
          { upsert: true },
        );

        // Delivery confirmation to sender
        socket.emit(EVENTS.MESSAGE_DELIVERED, {
          success: true,
          messageId: savedMessage._id,
          message: populatedMessage,
          tempId,
        });

        // 🔴 Broadcast to room (all other users in the room)
        socket.to(roomId).emit(EVENTS.RECEIVE_MESSAGE, populatedMessage);

        // Mark as delivered for online users
        const room = await ChatRoom.findOne({ roomId });
        const otherUserId = room?.participants.find(
          (p) => p.toString() !== userId.toString(),
        );

        if (otherUserId && isUserOnline(otherUserId.toString())) {
          await Message.findByIdAndUpdate(savedMessage._id, {
            $addToSet: {
              deliveredTo: { user: otherUserId, deliveredAt: new Date() },
            },
          });

          // Notify sender that message was delivered to recipient
          socket.emit(EVENTS.MESSAGE_DELIVERED_TO_RECIPIENT, {
            messageId: savedMessage._id,
            recipientId: otherUserId.toString(),
          });
        }

        console.log(
          `✅ Message sent - Room: ${roomId}, ID: ${savedMessage._id}`,
        );
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit(EVENTS.MESSAGE_ERROR, {
          success: false,
          error: error.message,
          tempId,
        });
      }
    },
  );

  /**
   * 🔴 Mark all messages in a room as read (WhatsApp-level)
   */
  socket.on(EVENTS.MARK_READ, async ({ roomId }) => {
    try {
      if (!roomId) return;

      console.log(`📖 User ${userId} marking room ${roomId} as read`);

      // Mark all messages as read in database
      const modifiedCount = await Message.markRoomAsRead(roomId, userId);

      // Update room's lastMessage.readBy
      const room = await ChatRoom.findOne({ roomId });
      if (room?.lastMessage) {
        if (!room.lastMessage.readBy) {
          room.lastMessage.readBy = [];
        }
        if (
          !room.lastMessage.readBy.some(
            (id) => id.toString() === userId.toString(),
          )
        ) {
          room.lastMessage.readBy.push(userId);
          await room.save();
        }
      }

      // 🔴 FIX: Broadcast to the ROOM (not specific socket)
      // This sends to ALL other users in the room
      socket.to(roomId).emit(EVENTS.MESSAGES_READ, {
        roomId,
        userId,
        readAt: new Date(),
      });

      console.log(
        `📡 Broadcast messages_read to room ${roomId} (except sender)`,
      );

      // Also try direct notification to specific user as fallback
      const otherUserId = room?.participants.find(
        (p) => p.toString() !== userId.toString(),
      );
      if (otherUserId) {
        const otherUserSocketId = getUserSocketId(otherUserId.toString());
        if (otherUserSocketId) {
          // Direct notification as backup
          io.to(otherUserSocketId).emit(EVENTS.MESSAGES_READ, {
            roomId,
            userId,
            readAt: new Date(),
          });
          console.log(`📡 Direct notification to user ${otherUserId}`);
        }
      }

      // Acknowledge to reader
      socket.emit(EVENTS.MESSAGES_MARKED_READ, {
        roomId,
        modifiedCount,
      });

      console.log(
        `✅ User ${userId} read ${modifiedCount} messages in room ${roomId}`,
      );
    } catch (error) {
      console.error("Mark read error:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to mark messages as read" });
    }
  });

  /**
   * 🔴 Mark a single message as read
   */
  socket.on(EVENTS.MARK_MESSAGE_READ, async ({ messageId }) => {
    try {
      const message = await Message.markMessageAsRead(messageId, userId);

      if (message) {
        const senderId = message.sender.toString();
        if (senderId !== userId) {
          // 🔴 FIX: Broadcast to room AND direct notification
          io.to(message.roomId).emit(EVENTS.MESSAGE_READ, {
            messageId,
            roomId: message.roomId,
            userId,
            readAt: new Date(),
          });

          // Direct notification as fallback
          const senderSocketId = getUserSocketId(senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit(EVENTS.MESSAGE_READ, {
              messageId,
              roomId: message.roomId,
              userId,
              readAt: new Date(),
            });
          }
        }

        socket.emit("message_marked_read", { messageId });
      }
    } catch (error) {
      console.error("Mark message read error:", error);
    }
  });

  /**
   * Handle audio played confirmation
   */
  socket.on(EVENTS.AUDIO_PLAYED, async ({ messageId, roomId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, { isPlayed: true });

      socket.to(roomId).emit(EVENTS.AUDIO_PLAYED, {
        userId,
        messageId,
        roomId,
        playedAt: new Date(),
      });

      console.log(`🎧 Audio ${messageId} played by user ${userId}`);
    } catch (error) {
      console.error("Error marking audio as played:", error);
    }
  });

  /**
   * Delete a message
   */
  socket.on(EVENTS.DELETE_MESSAGE, async ({ messageId, roomId }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit(EVENTS.ERROR, { message: "Message not found" });
        return;
      }

      if (message.sender.toString() !== userId) {
        socket.emit(EVENTS.ERROR, { message: "Not authorized" });
        return;
      }

      message.isDeleted = true;
      message.deletedFor = message.deletedFor || [];
      message.deletedFor.push(userId);
      await message.save();

      io.to(roomId).emit(EVENTS.MESSAGE_DELETED, {
        roomId,
        messageId,
        deletedBy: userId,
        timestamp: new Date(),
      });

      console.log(`🗑️ Message ${messageId} deleted in room ${roomId}`);
    } catch (error) {
      console.error("Error deleting message:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to delete message" });
    }
  });

  /**
   * Add reaction to a message
   */
  socket.on(EVENTS.ADD_REACTION, async ({ messageId, reaction }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const existingIndex =
        message.reactions?.findIndex((r) => r.user.toString() === userId) ?? -1;

      if (existingIndex !== -1) {
        message.reactions[existingIndex].reaction = reaction;
        message.reactions[existingIndex].createdAt = new Date();
      } else {
        message.reactions = message.reactions || [];
        message.reactions.push({
          user: userId,
          reaction,
          createdAt: new Date(),
        });
      }

      await message.save();

      io.to(message.roomId).emit(EVENTS.REACTION_ADDED, {
        messageId,
        userId,
        reaction,
        reactions: message.reactions,
      });
    } catch (error) {
      console.error("Add reaction error:", error);
    }
  });

  /**
   * Remove reaction from a message
   */
  socket.on(EVENTS.REMOVE_REACTION, async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      message.reactions = (message.reactions || []).filter(
        (r) => r.user.toString() !== userId,
      );

      await message.save();

      io.to(message.roomId).emit(EVENTS.REACTION_REMOVED, {
        messageId,
        userId,
        reactions: message.reactions,
      });
    } catch (error) {
      console.error("Remove reaction error:", error);
    }
  });

  /**
   * Handle typing indicators
   */
  socket.on(EVENTS.TYPING, ({ roomId }) => {
    socket.to(roomId).emit(EVENTS.TYPING, {
      userId,
      userName: user?.name,
      roomId,
    });
  });

  socket.on(EVENTS.STOP_TYPING, ({ roomId }) => {
    socket.to(roomId).emit(EVENTS.STOP_TYPING, { userId, roomId });
  });

  /**
   * Get message history
   */
  socket.on(
    EVENTS.GET_MESSAGES,
    async ({ roomId, limit = 50, before = null }) => {
      try {
        let query = { roomId, isDeleted: false, deletedFor: { $ne: userId } };
        if (before) query.createdAt = { $lt: new Date(before) };

        const messages = await Message.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("sender", "name email avatar")
          .populate("readBy.user", "name avatar")
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
