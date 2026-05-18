const mongoose = require("mongoose");

const approvalQueueSchema = new mongoose.Schema(
  {
    // Content to be approved
    contentType: {
      type: String,
      enum: ["post", "comment", "event", "moment", "group"],
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Content creator
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Approval details
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "auto_approved"],
      default: "pending",
      index: true,
    },

    // Who handled it
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,

    // Priority
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    // Reason for rejection (if rejected)
    rejectionReason: {
      type: String,
      maxlength: 500,
    },

    // Auto-approval settings
    autoApproveAfter: {
      type: Number, // hours
      default: null,
    },
    autoApprovedAt: Date,

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
approvalQueueSchema.index({ contentType: 1, status: 1 });
approvalQueueSchema.index({ status: 1, priority: -1, createdAt: 1 });
approvalQueueSchema.index({ submittedBy: 1, status: 1 });

// Static method to get pending approvals count
approvalQueueSchema.statics.getPendingCount = async function () {
  return await this.countDocuments({ status: "pending" });
};

// Static method to get pending approvals by type
approvalQueueSchema.statics.getPendingByType = async function (contentType) {
  return await this.find({ contentType, status: "pending" })
    .populate("submittedBy", "name username")
    .sort({ priority: -1, createdAt: 1 });
};

// Instance method to approve
approvalQueueSchema.methods.approve = async function (adminId) {
  this.status = "approved";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  return await this.save();
};

// Instance method to reject
approvalQueueSchema.methods.reject = async function (adminId, reason) {
  this.status = "rejected";
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  return await this.save();
};

module.exports = { schema: approvalQueueSchema, name: "ApprovalQueue" };