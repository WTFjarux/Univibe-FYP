// backend/services/blockService.js

const mongoose = require("mongoose");
const Block = require("../models/Block");
const User = require("../models/User");
const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");

class BlockService {
  /**
   * Block a user with full cleanup (no transactions - standalone MongoDB compatible)
   */
  static async blockUser(blockerId, userIdToBlock, reason = null) {
    // Check if already blocked
    const existingBlock = await Block.findOne({
      $or: [
        { blocker: blockerId, blocked: userIdToBlock },
        { blocker: userIdToBlock, blocked: blockerId },
      ],
    });

    if (existingBlock) {
      if (
        existingBlock.blockDirection === "one_way" &&
        existingBlock.blocked.toString() === blockerId.toString()
      ) {
        // Other user already blocked us - make it mutual
        existingBlock.blockDirection = "mutual";
        existingBlock.updatedAt = new Date();
        await existingBlock.save();
      } else {
        throw new Error("Already blocked");
      }
    } else {
      // Create new block
      await Block.create({
        blocker: blockerId,
        blocked: userIdToBlock,
        reason,
        blockDirection: "one_way",
      });
    }

    // Cleanup operations - run sequentially without transaction
    const cleanupErrors = [];

    try {
      await this.removeConnections(blockerId, userIdToBlock);
    } catch (err) {
      cleanupErrors.push({
        operation: "removeConnections",
        error: err.message,
      });
    }

    try {
      await this.removeConnectionRequests(blockerId, userIdToBlock);
    } catch (err) {
      cleanupErrors.push({
        operation: "removeConnectionRequests",
        error: err.message,
      });
    }

    try {
      await this.handleChatRooms(blockerId, userIdToBlock);
    } catch (err) {
      cleanupErrors.push({ operation: "handleChatRooms", error: err.message });
    }

    try {
      await this.cleanupNotifications(blockerId, userIdToBlock);
    } catch (err) {
      cleanupErrors.push({
        operation: "cleanupNotifications",
        error: err.message,
      });
    }

    try {
      await this.cleanupMentions(blockerId, userIdToBlock);
    } catch (err) {
      cleanupErrors.push({ operation: "cleanupMentions", error: err.message });
    }

    // Log cleanup errors but don't fail the block
    if (cleanupErrors.length > 0) {
      console.warn("Block cleanup warnings:", cleanupErrors);
    }

    return {
      success: true,
      isMutual: existingBlock ? true : false,
      warnings: cleanupErrors.length > 0 ? cleanupErrors : undefined,
    };
  }

  /**
   * Unblock a user
   */
  static async unblockUser(blockerId, userIdToUnblock) {
    const block = await Block.findOne({
      $or: [
        { blocker: blockerId, blocked: userIdToUnblock },
        { blocker: userIdToUnblock, blocked: blockerId },
      ],
    });

    if (!block) {
      throw new Error("Block not found");
    }

    if (block.blockDirection === "mutual") {
      block.blockDirection = "one_way";

      if (block.blocker.toString() === blockerId.toString()) {
        await Block.deleteOne({ _id: block._id });
      } else {
        block.blocker = userIdToUnblock;
        block.blocked = blockerId;
        await block.save();
      }
    } else {
      await Block.deleteOne({ _id: block._id });
    }

    return { success: true };
  }

  /**
   * Get all blocked user IDs for a user (both directions)
   */
  static async getBlockedUserIds(userId) {
    return await Block.getBlockedUserIds(userId);
  }

  /**
   * Check if users are blocked from each other
   */
  static async areUsersBlocked(userId1, userId2) {
    return await Block.areUsersBlocked(userId1, userId2);
  }

  // ============================================
  // PRIVATE HELPER METHODS (no transactions)
  // ============================================

  static async removeConnections(userId1, userId2) {
    await Promise.all([
      User.findByIdAndUpdate(userId1, {
        $pull: { connections: userId2 },
        $inc: { connectionCount: -1 },
      }),
      User.findByIdAndUpdate(userId2, {
        $pull: { connections: userId1 },
        $inc: { connectionCount: -1 },
      }),
    ]);
  }

  static async removeConnectionRequests(userId1, userId2) {
    await Promise.all([
      User.findByIdAndUpdate(userId1, {
        $pull: {
          connectionRequestsSent: userId2,
          connectionRequestsReceived: userId2,
        },
      }),
      User.findByIdAndUpdate(userId2, {
        $pull: {
          connectionRequestsSent: userId1,
          connectionRequestsReceived: userId1,
        },
      }),
    ]);
  }

  static async handleChatRooms(userId1, userId2) {
    const roomId = `direct_${[userId1.toString(), userId2.toString()].sort().join("_")}`;

    const room = await ChatRoom.findOne({ roomId });
    if (room) {
      // Mark participants as inactive
      room.participants.forEach((participant) => {
        if (
          participant.userId.toString() === userId1.toString() ||
          participant.userId.toString() === userId2.toString()
        ) {
          participant.isActive = false;
          participant.leftAt = new Date();
        }
      });
      await room.save();
    }

    // Archive messages
    await Message.updateMany(
      {
        roomId: roomId,
        isDeleted: false,
      },
      { $set: { isArchived: true } },
    );
  }

  static async cleanupNotifications(userId1, userId2) {
    const Notification = mongoose.model("Notification");
    await Notification.updateMany(
      {
        $or: [
          { recipient: userId1, sender: userId2 },
          { recipient: userId2, sender: userId1 },
        ],
      },
      { $set: { read: true, lastInteractionAt: new Date() } },
    );
  }

  static async cleanupMentions(userId1, userId2) {
    const Post = mongoose.model("Post");
    const Comment = mongoose.model("Comment");

    await Post.updateMany(
      { user: { $in: [userId1, userId2] } },
      { $pull: { mentions: { $in: [userId1, userId2] } } },
    );

    await Comment.updateMany(
      { user: { $in: [userId1, userId2] } },
      { $pull: { mentions: { $in: [userId1, userId2] } } },
    );
  }
}

module.exports = BlockService;
