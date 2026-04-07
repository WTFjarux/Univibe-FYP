const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    // Basic event information
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [100, "Event title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // Event details
    category: {
      type: String,
      enum: [
        "Academic",
        "Social",
        "Sports",
        "Career",
        "Cultural",
        "Workshop",
        "Other",
      ],
      required: true,
    },
    location: {
      type: String,
      required: [true, "Event location is required"],
      trim: true,
    },
    campus: {
      type: String,
      required: [true, "Campus is required"],
      index: true,
    },

    // Date and time
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },

    // ============================================
    // UPDATED: Event images section
    // Now supporting multiple images (up to 5)
    // ============================================

    // DEPRECATED: Kept for backward compatibility, but will be removed in future
    // New events should use the 'images' array instead
    coverImage: {
      type: String,
      default: "",
      description: "DEPRECATED: Use images array instead",
    },

    // NEW: Array to store multiple event images
    // Each image object contains metadata for better management
    images: {
      type: [
        {
          filename: String, // Original filename
          url: String, // Accessible URL path
          path: String, // Server file path
          mimetype: String, // File type (e.g., image/jpeg)
          size: Number, // File size in bytes
          isCover: {
            // NEW: Flag to indicate which image is the cover
            type: Boolean,
            default: false,
          },
          uploadedAt: {
            // When the image was uploaded
            type: Date,
            default: Date.now,
          },
        },
      ],
      validate: {
        // Ensure maximum 5 images per event
        validator: function (images) {
          return images.length <= 5;
        },
        message: "An event can have maximum 5 images",
      },
      default: [],
    },

    // Organizer information
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizerName: {
      type: String,
      required: true,
    },

    // Event statistics
    interestedCount: {
      type: Number,
      default: 0,
    },
    rsvpCount: {
      type: Number,
      default: 0,
    },

    // User interactions
    interested: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    rsvp: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Event settings
    visibility: {
      type: String,
      enum: ["campus", "connections", "public"],
      default: "campus",
    },
    maxAttendees: {
      type: Number,
      default: null, // null means unlimited
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    meetingLink: {
      type: String,
      default: "",
    },

    // Status
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },

    // Tags
    tags: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for performance
eventSchema.index({ startDate: -1 });
eventSchema.index({ campus: 1, startDate: -1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ visibility: 1 });

// ============================================
// NEW: Helper virtuals for images
// ============================================

// Virtual to get only cover image (first image marked as cover, or first image overall)
eventSchema.virtual("coverImageUrl").get(function () {
  if (!this.images || this.images.length === 0) return "";

  // Find image marked as cover
  const coverImg = this.images.find((img) => img.isCover === true);
  if (coverImg) return coverImg.url;

  // If no cover marked, return first image URL
  return this.images[0].url;
});

// Virtual to get all image URLs (simplified array for frontend)
eventSchema.virtual("imageUrls").get(function () {
  if (!this.images || this.images.length === 0) return [];
  return this.images.map((img) => img.url);
});

// Virtual to get count of images
eventSchema.virtual("imageCount").get(function () {
  return this.images ? this.images.length : 0;
});

// Virtual for checking if event is full
eventSchema.virtual("isFull").get(function () {
  if (!this.maxAttendees) return false;
  return this.rsvpCount >= this.maxAttendees;
});

// Virtual for checking if user is interested
eventSchema.methods.isUserInterested = function (userId) {
  return this.interested.some((id) => id.toString() === userId.toString());
};

// Virtual for checking if user has RSVP'd
eventSchema.methods.isUserRsvpd = function (userId) {
  return this.rsvp.some((id) => id.toString() === userId.toString());
};

// ============================================
// NEW: Method to set a specific image as cover
// ============================================
eventSchema.methods.setCoverImage = async function (imageIndexOrId) {
  // Reset all images' isCover flag to false
  this.images.forEach((img) => {
    img.isCover = false;
  });

  // Set the specified image as cover
  if (typeof imageIndexOrId === "number" && this.images[imageIndexOrId]) {
    this.images[imageIndexOrId].isCover = true;
  } else if (typeof imageIndexOrId === "string") {
    const img = this.images.find(
      (img) => img._id.toString() === imageIndexOrId,
    );
    if (img) img.isCover = true;
  }

  await this.save();
  return this;
};

// Method to add interested user
eventSchema.methods.addInterested = async function (userId) {
  if (!this.isUserInterested(userId)) {
    this.interested.push(userId);
    this.interestedCount = this.interested.length;
    await this.save();
  }
  return this;
};

// Method to remove interested user
eventSchema.methods.removeInterested = async function (userId) {
  this.interested = this.interested.filter(
    (id) => id.toString() !== userId.toString(),
  );
  this.interestedCount = this.interested.length;
  await this.save();
  return this;
};

// Method to add RSVP
eventSchema.methods.addRsvp = async function (userId) {
  if (!this.isUserRsvpd(userId)) {
    this.rsvp.push(userId);
    this.rsvpCount = this.rsvp.length;
    await this.save();
  }
  return this;
};

// Method to remove RSVP
eventSchema.methods.removeRsvp = async function (userId) {
  this.rsvp = this.rsvp.filter((id) => id.toString() !== userId.toString());
  this.rsvpCount = this.rsvp.length;
  await this.save();
  return this;
};

// Update status based on dates
eventSchema.pre("save", function (next) {
  const now = new Date();
  if (this.status === "cancelled") {
    return next();
  }

  if (now < this.startDate) {
    this.status = "upcoming";
  } else if (now >= this.startDate && now <= this.endDate) {
    this.status = "ongoing";
  } else if (now > this.endDate) {
    this.status = "completed";
  }
  next();
});

const Event = mongoose.model("Event", eventSchema);
module.exports = Event;
