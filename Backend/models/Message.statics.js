// backend/models/Message.statics.js

/**
 * All static methods for Message model.
 * Loaded into the schema to keep Message.js clean.
 * Updated: Added clearedAt support for per-user chat history deletion.
 * Updated: Added forwarding fields to getMessagesLight select.
 */
module.exports = function (messageSchema) {
  // ── HELPER ────────────────────────────────────────────────

  /**
   * Fetch the clearedAt timestamp for a user in a room.
   * Returns null if user has not cleared the chat.
   */
  const getClearedAt = async (roomId, userId) => {
    if (!userId || !roomId) return null;
    const ChatRoom = require("mongoose").model("ChatRoom");
    const room = await ChatRoom.findOne({ roomId }).select("clearedBy").lean();
    if (!room || !room.clearedBy) return null;
    const entry = room.clearedBy.find(
      (c) => c.user.toString() === userId.toString(),
    );
    return entry ? entry.clearedAt : null;
  };

  // ── READ RECEIPTS ──────────────────────────────────────────

  messageSchema.statics.markMessageAsRead = async function (messageId, userId) {
    return this.findByIdAndUpdate(
      messageId,
      {
        $addToSet: { readBy: { user: userId, readAt: new Date() } },
      },
      { new: true },
    );
  };

  /**
   * Mark all messages in a room as read for a user.
   * Only marks messages created after the user's clearedAt timestamp.
   */
  messageSchema.statics.markRoomAsRead = async function (roomId, userId) {
    const clearedAt = await getClearedAt(roomId, userId);

    const query = {
      roomId,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
      isDeleted: false,
    };

    // Only mark messages after clear timestamp as read
    if (clearedAt) {
      query.createdAt = { $gt: clearedAt };
    }

    const result = await this.updateMany(query, {
      $addToSet: { readBy: { user: userId, readAt: new Date() } },
    });
    return result.modifiedCount;
  };

  messageSchema.statics.markMessageAsDelivered = async function (
    messageId,
    userId,
  ) {
    return this.findByIdAndUpdate(
      messageId,
      {
        $addToSet: { deliveredTo: { user: userId, deliveredAt: new Date() } },
      },
      { new: true },
    );
  };

  /**
   * Get unread message count for a user in a room.
   * Only counts messages created after the user's clearedAt timestamp.
   */
  messageSchema.statics.getUnreadCount = async function (roomId, userId) {
    const clearedAt = await getClearedAt(roomId, userId);

    const query = {
      roomId,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
      isDeleted: false,
    };

    if (clearedAt) {
      query.createdAt = { $gt: clearedAt };
    }

    return this.countDocuments(query);
  };

  // ── QUERIES ────────────────────────────────────────────────

  /**
   * Lightweight message fetch with clearedAt filtering.
   * Returns messages created after user's clearedAt timestamp only.
   */
  messageSchema.statics.getMessagesLight = async function (
    roomId,
    limit = 30,
    before = null,
    userId = null,
  ) {
    const clearedAt = await getClearedAt(roomId, userId);

    const query = { roomId, isDeleted: false };

    if (userId) {
      query.deletedFor = { $ne: userId };
    }

    // Apply clearedAt filter - only show messages after clear timestamp
    if (clearedAt) {
      query.createdAt = { $gt: clearedAt };
      // If before is also provided, ensure it doesn't contradict clearedAt
      if (before) {
        const beforeDate = new Date(before);
        if (beforeDate > clearedAt) {
          query.createdAt.$lt = beforeDate;
        }
      }
    } else if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    return this.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select(
        "_id sender senderName senderAvatar roomId message type createdAt status mediaUrl mediaName mediaSize mediaMimeType duration thumbnailUrl locationData replyTo reactions readBy deliveredTo tempId isForwarded originalMessageId originalSenderId originalSenderName forwardedAt",
      )
      .populate("sender", "name avatar")
      .populate("reactions.user", "name")
      .lean();
  };

  /**
   * Full message fetch with clearedAt filtering.
   * Returns messages created after user's clearedAt timestamp only.
   */
  messageSchema.statics.getMessages = async function (
    roomId,
    limit = 50,
    before = null,
    userId = null,
  ) {
    const clearedAt = await getClearedAt(roomId, userId);

    const query = { roomId, isDeleted: false };

    if (userId) {
      query.deletedFor = { $ne: userId };
    }

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

    return this.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("sender", "name avatar")
      .populate("reactions.user", "name")
      .lean();
  };

  // ── AUDIO ──────────────────────────────────────────────────

  messageSchema.statics.markAudioAsPlayed = async function (messageId) {
    return this.findByIdAndUpdate(messageId, { isPlayed: true }, { new: true });
  };

  // ── REACTIONS ──────────────────────────────────────────────

  messageSchema.statics.toggleReaction = async function (
    messageId,
    userId,
    reaction,
  ) {
    const message = await this.findById(messageId);
    if (!message) return null;
    const idx = message.reactions.findIndex(
      (r) => r.user.toString() === userId.toString(),
    );
    if (idx !== -1) {
      if (message.reactions[idx].reaction === reaction)
        message.reactions.splice(idx, 1);
      else {
        message.reactions[idx].reaction = reaction;
        message.reactions[idx].createdAt = new Date();
      }
    } else {
      message.reactions.push({ user: userId, reaction });
    }
    return message.save();
  };

  messageSchema.statics.removeReaction = async function (messageId, userId) {
    return this.findByIdAndUpdate(
      messageId,
      { $pull: { reactions: { user: userId } } },
      { new: true },
    );
  };

  // ── DELETE ─────────────────────────────────────────────────

  messageSchema.statics.softDeleteForUser = async function (messageId, userId) {
    return this.findByIdAndUpdate(
      messageId,
      { $addToSet: { deletedFor: userId } },
      { new: true },
    );
  };
};
