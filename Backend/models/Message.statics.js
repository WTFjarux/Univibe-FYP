// backend/models/Message.statics.js

/**
 * All static methods for Message model.
 * Loaded into the schema to keep Message.js clean.
 */
module.exports = function (messageSchema) {
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

  messageSchema.statics.markRoomAsRead = async function (roomId, userId) {
    const result = await this.updateMany(
      {
        roomId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
        isDeleted: false,
      },
      { $addToSet: { readBy: { user: userId, readAt: new Date() } } },
    );
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

  messageSchema.statics.getUnreadCount = async function (roomId, userId) {
    return this.countDocuments({
      roomId,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
      isDeleted: false,
    });
  };

  // ── QUERIES ────────────────────────────────────────────────

  /** Lightweight message fetch (for initial + pagination) */
  messageSchema.statics.getMessagesLight = async function (
    roomId,
    limit = 30,
    before = null,
    userId = null,
  ) {
    const query = { roomId, isDeleted: false };
    if (userId) query.deletedFor = { $ne: userId };
    if (before) query.createdAt = { $lt: new Date(before) };

    return this.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select(
        "_id sender senderName roomId message type createdAt mediaUrl mediaName mediaSize duration thumbnailUrl replyTo reactions readBy tempId locationData",
      )
      .populate("sender", "name avatar")
      .populate("reactions.user", "name")
      .lean();
  };

  /** Full message fetch (for sync/refresh) */
  messageSchema.statics.getMessages = async function (
    roomId,
    limit = 50,
    before = null,
    userId = null,
  ) {
    const query = { roomId, isDeleted: false };
    if (userId) query.deletedFor = { $ne: userId };
    if (before) query.createdAt = { $lt: new Date(before) };

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
