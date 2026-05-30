const mongoose = require("mongoose");

const approvalQueueSchema = new mongoose.Schema(
  {
    // Content to be approved - Only events and communities
    contentType: {
      type: String,
      enum: ["event", "community", "department"],
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "contentModel",
    },
    contentModel: {
      type: String,
      required: true,
      enum: ["Event", "Community"],
      default: function () {
        const modelMap = {
          event: "Event",
          community: "Community",
          department: "Community",
        };
        return modelMap[this.contentType] || "Community";
      },
    },

    // Content creator
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Store key info for quick review without populating
    contentSnapshot: {
      name: String,
      description: String,
      type: {
        type: String,
        enum: ["community", "department", "event"],
      },
      privacy: {
        type: String,
        enum: ["public", "private"],
      },
      university: String,
      coverImage: String,
      // Community-specific
      tags: [String],
      rules: [
        {
          title: { type: String },
          description: { type: String },
        },
      ],
      memberCount: { type: Number, default: 0 },
      // Event-specific
      eventDate: Date,
      eventLocation: String,
      eventOrganizer: String,
    },

    // Approval details
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "auto_approved"],
      default: "pending",
      index: true,
    },

    // Status history for tracking
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "pending",
            "under_review",
            "approved",
            "rejected",
            "auto_approved",
          ],
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          maxlength: 300,
        },
      },
    ],

    // Who handled it
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,

    // Priority - departments get higher priority
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    // Review notes (internal, not shown to submitter)
    reviewNotes: {
      type: String,
      maxlength: 500,
    },

    // Reason for rejection (if rejected, shown to submitter)
    rejectionReason: {
      type: String,
      maxlength: 500,
    },

    // Auto-approval settings
    autoApproveAfter: {
      type: Number,
      default: null,
    },
    autoApprovedAt: Date,

    // Notification tracking
    notifiedSubmitter: {
      type: Boolean,
      default: false,
    },
    notifiedAt: Date,

    // For rejected items that allow resubmission
    resubmissionAllowed: {
      type: Boolean,
      default: false,
    },
    resubmittedAs: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalQueue",
      default: null,
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// ============ INDEXES ============
approvalQueueSchema.index({ contentType: 1, status: 1 });
approvalQueueSchema.index({ status: 1, priority: -1, createdAt: 1 });
approvalQueueSchema.index({ submittedBy: 1, status: 1 });
approvalQueueSchema.index({ "contentSnapshot.university": 1, status: 1 });
approvalQueueSchema.index({ contentId: 1 }, { unique: true });

// ============ STATIC METHODS ============

approvalQueueSchema.statics.getPendingCount = async function () {
  return await this.countDocuments({ status: "pending" });
};

approvalQueueSchema.statics.getPendingCountByType = async function (
  contentType,
) {
  return await this.countDocuments({ contentType, status: "pending" });
};

approvalQueueSchema.statics.getPendingByType = async function (contentType) {
  return await this.find({ contentType, status: "pending" })
    .populate("submittedBy", "name username email")
    .sort({ priority: -1, createdAt: 1 });
};

approvalQueueSchema.statics.getAllPending = async function () {
  return await this.find({ status: "pending" })
    .populate("submittedBy", "name username email")
    .sort({ priority: -1, createdAt: 1 });
};

approvalQueueSchema.statics.getPendingCommunities = async function () {
  return await this.find({
    contentType: { $in: ["community", "department"] },
    status: "pending",
  })
    .populate("submittedBy", "name username email")
    .sort({ priority: -1, createdAt: 1 });
};

approvalQueueSchema.statics.getPendingEvents = async function () {
  return await this.find({ contentType: "event", status: "pending" })
    .populate("submittedBy", "name username email")
    .sort({ priority: -1, createdAt: 1 });
};

approvalQueueSchema.statics.getByContent = async function (
  contentType,
  contentId,
) {
  return await this.findOne({ contentType, contentId })
    .populate("submittedBy", "name username email")
    .populate("reviewedBy", "name username");
};

approvalQueueSchema.statics.getUserSubmissions = async function (
  userId,
  limit = 20,
) {
  return await this.find({ submittedBy: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("reviewedBy", "name username");
};

approvalQueueSchema.statics.getStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: { status: "$status", type: "$contentType" },
        count: { $sum: 1 },
        avgProcessingTime: {
          $avg: {
            $cond: [
              { $ifNull: ["$reviewedAt", false] },
              { $subtract: ["$reviewedAt", "$createdAt"] },
              null,
            ],
          },
        },
      },
    },
  ]);

  const result = {
    total: 0,
    byStatus: { pending: 0, approved: 0, rejected: 0, auto_approved: 0 },
    byType: {
      event: { pending: 0, approved: 0, rejected: 0 },
      community: { pending: 0, approved: 0, rejected: 0 },
      department: { pending: 0, approved: 0, rejected: 0 },
    },
  };

  stats.forEach((stat) => {
    result.total += stat.count;
    result.byStatus[stat._id.status] =
      (result.byStatus[stat._id.status] || 0) + stat.count;
    if (result.byType[stat._id.type]) {
      result.byType[stat._id.type][stat._id.status] = stat.count;
    }
  });

  return result;
};

approvalQueueSchema.statics.cleanupOldEntries = async function () {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return await this.deleteMany({
    status: "rejected",
    reviewedAt: { $lt: thirtyDaysAgo },
    resubmissionAllowed: false,
  });
};

// ============ INSTANCE METHODS ============

approvalQueueSchema.methods.markUnderReview = async function (adminId) {
  this.statusHistory.push({
    status: "under_review",
    changedBy: adminId,
    changedAt: new Date(),
    notes: "Admin started reviewing",
  });
  return await this.save();
};

approvalQueueSchema.methods.approve = async function (adminId, notes = null) {
  this.status = "approved";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  if (notes) this.reviewNotes = notes;
  this.statusHistory.push({
    status: "approved",
    changedBy: adminId,
    changedAt: new Date(),
    notes: notes || "Approved",
  });
  return await this.save();
};

approvalQueueSchema.methods.reject = async function (
  adminId,
  reason,
  allowResubmit = false,
) {
  this.status = "rejected";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  this.resubmissionAllowed = allowResubmit;
  this.statusHistory.push({
    status: "rejected",
    changedBy: adminId,
    changedAt: new Date(),
    notes: reason,
  });
  return await this.save();
};

approvalQueueSchema.methods.isOverdue = function () {
  if (this.status !== "pending") return false;
  const hours = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  return hours > 48;
};

approvalQueueSchema.methods.getProcessingTime = function () {
  if (!this.reviewedAt) return null;
  return ((this.reviewedAt - this.createdAt) / (1000 * 60 * 60)).toFixed(2);
};

// ✅ Updated: Create snapshot from community data (now includes tags, rules, memberCount)
approvalQueueSchema.methods.createCommunitySnapshot = function (communityData) {
  this.contentSnapshot = {
    name: communityData.name,
    description: communityData.description || "",
    type: communityData.type || "community",
    privacy: communityData.privacy || "public",
    university: communityData.university,
    coverImage: communityData.coverImage || null,
    tags: communityData.tags || [],
    rules: communityData.rules || [],
    memberCount: communityData.memberCount || 0,
  };
};

// Create snapshot from event data
approvalQueueSchema.methods.createEventSnapshot = function (eventData) {
  this.contentSnapshot = {
    name: eventData.title || eventData.name,
    description: eventData.description || "",
    type: "event",
    eventDate: eventData.eventDate || eventData.date,
    eventLocation: eventData.location,
    eventOrganizer: eventData.organizer,
    coverImage: eventData.coverImage || eventData.image || null,
  };
};

// ============ VIRTUALS ============

approvalQueueSchema.virtual("statusLabel").get(function () {
  const labels = {
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    auto_approved: "Auto-Approved",
  };
  return labels[this.status] || this.status;
});

approvalQueueSchema.virtual("priorityLabel").get(function () {
  const labels = {
    low: "Low Priority",
    normal: "Normal",
    high: "High Priority",
    urgent: "Urgent",
  };
  return labels[this.priority] || this.priority;
});

approvalQueueSchema.virtual("typeLabel").get(function () {
  const labels = {
    event: "Event",
    community: "Community",
    department: "Department",
  };
  return labels[this.contentType] || this.contentType;
});

// ============ CONFIGURATION ============
approvalQueueSchema.set("toJSON", { virtuals: true });
approvalQueueSchema.set("toObject", { virtuals: true });

const ApprovalQueue = mongoose.model("ApprovalQueue", approvalQueueSchema);
module.exports = ApprovalQueue;
module.exports.schema = approvalQueueSchema;
