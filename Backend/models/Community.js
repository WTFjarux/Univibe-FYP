const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    coverImage: {
      type: String,
      default: null,
    },
    university: {
      type: String,
      required: true,
    },

    // ============ TYPE & PRIVACY ============
    type: {
      type: String,
      enum: ["community", "department"],
      default: "community",
    },
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      validate: {
        validator: function (value) {
          if (this.type === "department" && value !== "private") {
            return false;
          }
          return true;
        },
        message: "Departments must be private",
      },
    },

    // ============ APPROVAL SYSTEM ============
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      maxlength: 300,
      default: null,
    },

    // ============ MEMBERSHIP ============
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        role: {
          type: String,
          enum: ["member", "moderator"],
          default: "member",
        },
      },
    ],
    memberCount: {
      type: Number,
      default: 0,
    },

    // ============ JOIN REQUESTS (Private Communities) ============
    joinRequests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected", "left", "removed"],
          default: "pending",
        },
        processedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        processedAt: {
          type: Date,
          default: null,
        },
        rejectionReason: {
          type: String,
          maxlength: 200,
          default: null,
        },
      },
    ],

    // ============ INVITATIONS ============
    invitations: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
        processedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    // ============ METADATA ============
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 30,
      },
    ],
    rules: [
      {
        title: {
          type: String,
          required: true,
          maxlength: 100,
        },
        description: {
          type: String,
          maxlength: 300,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// ============ INDEXES ============
communitySchema.index({ university: 1, type: 1 });
communitySchema.index({ university: 1, approvalStatus: 1 });
communitySchema.index({ "members.user": 1 });
communitySchema.index({ "joinRequests.user": 1, "joinRequests.status": 1 });
communitySchema.index({ "invitations.user": 1, "invitations.status": 1 });
communitySchema.index({ type: 1, privacy: 1 });
communitySchema.index({ name: "text", description: "text", tags: "text" });

// ============================================
// INSTANCE METHODS - MEMBERSHIP
// ============================================

communitySchema.methods.isMember = function (userId) {
  const id = userId.toString();
  return this.members.some((m) => m.user.toString() === id);
};

communitySchema.methods.isAdmin = function (userId) {
  const id = userId.toString();
  return this.admins.some((adminId) => adminId.toString() === id);
};

communitySchema.methods.isModerator = function (userId) {
  const id = userId.toString();
  return this.members.some(
    (m) => m.user.toString() === id && m.role === "moderator",
  );
};

communitySchema.methods.canManage = function (userId) {
  return this.isAdmin(userId) || this.isModerator(userId);
};

communitySchema.methods.isApproved = function () {
  return this.approvalStatus === "approved";
};

communitySchema.methods.join = function (userId) {
  if (!this.isMember(userId)) {
    this.members.push({ user: userId, joinedAt: new Date() });
    this.memberCount = this.members.length;
  }
};

communitySchema.methods.leave = function (userId) {
  const id = userId.toString();
  this.members = this.members.filter((m) => m.user.toString() !== id);
  this.admins = this.admins.filter((adminId) => adminId.toString() !== id);
  this.memberCount = this.members.length;

  const joinRequest = this.joinRequests.find(
    (r) => r.user.toString() === id && r.status === "approved",
  );
  if (joinRequest) {
    joinRequest.status = "left";
    joinRequest.processedAt = new Date();
    joinRequest.rejectionReason = "User left the community";
  }
};

communitySchema.methods.removeMember = function (userId) {
  const id = userId.toString();
  this.members = this.members.filter((m) => m.user.toString() !== id);
  this.admins = this.admins.filter((adminId) => adminId.toString() !== id);
  this.memberCount = this.members.length;
  this.joinRequests = this.joinRequests.filter((r) => r.user.toString() !== id);
  this.invitations = this.invitations.filter(
    (inv) => inv.user.toString() !== id,
  );

  const joinRequest = this.joinRequests.find(
    (r) => r.user.toString() === id && r.status === "approved",
  );
  if (joinRequest) {
    joinRequest.status = "removed";
    joinRequest.processedAt = new Date();
    joinRequest.rejectionReason = "Removed by admin";
  }
};

// ============================================
// INSTANCE METHODS - JOIN REQUESTS
// ============================================

communitySchema.methods.hasPendingRequest = function (userId) {
  const id = userId.toString();
  return this.joinRequests.some(
    (r) => r.user.toString() === id && r.status === "pending",
  );
};

communitySchema.methods.getRequestStatus = function (userId) {
  const id = userId.toString();
  const request = this.joinRequests.find((r) => r.user.toString() === id);
  return request ? request.status : null;
};

communitySchema.methods.addJoinRequest = function (userId) {
  if (!this.hasPendingRequest(userId) && !this.isMember(userId)) {
    this.joinRequests.push({
      user: userId,
      requestedAt: new Date(),
      status: "pending",
    });
  }
};

communitySchema.methods.approveJoinRequest = function (userId, adminId) {
  const id = userId.toString();
  const request = this.joinRequests.find(
    (r) => r.user.toString() === id && r.status === "pending",
  );
  if (request) {
    request.status = "approved";
    request.processedBy = adminId;
    request.processedAt = new Date();
    this.join(userId);
    return true;
  }
  return false;
};

communitySchema.methods.rejectJoinRequest = function (
  userId,
  adminId,
  reason = null,
) {
  const id = userId.toString();
  const request = this.joinRequests.find(
    (r) => r.user.toString() === id && r.status === "pending",
  );
  if (request) {
    request.status = "rejected";
    request.processedBy = adminId;
    request.processedAt = new Date();
    request.rejectionReason = reason;
    return true;
  }
  return false;
};

communitySchema.methods.pendingRequestsCount = function () {
  return this.joinRequests.filter((r) => r.status === "pending").length;
};

// ============================================
// INSTANCE METHODS - INVITATIONS
// ============================================

// ============================================
// INSTANCE METHODS - INVITATIONS
// ============================================

communitySchema.methods.hasPendingInvitation = function (userId) {
  const id = userId.toString();
  return this.invitations.some(
    (inv) => inv.user.toString() === id && inv.status === "pending",
  );
};

communitySchema.methods.getInvitationStatus = function (userId) {
  const id = userId.toString();
  const invitation = this.invitations.find((inv) => inv.user.toString() === id);
  return invitation ? invitation.status : null;
};

/**
 * Invite a user to the community
 *
 * Public community (anyone can invite):
 *   → Invitation sent directly to user → User accepts/rejects
 *
 * Private community:
 *   - Admin/Moderator invites → Invitation sent directly to user → User accepts/rejects
 *   - Regular member invites → Requires admin approval → Then invitation sent to user
 */
communitySchema.methods.inviteUser = function (invitedUserId, inviterId) {
  const invitedId = invitedUserId.toString();
  const inviterIdStr = inviterId.toString();

  // Already a member
  if (this.isMember(invitedId)) {
    return { success: false, message: "User is already a member" };
  }

  // Already has a pending invitation
  if (this.hasPendingInvitation(invitedId)) {
    return { success: false, message: "User already has a pending invitation" };
  }

  // Already has a pending join request
  const hasPendingRequest = this.joinRequests.some(
    (r) => r.user.toString() === invitedId && r.status === "pending",
  );
  if (hasPendingRequest) {
    return {
      success: false,
      message: "User already has a pending join request",
    };
  }

  const isInviterAdmin = this.isAdmin(inviterIdStr);
  const isInviterModerator = this.isModerator(inviterIdStr);
  const canDirectInvite = isInviterAdmin || isInviterModerator;

  // ✅ PUBLIC community → Direct invitation (user must accept)
  if (this.privacy === "public") {
    this.invitations.push({
      user: invitedId,
      invitedBy: inviterId,
      status: "pending",
      invitedAt: new Date(),
    });

    return {
      success: true,
      autoJoined: false,
      needsApproval: false,
      message: "Invitation sent. User must accept to join.",
    };
  }

  // ✅ PRIVATE community
  if (canDirectInvite) {
    // Admin/Moderator → Direct invitation (user must accept)
    this.invitations.push({
      user: invitedId,
      invitedBy: inviterId,
      status: "pending",
      invitedAt: new Date(),
    });

    return {
      success: true,
      autoJoined: false,
      needsApproval: false,
      message: "Invitation sent. User must accept to join.",
    };
  } else {
    // Regular member → Needs admin approval first
    // Store the invitation with a special status or use joinRequests
    // For simplicity, we'll add it as a join request that needs approval
    this.joinRequests.push({
      user: invitedId,
      requestedAt: new Date(),
      status: "pending",
      invitedBy: inviterId, // Track who invited
    });

    return {
      success: true,
      needsApproval: true,
      message: "Invitation request sent to admins for approval.",
    };
  }
};

/**
 * User accepts an invitation
 */
communitySchema.methods.acceptInvitation = function (userId) {
  const id = userId.toString();
  const invitation = this.invitations.find(
    (inv) => inv.user.toString() === id && inv.status === "pending",
  );
  if (!invitation) {
    return { success: false, message: "No pending invitation found" };
  }

  // Add user as member
  if (!this.isMember(id)) {
    this.join(id);
  }

  // Update invitation status
  invitation.status = "accepted";
  invitation.processedAt = new Date();

  // Auto-approve any pending join request from this user
  const pendingRequest = this.joinRequests.find(
    (r) => r.user.toString() === id && r.status === "pending",
  );
  if (pendingRequest) {
    pendingRequest.status = "approved";
    pendingRequest.processedAt = new Date();
  }

  return {
    success: true,
    message: "Invitation accepted. Welcome to the community!",
  };
};

/**
 * User rejects an invitation
 */
communitySchema.methods.rejectInvitation = function (userId) {
  const id = userId.toString();
  const invitation = this.invitations.find(
    (inv) => inv.user.toString() === id && inv.status === "pending",
  );
  if (!invitation) {
    return { success: false, message: "No pending invitation found" };
  }

  invitation.status = "rejected";
  invitation.processedAt = new Date();

  return { success: true, message: "Invitation rejected" };
};

/**
 * Count pending invitations
 */
communitySchema.methods.pendingInvitationsCount = function () {
  return this.invitations.filter((inv) => inv.status === "pending").length;
};

// ============================================
// STATIC METHODS
// ============================================

communitySchema.statics.findApprovedByUniversity = function (university) {
  return this.find({ university, approvalStatus: "approved", isActive: true });
};

communitySchema.statics.findPendingApprovals = function (university = null) {
  const query = { approvalStatus: "pending", isActive: true };
  if (university) query.university = university;
  return this.find(query).populate("admins", "name username email");
};

communitySchema.statics.findPendingInvitationsForUser = function (userId) {
  return this.find({
    "invitations.user": userId,
    "invitations.status": "pending",
    isActive: true,
  });
};

const Community = mongoose.model("Community", communitySchema);
module.exports = Community;
