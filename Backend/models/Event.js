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

// Indexes for performance
eventSchema.index({ startDate: -1 });
eventSchema.index({ campus: 1, startDate: -1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ interested: 1 });
eventSchema.index({ rsvp: 1 });

// Virtuals
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

// Instance methods
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

// Pre-save middleware to update status
eventSchema.pre("save", function (next) {
  const now = new Date();
  if (this.status !== "cancelled") {
    if (now < this.startDate) {
      this.status = "upcoming";
    } else if (now >= this.startDate && now <= this.endDate) {
      this.status = "ongoing";
    } else if (now > this.endDate) {
      this.status = "completed";
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
