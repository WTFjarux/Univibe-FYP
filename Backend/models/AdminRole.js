const mongoose = require("mongoose");

const adminRoleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "moderator"],
      required: true,
    },
    permissions: {
      // Dashboard access
      viewDashboard: { type: Boolean, default: true },

      // Post moderation
      viewPosts: { type: Boolean, default: true },
      approvePosts: { type: Boolean, default: false },
      deletePosts: { type: Boolean, default: false },
      bulkModeratePosts: { type: Boolean, default: false },

      // Comment moderation
      viewComments: { type: Boolean, default: true },
      deleteComments: { type: Boolean, default: false },
      bulkModerateComments: { type: Boolean, default: false },

      // User management
      viewUsers: { type: Boolean, default: true },
      banUsers: { type: Boolean, default: false },
      warnUsers: { type: Boolean, default: false },
      manageRoles: { type: Boolean, default: false },

      // Event management
      viewEvents: { type: Boolean, default: true },
      approveEvents: { type: Boolean, default: false },
      featureEvents: { type: Boolean, default: false },

      // Reports
      viewReports: { type: Boolean, default: true },
      resolveReports: { type: Boolean, default: false },

      // System
      viewLogs: { type: Boolean, default: false },
      manageSettings: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save hook to set default permissions based on role
adminRoleSchema.pre("save", function (next) {
  if (this.isNew) {
    switch (this.role) {
      case "super_admin":
        // All permissions true
        Object.keys(this.permissions).forEach((key) => {
          this.permissions[key] = true;
        });
        break;

      case "admin":
        this.permissions.viewDashboard = true;
        this.permissions.viewPosts = true;
        this.permissions.approvePosts = true;
        this.permissions.deletePosts = true;
        this.permissions.bulkModeratePosts = true;
        this.permissions.viewComments = true;
        this.permissions.deleteComments = true;
        this.permissions.bulkModerateComments = true;
        this.permissions.viewUsers = true;
        this.permissions.banUsers = true;
        this.permissions.warnUsers = true;
        this.permissions.viewEvents = true;
        this.permissions.approveEvents = true;
        this.permissions.featureEvents = true;
        this.permissions.viewReports = true;
        this.permissions.resolveReports = true;
        this.permissions.viewLogs = true;
        break;

      case "moderator":
        this.permissions.viewDashboard = true;
        this.permissions.viewPosts = true;
        this.permissions.approvePosts = true;
        this.permissions.deletePosts = true;
        this.permissions.viewComments = true;
        this.permissions.deleteComments = true;
        this.permissions.viewUsers = true;
        this.permissions.warnUsers = true;
        this.permissions.viewEvents = true;
        this.permissions.approveEvents = true;
        this.permissions.viewReports = true;
        this.permissions.resolveReports = true;
        break;
    }
  }
  next();
});

// Method to check if admin has specific permission
adminRoleSchema.methods.hasPermission = function (permission) {
  if (this.role === "super_admin") return true;
  return this.permissions[permission] === true;
};

// Static method to get all active admins
adminRoleSchema.statics.getActiveAdmins = function () {
  return this.find({ isActive: true })
    .populate("user", "name email username")
    .sort({ role: 1, createdAt: -1 });
};

module.exports = { schema: adminRoleSchema, name: "AdminRole" };
