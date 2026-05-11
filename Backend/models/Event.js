const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
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
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (endDate) {
          return this.startDate < endDate;
        },
        message: "End date must be after start date",
      },
    },
    images: {
      type: [
        {
          filename: String,
          url: String,
          path: String,
          mimetype: String,
          size: Number,
          isCover: { type: Boolean, default: false },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      validate: {
        validator: function (images) {
          return images.length <= 5;
        },
        message: "An event can have maximum 5 images",
      },
      default: [],
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizerName: {
      type: String,
      required: true,
    },
    interestedCount: { type: Number, default: 0 },
    rsvpCount: { type: Number, default: 0 },
    interested: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    rsvp: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    visibility: {
      type: String,
      enum: ["campus", "connections", "public"],
      default: "campus",
    },
    maxAttendees: { type: Number, default: null },
    isOnline: { type: Boolean, default: false },
    meetingLink: { type: String, default: "" },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },
    tags: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ============================================
// INDEXES
// ============================================
eventSchema.index({ startDate: -1 });
eventSchema.index({ endDate: 1 });
eventSchema.index({ campus: 1, startDate: -1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ interested: 1 });
eventSchema.index({ rsvp: 1 });
// Compound index for status updates
eventSchema.index({ status: 1, startDate: 1, endDate: 1 });

// ============================================
// VIRTUALS
// ============================================
eventSchema.virtual("coverImageUrl").get(function () {
  if (!this.images || this.images.length === 0) return "";
  const coverImg = this.images.find((img) => img.isCover === true);
  if (coverImg) return coverImg.url;
  return this.images[0].url;
});

eventSchema.virtual("imageUrls").get(function () {
  if (!this.images || this.images.length === 0) return [];
  return this.images.map((img) => img.url);
});

eventSchema.virtual("imageCount").get(function () {
  return this.images ? this.images.length : 0;
});

eventSchema.virtual("isFull").get(function () {
  if (!this.maxAttendees) return false;
  return this.rsvpCount >= this.maxAttendees;
});

// ============================================
// INSTANCE METHODS
// ============================================
eventSchema.methods.isUserInterested = function (userId) {
  return this.interested.some((id) => id.toString() === userId.toString());
};

eventSchema.methods.isUserRsvpd = function (userId) {
  return this.rsvp.some((id) => id.toString() === userId.toString());
};

eventSchema.methods.setCoverImage = async function (imageId) {
  let found = false;
  this.images.forEach((img) => {
    if (img._id.toString() === imageId) {
      img.isCover = true;
      found = true;
    } else {
      img.isCover = false;
    }
  });

  if (!found && this.images.length > 0) {
    this.images[0].isCover = true;
  }

  await this.save();
  return this;
};

eventSchema.methods.addInterested = async function (userId) {
  if (!this.isUserInterested(userId)) {
    this.interested.push(userId);
    this.interestedCount = this.interested.length;
    await this.save();
  }
  return this;
};

eventSchema.methods.removeInterested = async function (userId) {
  this.interested = this.interested.filter(
    (id) => id.toString() !== userId.toString(),
  );
  this.interestedCount = this.interested.length;
  await this.save();
  return this;
};

eventSchema.methods.addRsvp = async function (userId) {
  if (!this.isUserRsvpd(userId)) {
    if (this.isFull) {
      throw new Error("Event is full");
    }
    this.rsvp.push(userId);
    this.rsvpCount = this.rsvp.length;
    await this.save();
  }
  return this;
};

eventSchema.methods.removeRsvp = async function (userId) {
  this.rsvp = this.rsvp.filter((id) => id.toString() !== userId.toString());
  this.rsvpCount = this.rsvp.length;
  await this.save();
  return this;
};

/**
 * Calculate the correct status based on current time
 */
eventSchema.methods.calculateStatus = function () {
  if (this.status === "cancelled") return "cancelled";

  const now = new Date();

  if (this.endDate < now) {
    return "completed";
  } else if (this.startDate <= now && this.endDate >= now) {
    return "ongoing";
  } else if (this.startDate > now) {
    return "upcoming";
  }

  return this.status;
};

/**
 * Update status if it has changed based on current time
 */
eventSchema.methods.updateStatusIfNeeded = async function () {
  const correctStatus = this.calculateStatus();

  if (correctStatus !== this.status) {
    console.log(
      `📅 Event "${this.title}" status changing: ${this.status} → ${correctStatus}`,
    );
    this.status = correctStatus;
    await this.save();
  }

  return this;
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Update statuses for all events that need updating
 */
eventSchema.statics.updateAllEventStatuses = async function () {
  const now = new Date();

  // Update upcoming → ongoing
  const toOngoing = await this.updateMany(
    {
      status: "upcoming",
      startDate: { $lte: now },
      endDate: { $gte: now },
    },
    { $set: { status: "ongoing" } },
  );

  // Update upcoming/ongoing → completed
  const toCompleted = await this.updateMany(
    {
      status: { $in: ["upcoming", "ongoing"] },
      endDate: { $lt: now },
    },
    { $set: { status: "completed" } },
  );

  const totalUpdated =
    (toOngoing.modifiedCount || 0) + (toCompleted.modifiedCount || 0);

  if (totalUpdated > 0) {
    console.log(
      `📅 Event status cron: ${toOngoing.modifiedCount || 0} → ongoing, ${toCompleted.modifiedCount || 0} → completed`,
    );
  }

  return {
    toOngoing: toOngoing.modifiedCount || 0,
    toCompleted: toCompleted.modifiedCount || 0,
    totalUpdated,
  };
};

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save middleware to update status
eventSchema.pre("save", function (next) {
  // Only auto-update if status isn't manually set to 'cancelled'
  if (this.status !== "cancelled") {
    const correctStatus = this.calculateStatus();
    if (correctStatus !== this.status) {
      console.log(
        `📅 Pre-save: Event "${this.title}" status auto-corrected: ${this.status} → ${correctStatus}`,
      );
      this.status = correctStatus;
    }
  }
  next();
});

// Pre-validate middleware
eventSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    next(new Error("End date must be after start date"));
  }
  next();
});

const Event = mongoose.model("Event", eventSchema);
module.exports = Event;
