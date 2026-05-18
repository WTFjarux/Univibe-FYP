const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    // Who reported
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // What was reported (polymorphic reference)
    targetType: {
      type: String,
      enum: ["Post", "Comment", "User", "Event", "Group", "Message"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Report details
    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "hate_speech",
        "inappropriate_content",
        "violence",
        "self_harm",
        "misinformation",
        "impersonation",
        "copyright",
        "other",
      ],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
      trim: true,
    },

    // Report status
    status: {
      type: String,
      enum: ["pending", "reviewing", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },

    // Resolution details
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolution: {
      type: String,
      enum: [
        "content_removed",
        "user_warned",
        "user_banned",
        "no_action",
        "dismissed",
      ],
    },
    resolutionNote: {
      type: String,
      maxlength: 500,
    },
    resolvedAt: Date,

    // For tracking multiple reports on same content
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedBy: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, status: 1 });

// Pre-save to check for duplicate reports
reportSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Report = this.constructor; // Use the model from the current connection
    const existingReport = await Report.findOne({
      reportedBy: this.reportedBy,
      targetType: this.targetType,
      targetId: this.targetId,
      status: { $in: ["pending", "reviewing"] },
      _id: { $ne: this._id },
    });

    if (existingReport) {
      this.isDuplicate = true;
      this.duplicateOf = existingReport._id;
    }
  }
  next();
});

// Static method to get report count
reportSchema.statics.getReportCount = async function (targetType, targetId) {
  return await this.countDocuments({
    targetType,
    targetId,
    status: { $in: ["pending", "reviewing"] },
    isDuplicate: false,
  });
};

// Static method to get reports for a target
reportSchema.statics.getReportsForTarget = async function (
  targetType,
  targetId,
) {
  return await this.find({
    targetType,
    targetId,
    isDuplicate: false,
  })
    .populate("reportedBy", "name username")
    .populate("resolvedBy", "name username")
    .sort({ createdAt: -1 });
};

// ✅ Export schema only (not model) - will be registered on admin connection
module.exports = { schema: reportSchema, name: "Report" };
