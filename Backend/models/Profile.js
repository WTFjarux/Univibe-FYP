// models/Profile.js
const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true, // Keep this field-level index
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_.-]+$/,
        "Username can only contain letters, numbers, dots, underscores and hyphens",
      ],
      index: true, // Keep this field-level index
    },

    // CAMPUS FIELD
    campus: {
      type: String,
      required: true,
      trim: true,
      default: "Herald College Kathmandu",
      index: true, // Keep this field-level index
    },

    profilePicture: {
      type: String,
      default: "https://api.dicebear.com/7.x/avataaars/svg?seed=default",
    },
    coverPhoto: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: 500,
      default: "",
    },
    major: {
      type: String,
      required: true,
    },
    year: {
      type: String,
      enum: ["UPC", "First", "Second", "Third"],
      required: true,
    },
    graduationYear: {
      type: String,
      required: true,
    },
    pronouns: {
      type: String,
      default: "",
    },
    universityEmail: {
      type: String,
      required: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    verified: {
      type: Boolean,
      default: false,
      index: true, // Add this for verified field
    },
    socialLinks: {
      instagram: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
    },
    interests: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 5;
        },
        message: "Cannot have more than 5 interests",
      },
    },
    stats: {
      posts: { type: Number, default: 0 },
      connections: { type: Number, default: 0 },
      groups: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  },
);

// Keep these compound/unique indexes:
profileSchema.index({ "stats.connections": -1 });
profileSchema.index({ coverPhoto: 1 });

module.exports = mongoose.model("Profile", profileSchema);
