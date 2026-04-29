/**
 * socket/handlers/chatHandler.js — Real-time Chat Event Handlers
 * Updated: Added clear_chat event and clearedAt filtering for message history
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
  CLEAR_CHAT: "clear_chat",
  CHAT_CLEARED: "chat_cleared",
  CHAT_RESTORED: "chat_restored",
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
          participants: [
            {
              userId,
              joinedAt: new Date(),
              role: "member",
              lastReadAt: new Date(),
            },
            {
              userId: otherId,
              joinedAt: new Date(),
              role: "member",
              lastReadAt: new Date(),
            },
          ],
          createdBy: userId,
        });
        await chatRoom.save();
      }

      // Send cleared status along with room_joined
      const clearedAt = chatRoom.getClearTimestamp
        ? chatRoom.getClearTimestamp(userId)
        : null;

      socket.emit("room_joined", {
        roomId: finalRoomId,
        success: true,
        clearedAt: clearedAt,
        isCleared: !!clearedAt,
      });

      // Notify others in the room that this user joined
      socket.to(finalRoomId).emit("user_joined_room", {
        userId,
        roomId: finalRoomId,
      });

      console.log(`User ${user?.name || userId} joined room: ${finalRoomId}`);
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
      console.log(`User ${user?.name || userId} left room: ${roomId}`);
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  });

  /**
   * Clear chat history for current user
   * Sets clearedAt timestamp - old messages stay hidden
   * Other participant sees all messages as normal
   */
  socket.on(EVENTS.CLEAR_CHAT, async ({ roomId }) => {
    try {
      if (!roomId) {
        socket.emit(EVENTS.ERROR, { message: "Room ID is required" });
        return;
      }

      const room = await ChatRoom.findOne({ roomId });
      if (!room) {
        socket.emit(EVENTS.ERROR, { message: "Chat room not found" });
        return;
      }

      // Verify user is a participant
      const isParticipant = room.participants.some(
        (p) => p.userId.toString() === userId,
      );
      if (!isParticipant) {
        socket.emit(EVENTS.ERROR, { message: "Not authorized" });
        return;
      }

      const clearedAt = new Date();

      // Remove any existing clearedBy entry for this user
      room.clearedBy = room.clearedBy.filter(
        (entry) => entry.user.toString() !== userId,
      );

      // Add new clearedBy entry
      room.clearedBy.push({
        user: userId,
        clearedAt,
        restoreOnNewMessage: true,
      });

      await room.save();

      // Notify the clearing user
      socket.emit(EVENTS.CHAT_CLEARED, {
        roomId,
        success: true,
        clearedAt,
      });

      console.log(`Chat ${roomId} cleared for user ${userId}`);
    } catch (error) {
      console.error("Clear chat error:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to clear chat" });
    }
  });

  /**
   * Send a message with auto-restore for cleared chats
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

        console.log(`Sending ${type} message to room: ${roomId}`);

        // Check if sender had cleared this chat
        const room = await ChatRoom.findOne({ roomId });
        let wasCleared = false;

        if (room) {
          const clearedEntry = room.clearedBy.find(
            (entry) => entry.user.toString() === userId,
          );
          wasCleared = !!clearedEntry;
        }

        const profile = await Profile.findOne({ user: userId });

        const messageData = {
          sender: userId,
          senderName: user?.name || "Unknown",
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message: type === "audio" ? "Voice message" : message,
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
          // Fetch the original message to get its thumbnailUrl
          const originalMsg = await Message.findById(replyTo.messageId)
            .select("thumbnailUrl")
            .lean();

          messageData.replyTo = {
            messageId: replyTo.messageId,
            message: replyTo.message || "Media message",
            senderName: replyTo.senderName || "Unknown",
            senderId: replyTo.senderId || null,
            type: replyTo.type || "text",
            mediaUrl: replyTo.mediaUrl || null,
            thumbnailUrl:
              originalMsg?.thumbnailUrl || replyTo.thumbnailUrl || null,
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
          type === "audio" ? "Voice message" : message?.substring(0, 100);

        // Update room AND auto-restore if sender had cleared chat
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
            // Auto-restore: Remove sender from clearedBy when they send a message
            ...(wasCleared && {
              $pull: { clearedBy: { user: userId } },
            }),
          },
          { upsert: true },
        );

        // Delivery confirmation to sender
        socket.emit(EVENTS.MESSAGE_DELIVERED, {
          success: true,
          messageId: savedMessage._id,
          message: populatedMessage,
          tempId,
          wasCleared, // Frontend can use this to know chat was auto-restored
        });

        // If chat was auto-restored, notify the sender
        if (wasCleared) {
          socket.emit(EVENTS.CHAT_RESTORED, {
            roomId,
            userId,
          });
        }

        // Broadcast to room (all other users in the room)
        socket.to(roomId).emit(EVENTS.RECEIVE_MESSAGE, populatedMessage);

        // Mark as delivered for online users
        const otherUserId = room?.participants?.find(
          (p) => p.userId.toString() !== userId.toString(),
        );

        if (otherUserId && isUserOnline(otherUserId.userId.toString())) {
          await Message.findByIdAndUpdate(savedMessage._id, {
            $addToSet: {
              deliveredTo: {
                user: otherUserId.userId,
                deliveredAt: new Date(),
              },
            },
          });

          // Notify sender that message was delivered to recipient
          socket.emit(EVENTS.MESSAGE_DELIVERED_TO_RECIPIENT, {
            messageId: savedMessage._id,
            recipientId: otherUserId.userId.toString(),
          });
        }

        console.log(
          `Message sent - Room: ${roomId}, ID: ${savedMessage._id}${
            wasCleared ? " (chat auto-restored)" : ""
          }`,
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
   * Mark all messages in a room as read
   * Only marks messages after user's clearedAt timestamp
   */
  socket.on(EVENTS.MARK_READ, async ({ roomId }) => {
    try {
      if (!roomId) return;

      console.log(`User ${userId} marking room ${roomId} as read`);

      // Mark all messages as read in database (respects clearedAt internally)
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

      // Broadcast to room
      socket.to(roomId).emit(EVENTS.MESSAGES_READ, {
        roomId,
        userId,
        readAt: new Date(),
      });

      console.log(`Broadcast messages_read to room ${roomId} (except sender)`);

      // Acknowledge to reader
      socket.emit(EVENTS.MESSAGES_MARKED_READ, {
        roomId,
        modifiedCount,
      });

      console.log(
        `User ${userId} read ${modifiedCount} messages in room ${roomId}`,
      );
    } catch (error) {
      console.error("Mark read error:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to mark messages as read" });
    }
  });

  /**
   * Mark a single message as read
   */
  socket.on(EVENTS.MARK_MESSAGE_READ, async ({ messageId }) => {
    try {
      const message = await Message.markMessageAsRead(messageId, userId);

      if (message) {
        const senderId = message.sender.toString();
        if (senderId !== userId) {
          // Broadcast to room AND direct notification
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

      console.log(`Audio ${messageId} played by user ${userId}`);
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

      console.log(`Message ${messageId} deleted in room ${roomId}`);
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
   * Get message history with clearedAt filtering
   * Messages created before user's clearedAt are not returned
   */
  socket.on(
    EVENTS.GET_MESSAGES,
    async ({ roomId, limit = 50, before = null }) => {
      try {
        // Get user's clearedAt timestamp for this room
        const room = await ChatRoom.findOne({ roomId })
          .select("clearedBy")
          .lean();
        const clearedEntry = (room?.clearedBy || []).find(
          (c) => c.user.toString() === userId,
        );
        const clearedAt = clearedEntry ? clearedEntry.clearedAt : null;

        let query = {
          roomId,
          isDeleted: false,
          deletedFor: { $ne: userId },
        };

        // Apply clearedAt filter - only show messages after clear timestamp
        if (clearedAt) {
          query.createdAt = { $gt: clearedAt };
          if (before) {
            const beforeDate = new Date(before);
            if (beforeDate > clearedAt) {
              query.createdAt.$lt = beforeDate;
            }
          }
        } else if (before) {
          query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("sender", "name email avatar")
          .populate("readBy.user", "name avatar")
          .lean();

        const formattedMessages = messages.map((msg) => ({
          ...msg,
          formattedDuration: msg.duration
            ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60)
                .toString()
                .padStart(2, "0")}`
            : null,
        }));

        socket.emit(EVENTS.MESSAGES_HISTORY, {
          roomId,
          messages: formattedMessages.reverse(),
          hasMore: messages.length === limit,
          clearedAt: clearedAt,
          isCleared: !!clearedAt,
        });
      } catch (error) {
        console.error("Error getting message history:", error);
        socket.emit(EVENTS.ERROR, { message: "Failed to get message history" });
      }
    },
  );
};

module.exports = { setupChatHandlers, EVENTS };
