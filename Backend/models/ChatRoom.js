/**
 * models/ChatRoom.js — Chat Room Model
 *
 * Supports both DIRECT (1-on-1) and GROUP chats
 *
 * CHAT TYPES:
 * - "direct": Private 1-on-1 conversation (auto-generated roomId)
 * - "group": Multi-participant conversation (user-created)
 *
 * KEY FEATURES:
 * - Participant management with roles (owner/admin/member)
 * - Per-user chat clearing (clearedBy)
 * - Group settings (admin controls)
 * - Removed participant tracking
 * - Last message preview
 * - Group photo support
 */

const mongoose = require("mongoose");

const chatRoomSchema = new mongoose.Schema(
  {
    // =========================================================================
    // ROOM IDENTIFICATION
    // =========================================================================
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // =========================================================================
    // ROOM TYPE
    // =========================================================================
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },

    // =========================================================================
    // ROOM METADATA
    // =========================================================================
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
      validate: {
        validator: function (value) {
          if (this.type === "group" && (!value || value.trim().length === 0)) {
            return false;
          }
          return true;
        },
        message: "Group name is required for group chats",
      },
    },

    // =========================================================================
    // GROUP-SPECIFIC FIELDS
    // =========================================================================
    groupIcon: {
      type: String,
      default: null,
      // URL to group icon/avatar image (from icon picker or uploaded photo)
    },

    groupPhoto: {
      type: String,
      default: null,
      // URL to uploaded group photo (full image)
    },

    groupDescription: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    groupSettings: {
      onlyAdminsCanSend: {
        type: Boolean,
        default: false,
      },
      onlyAdminsCanAddMembers: {
        type: Boolean,
        default: false,
      },
      onlyAdminsCanChangeInfo: {
        type: Boolean,
        default: true,
      },
      muteNotifications: {
        type: Boolean,
        default: false,
      },
    },

    // =========================================================================
    // PARTICIPANTS MANAGEMENT
    // =========================================================================
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        role: {
          type: String,
          enum: ["member", "admin", "owner"],
          default: "member",
        },
        lastReadAt: {
          type: Date,
          default: Date.now,
        },
        notifications: {
          muted: {
            type: Boolean,
            default: false,
          },
          mutedUntil: {
            type: Date,
            default: null,
          },
        },
      },
    ],

    // =========================================================================
    // ROOM CREATOR
    // =========================================================================
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =========================================================================
    // LAST MESSAGE PREVIEW
    // =========================================================================
    lastMessage: {
      message: { type: String, default: "" },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      senderName: { type: String, default: "" },
      sentAt: { type: Date, default: Date.now },
      type: {
        type: String,
        enum: ["text", "image", "audio", "video", "file", "location", "post"],
        default: "text",
      },
      readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },

    // =========================================================================
    // MESSAGE COUNT
    // =========================================================================
    messageCount: {
      type: Number,
      default: 0,
    },

    // =========================================================================
    // REMOVED PARTICIPANTS TRACKING
    // =========================================================================
    removedParticipants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        removedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        removedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: "",
        },
      },
    ],

    // =========================================================================
    // CHAT CLEARING (per user)
    // =========================================================================
    clearedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        clearedAt: {
          type: Date,
          default: Date.now,
          required: true,
        },
        restoreOnNewMessage: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // =========================================================================
    // ROOM STATUS
    // =========================================================================
    isArchived: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================================
// INDEXES
// ============================================================================

chatRoomSchema.index({ roomId: 1 });
chatRoomSchema.index({ "participants.userId": 1, updatedAt: -1 });
chatRoomSchema.index({ "clearedBy.user": 1 });
chatRoomSchema.index({ "removedParticipants.userId": 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

chatRoomSchema.virtual("participantCount").get(function () {
  return this.participants ? this.participants.length : 0;
});

chatRoomSchema.virtual("isGroupChat").get(function () {
  return this.type === "group";
});

chatRoomSchema.virtual("admins").get(function () {
  return this.participants.filter(
    (p) => p.role === "admin" || p.role === "owner",
  );
});

chatRoomSchema.virtual("owner").get(function () {
  return this.participants.find((p) => p.role === "owner");
});

// ✅ Get group display photo (uploaded photo > icon > null)
chatRoomSchema.virtual("groupDisplayPhoto").get(function () {
  return this.groupPhoto || this.groupIcon || null;
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

chatRoomSchema.methods.isParticipant = function (userId) {
  return this.participants.some(
    (p) => p.userId.toString() === userId.toString(),
  );
};

chatRoomSchema.methods.getParticipantRole = function (userId) {
  const participant = this.participants.find(
    (p) => p.userId.toString() === userId.toString(),
  );
  return participant ? participant.role : null;
};

chatRoomSchema.methods.hasRole = function (userId, roles) {
  const role = this.getParticipantRole(userId);
  if (!role) return false;
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(role);
};

chatRoomSchema.methods.canSendMessage = function (userId) {
  if (this.type === "direct") return true;
  if (this.groupSettings.onlyAdminsCanSend) {
    return this.hasRole(userId, ["admin", "owner"]);
  }
  return this.isParticipant(userId);
};

chatRoomSchema.methods.canAddMembers = function (userId) {
  if (this.type === "direct") return false;
  if (this.groupSettings.onlyAdminsCanAddMembers) {
    return this.hasRole(userId, ["admin", "owner"]);
  }
  return this.isParticipant(userId);
};

chatRoomSchema.methods.canChangeGroupInfo = function (userId) {
  if (this.type === "direct") return false;
  if (this.groupSettings.onlyAdminsCanChangeInfo) {
    return this.hasRole(userId, ["admin", "owner"]);
  }
  return this.isParticipant(userId);
};

chatRoomSchema.methods.isClearedByUser = function (userId) {
  return this.clearedBy.some(
    (entry) => entry.user.toString() === userId.toString(),
  );
};

chatRoomSchema.methods.getClearTimestamp = function (userId) {
  const entry = this.clearedBy.find(
    (entry) => entry.user.toString() === userId.toString(),
  );
  return entry ? entry.clearedAt : null;
};

chatRoomSchema.methods.restoreForUser = function (userId) {
  this.clearedBy = this.clearedBy.filter(
    (entry) => entry.user.toString() !== userId.toString(),
  );
  return this.save();
};

chatRoomSchema.methods.addParticipant = function (userId, role = "member") {
  if (!this.isParticipant(userId)) {
    this.participants.push({
      userId,
      role,
      joinedAt: new Date(),
      lastReadAt: new Date(),
    });
  }
  return this;
};

chatRoomSchema.methods.removeParticipant = function (userId, removedBy) {
  this.participants = this.participants.filter(
    (p) => p.userId.toString() !== userId.toString(),
  );
  this.removedParticipants.push({
    userId,
    removedBy,
    removedAt: new Date(),
  });
  return this;
};

chatRoomSchema.methods.promoteToAdmin = function (userId) {
  const participant = this.participants.find(
    (p) => p.userId.toString() === userId.toString(),
  );
  if (participant && participant.role === "member") {
    participant.role = "admin";
  }
  return this;
};

chatRoomSchema.methods.demoteToMember = function (userId) {
  const participant = this.participants.find(
    (p) => p.userId.toString() === userId.toString(),
  );
  if (participant && participant.role === "admin") {
    participant.role = "member";
  }
  return this;
};

chatRoomSchema.methods.transferOwnership = function (fromUserId, toUserId) {
  const fromParticipant = this.participants.find(
    (p) => p.userId.toString() === fromUserId.toString(),
  );
  if (fromParticipant) {
    fromParticipant.role = "admin";
  }
  const toParticipant = this.participants.find(
    (p) => p.userId.toString() === toUserId.toString(),
  );
  if (toParticipant) {
    toParticipant.role = "owner";
  }
  return this;
};

chatRoomSchema.methods.getOtherParticipant = function (userId) {
  if (this.type !== "direct") return null;
  return this.participants.find(
    (p) => p.userId.toString() !== userId.toString(),
  );
};

chatRoomSchema.methods.getUnreadCount = async function (userId) {
  const Message = mongoose.model("Message");
  const clearedAt = this.getClearTimestamp(userId);
  const query = {
    roomId: this.roomId,
    sender: { $ne: userId },
    "readBy.user": { $ne: userId },
    isDeleted: false,
  };
  if (clearedAt) query.createdAt = { $gt: clearedAt };
  return await Message.countDocuments(query);
};

chatRoomSchema.methods.markAsRead = async function (userId) {
  const Message = mongoose.model("Message");
  const participant = this.participants.find(
    (p) => p.userId.toString() === userId.toString(),
  );
  if (participant) participant.lastReadAt = new Date();
  if (this.lastMessage?.sender?.toString() !== userId.toString()) {
    if (!this.lastMessage.readBy) this.lastMessage.readBy = [];
    if (
      !this.lastMessage.readBy.some((id) => id.toString() === userId.toString())
    ) {
      this.lastMessage.readBy.push(userId);
    }
  }
  await this.save();
  return await Message.markRoomAsRead(this.roomId, userId);
};

// ============================================================================
// STATIC METHODS
// ============================================================================

chatRoomSchema.statics.findOrCreateDirectChat = async function (
  user1Id,
  user2Id,
) {
  const sortedIds = [user1Id.toString(), user2Id.toString()].sort();
  const roomId = `direct_${sortedIds[0]}_${sortedIds[1]}`;
  let room = await this.findOne({ roomId });
  if (!room) {
    room = new this({
      roomId,
      type: "direct",
      participants: [
        { userId: user1Id, role: "member", joinedAt: new Date() },
        { userId: user2Id, role: "member", joinedAt: new Date() },
      ],
      createdBy: user1Id,
    });
    await room.save();
  }
  return room;
};

chatRoomSchema.statics.getUserRooms = async function (userId, limit = 50) {
  return this.find({
    "participants.userId": userId,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate("participants.userId", "name avatar profilePicture")
    .populate("lastMessage.sender", "name avatar")
    .lean();
};

/**
 * Create group chat - supports groupPhoto
 */
chatRoomSchema.statics.createGroup = async function ({
  name,
  createdBy,
  participants = [],
  groupIcon = null,
  groupPhoto = null, // ✅ Added groupPhoto support
  groupDescription = "",
  settings = {},
}) {
  const roomId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const allParticipants = [
    {
      userId: createdBy,
      role: "owner",
      joinedAt: new Date(),
      lastReadAt: new Date(),
    },
    ...participants.map((id) => ({
      userId: id,
      role: "member",
      joinedAt: new Date(),
      lastReadAt: new Date(),
    })),
  ];

  const room = new this({
    roomId,
    type: "group",
    name,
    groupIcon: groupIcon || groupPhoto || null, // ✅ Use photo as icon fallback
    groupPhoto: groupPhoto || null, // ✅ Store uploaded photo
    groupDescription,
    groupSettings: {
      onlyAdminsCanSend: settings.onlyAdminsCanSend || false,
      onlyAdminsCanAddMembers: settings.onlyAdminsCanAddMembers || false,
      onlyAdminsCanChangeInfo: settings.onlyAdminsCanChangeInfo !== false,
      muteNotifications: settings.muteNotifications || false,
    },
    participants: allParticipants,
    createdBy,
  });

  await room.save();
  return room;
};

// ============================================================================
// CONFIGURE TO JSON/VIRTUAL
// ============================================================================

chatRoomSchema.set("toJSON", { virtuals: true });
chatRoomSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("ChatRoom", chatRoomSchema);
