/**
 * socket/handlers/chatHandler.js — Real-time Chat Event Handlers
 *
 * CHAT CLEAR LOGIC:
 * - clearedAt timestamp stored per user in ChatRoom.clearedBy
 * - Messages with createdAt > clearedAt are visible
 * - Messages with createdAt < clearedAt are hidden
 * - clearedBy entries are NEVER auto-removed
 * - Each user has independent clearedAt timestamps
 *
 * MESSAGE DELIVERY:
 * - io.to(`user_X`) - Direct delivery to recipient's personal room
 * - socket.to(roomId) - Broadcast to other sockets in the room
 * - socket.emit - Instant feedback to sender
 */

const Message = require("../../models/Message");
const ChatRoom = require("../../models/ChatRoom");
const Profile = require("../../models/Profile");
const User = require("../../models/User");
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
  FORWARD_MESSAGE: "forward_message",
  FORWARD_MESSAGE_SUCCESS: "forward_message_success",
  FORWARD_MESSAGE_ERROR: "forward_message_error",
  MESSAGE_FORWARDED_TO_ROOM: "message_forwarded_to_room",
  ERROR: "error",
  MESSAGE_ERROR: "message_error",
};

const setupChatHandlers = (io, socket) => {
  const userId = socket.userId;
  const user = socket.user;

  // ===========================================================================
  // JOIN ROOM
  // ===========================================================================
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

      // Find or create chat room
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

      // Send cleared status for this user
      const clearedAt = chatRoom.getClearTimestamp
        ? chatRoom.getClearTimestamp(userId)
        : null;

      socket.emit("room_joined", {
        roomId: finalRoomId,
        success: true,
        clearedAt,
        isCleared: !!clearedAt,
      });

      socket
        .to(finalRoomId)
        .emit("user_joined_room", { userId, roomId: finalRoomId });
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to join room" });
    }
  });

  // ===========================================================================
  // LEAVE ROOM
  // ===========================================================================
  socket.on(EVENTS.LEAVE_ROOM, ({ roomId }) => {
    try {
      socket.leave(roomId);
      removeUserFromRoom(userId, roomId);
      socket.emit("room_left", { roomId, success: true });
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  });

  // ===========================================================================
  // CLEAR CHAT - Sets clearedAt timestamp for current user only
  // ===========================================================================
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

      const isParticipant = room.participants.some(
        (p) => p.userId.toString() === userId,
      );
      if (!isParticipant) {
        socket.emit(EVENTS.ERROR, { message: "Not authorized" });
        return;
      }

      const clearedAt = new Date();

      // Replace existing clearedBy entry for this user
      room.clearedBy = room.clearedBy.filter(
        (entry) => entry.user.toString() !== userId,
      );
      room.clearedBy.push({ user: userId, clearedAt });
      await room.save();

      socket.emit(EVENTS.CHAT_CLEARED, { roomId, success: true, clearedAt });
    } catch (error) {
      console.error("Clear chat error:", error);
      socket.emit(EVENTS.ERROR, { message: "Failed to clear chat" });
    }
  });

  // ===========================================================================
  // SEND MESSAGE
  // ===========================================================================
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
          socket.emit(EVENTS.MESSAGE_ERROR, {
            success: false,
            error: "Room ID and message content are required",
            tempId,
          });
          return;
        }

        const room = await ChatRoom.findOne({ roomId });
        const profile = await Profile.findOne({ user: userId });

        // Build message data
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
            socket.emit(EVENTS.MESSAGE_ERROR, {
              success: false,
              error: "Audio message requires mediaUrl",
              tempId,
            });
            return;
          }
          messageData.mediaUrl = mediaUrl;
          messageData.duration = duration || 0;
        }

        // Attach reply data
        if (replyTo?.messageId) {
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

        // Save to database
        const savedMessage = new Message(messageData);
        await savedMessage.save();

        // Populate for response
        const populatedMessage = await Message.findById(savedMessage._id)
          .populate("sender", "name email avatar")
          .lean();

        if (tempId) populatedMessage.tempId = tempId;

        // Update room metadata (do NOT touch clearedBy)
        const lastMessageText =
          type === "audio" ? "Voice message" : message?.substring(0, 100);
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

        // Confirm delivery to sender
        socket.emit(EVENTS.MESSAGE_DELIVERED, {
          success: true,
          messageId: savedMessage._id,
          message: populatedMessage,
          tempId,
        });

        // Deliver to recipient
        const otherParticipant = room?.participants?.find(
          (p) => p.userId.toString() !== userId.toString(),
        );
        if (otherParticipant) {
          const otherId = otherParticipant.userId.toString();

          // Direct delivery to recipient's personal room
          io.to(`user_${otherId}`).emit(
            EVENTS.RECEIVE_MESSAGE,
            populatedMessage,
          );

          // Broadcast to other sockets in the room (sender's other devices)
          socket.to(roomId).emit(EVENTS.RECEIVE_MESSAGE, populatedMessage);

          // Mark as delivered if recipient is online
          if (isUserOnline(otherId)) {
            await Message.findByIdAndUpdate(savedMessage._id, {
              $addToSet: {
                deliveredTo: { user: otherId, deliveredAt: new Date() },
              },
            });
            socket.emit(EVENTS.MESSAGE_DELIVERED_TO_RECIPIENT, {
              messageId: savedMessage._id,
              recipientId: otherId,
            });
          }
        }
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

  // ===========================================================================
  // FORWARD MESSAGE
  // ===========================================================================
  socket.on(EVENTS.FORWARD_MESSAGE, async ({ messageId, targetChatIds }) => {
    try {
      if (!messageId || !targetChatIds?.length) {
        socket.emit(EVENTS.FORWARD_MESSAGE_ERROR, {
          success: false,
          message: "messageId and targetChatIds required",
        });
        return;
      }
      if (targetChatIds.length > 10) {
        socket.emit(EVENTS.FORWARD_MESSAGE_ERROR, {
          success: false,
          message: "Maximum 10 chats",
        });
        return;
      }

      const originalMessage = await Message.findById(messageId)
        .populate("sender", "name")
        .lean();
      if (!originalMessage) {
        socket.emit(EVENTS.FORWARD_MESSAGE_ERROR, {
          success: false,
          message: "Original message not found",
        });
        return;
      }
      if (originalMessage.isDeleted) {
        socket.emit(EVENTS.FORWARD_MESSAGE_ERROR, {
          success: false,
          message: "Cannot forward deleted message",
        });
        return;
      }

      const targetRooms = await ChatRoom.find({
        roomId: { $in: targetChatIds },
        "participants.userId": userId,
      }).lean();
      const validRoomIds = targetRooms.map((r) => r.roomId);
      if (!validRoomIds.length) {
        socket.emit(EVENTS.FORWARD_MESSAGE_ERROR, {
          success: false,
          message: "No valid target chats",
        });
        return;
      }

      const userInfo = await User.findById(userId).select("name").lean();
      const profile = await Profile.findOne({ user: userId })
        .select("profilePicture")
        .lean();
      const forwardedMessages = [];

      await Promise.all(
        validRoomIds.map(async (targetRoomId) => {
          if (targetRoomId === originalMessage.roomId) return;

          const forwardedData = {
            sender: userId,
            senderName: userInfo?.name || user?.name || "Unknown",
            senderAvatar: profile?.profilePicture || "",
            roomId: targetRoomId,
            message: originalMessage.message,
            type: originalMessage.type,
            isForwarded: true,
            originalMessageId: originalMessage._id,
            originalSenderId:
              originalMessage.sender._id || originalMessage.sender,
            forwardedAt: new Date(),
            readBy: [{ user: userId, readAt: new Date() }],
            deliveredTo: [{ user: userId, deliveredAt: new Date() }],
          };

          if (["image", "video", "file"].includes(originalMessage.type)) {
            forwardedData.mediaUrl = originalMessage.mediaUrl || "";
            forwardedData.thumbnailUrl = originalMessage.thumbnailUrl || "";
            forwardedData.mediaSize = originalMessage.mediaSize || 0;
            forwardedData.mediaName = originalMessage.mediaName || "";
            forwardedData.mediaMimeType = originalMessage.mediaMimeType || "";
            if (originalMessage.type === "video")
              forwardedData.duration = originalMessage.duration;
          } else if (originalMessage.type === "audio") {
            forwardedData.mediaUrl = originalMessage.mediaUrl || "";
            forwardedData.duration = originalMessage.duration || 0;
          } else if (originalMessage.type === "location") {
            forwardedData.locationData = originalMessage.locationData || {};
          }

          if (originalMessage.replyTo?.messageId) {
            forwardedData.replyTo = {
              messageId: originalMessage.replyTo.messageId,
              message: originalMessage.replyTo.message,
              senderName: originalMessage.replyTo.senderName,
              senderId: originalMessage.replyTo.senderId,
              type: originalMessage.replyTo.type || "text",
              mediaUrl: originalMessage.replyTo.mediaUrl,
              thumbnailUrl: originalMessage.replyTo.thumbnailUrl || "",
              duration: originalMessage.replyTo.duration,
            };
          }

          const forwardedMessage = await Message.create(forwardedData);
          forwardedMessages.push(forwardedMessage);

          await ChatRoom.findOneAndUpdate(
            { roomId: targetRoomId },
            {
              lastMessage: {
                message: forwardedData.message?.substring(0, 100) || "",
                sentAt: new Date(),
                senderId: userId,
                senderName: userInfo?.name || "Unknown",
                type: originalMessage.type,
                readBy: [userId],
              },
              updatedAt: new Date(),
              $inc: { messageCount: 1 },
            },
          );

          const populated = await Message.findById(forwardedMessage._id)
            .populate("sender", "name avatar")
            .populate("readBy.user", "name avatar")
            .lean();

          io.to(targetRoomId).emit(EVENTS.RECEIVE_MESSAGE, populated);
          socket.emit(EVENTS.MESSAGE_FORWARDED_TO_ROOM, {
            message: populated,
            roomId: targetRoomId,
            forwardedBy: userId,
            forwardedByName: userInfo?.name || "Unknown",
          });
        }),
      );

      const successful = forwardedMessages.filter(Boolean);
      socket.emit(EVENTS.FORWARD_MESSAGE_SUCCESS, {
        success: true,
        message: `Forwarded to ${successful.length} chat(s)`,
        data: {
          forwardedCount: successful.length,
          forwardedMessages: successful,
        },
      });
    } catch (error) {
      console.error("Forward message error:", error);
      socket.emit(EVENTS.FORWARD_MESSAGE_ERROR, {
        success: false,
        message: error.message || "Failed to forward",
      });
    }
  });

  // ===========================================================================
  // MARK ALL MESSAGES READ
  // ===========================================================================
  socket.on(EVENTS.MARK_READ, async ({ roomId }) => {
    try {
      if (!roomId) return;

      // Find unread messages from OTHER users before marking
      const unreadMessages = await Message.find({
        roomId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
        isDeleted: false,
      })
        .select("sender")
        .lean();

      // Collect unique sender IDs to notify
      const sendersToNotify = [
        ...new Set(unreadMessages.map((msg) => msg.sender.toString())),
      ];

      // Mark all messages as read
      const modifiedCount = await Message.markRoomAsRead(roomId, userId);

      // Update room's lastMessage.readBy
      const room = await ChatRoom.findOne({ roomId });
      if (
        room?.lastMessage &&
        !room.lastMessage.readBy?.some(
          (id) => id.toString() === userId.toString(),
        )
      ) {
        room.lastMessage.readBy = room.lastMessage.readBy || [];
        room.lastMessage.readBy.push(userId);
        await room.save();
      }

      // ✅ Broadcast to room (other sockets in the room)
      socket
        .to(roomId)
        .emit(EVENTS.MESSAGES_READ, { roomId, userId, readAt: new Date() });

      // ✅ Also notify each sender directly (even if they left the room)
      sendersToNotify.forEach((senderId) => {
        io.to(`user_${senderId}`).emit(EVENTS.MESSAGES_READ, {
          roomId,
          userId,
          readAt: new Date(),
        });
      });

      // Acknowledge to reader
      socket.emit(EVENTS.MESSAGES_MARKED_READ, { roomId, modifiedCount });
    } catch (error) {
      console.error("Mark read error:", error);
    }
  });

  // ===========================================================================
  // MARK SINGLE MESSAGE READ
  // ===========================================================================
  socket.on(EVENTS.MARK_MESSAGE_READ, async ({ messageId }) => {
    try {
      const message = await Message.markMessageAsRead(messageId, userId);
      if (message) {
        const senderId = message.sender.toString();
        if (senderId !== userId) {
          io.to(message.roomId).emit(EVENTS.MESSAGE_READ, {
            messageId,
            roomId: message.roomId,
            userId,
            readAt: new Date(),
          });
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

  // ===========================================================================
  // AUDIO PLAYED
  // ===========================================================================
  socket.on(EVENTS.AUDIO_PLAYED, async ({ messageId, roomId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, { isPlayed: true });
      socket.to(roomId).emit(EVENTS.AUDIO_PLAYED, {
        userId,
        messageId,
        roomId,
        playedAt: new Date(),
      });
    } catch (error) {
      console.error("Audio played error:", error);
    }
  });

  // ===========================================================================
  // DELETE MESSAGE
  // ===========================================================================
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
    } catch (error) {
      console.error("Delete message error:", error);
    }
  });

  // ===========================================================================
  // ADD REACTION
  // ===========================================================================
  socket.on(EVENTS.ADD_REACTION, async ({ messageId, reaction }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const idx =
        message.reactions?.findIndex((r) => r.user.toString() === userId) ?? -1;
      if (idx !== -1) {
        message.reactions[idx].reaction = reaction;
        message.reactions[idx].createdAt = new Date();
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

  // ===========================================================================
  // REMOVE REACTION
  // ===========================================================================
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

  // ===========================================================================
  // TYPING INDICATORS
  // ===========================================================================
  socket.on(EVENTS.TYPING, ({ roomId }) => {
    socket
      .to(roomId)
      .emit(EVENTS.TYPING, { userId, userName: user?.name, roomId });
  });

  socket.on(EVENTS.STOP_TYPING, ({ roomId }) => {
    socket.to(roomId).emit(EVENTS.STOP_TYPING, { userId, roomId });
  });

  // ===========================================================================
  // GET MESSAGE HISTORY (with clearedAt filter)
  // ===========================================================================
  socket.on(
    EVENTS.GET_MESSAGES,
    async ({ roomId, limit = 50, before = null }) => {
      try {
        const room = await ChatRoom.findOne({ roomId })
          .select("clearedBy")
          .lean();
        const clearedEntry = (room?.clearedBy || []).find(
          (c) => c.user.toString() === userId,
        );
        const clearedAt = clearedEntry ? clearedEntry.clearedAt : null;

        // Build query with clearedAt filter
        let query = { roomId, isDeleted: false, deletedFor: { $ne: userId } };
        if (clearedAt) {
          query.createdAt = { $gt: clearedAt };
          if (before) {
            const beforeDate = new Date(before);
            if (beforeDate > clearedAt) query.createdAt.$lt = beforeDate;
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
            ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, "0")}`
            : null,
        }));

        socket.emit(EVENTS.MESSAGES_HISTORY, {
          roomId,
          messages: formattedMessages.reverse(),
          hasMore: messages.length === limit,
          clearedAt,
          isCleared: !!clearedAt,
        });
      } catch (error) {
        console.error("Get messages error:", error);
        socket.emit(EVENTS.ERROR, { message: "Failed to get message history" });
      }
    },
  );
};

module.exports = { setupChatHandlers, EVENTS };
