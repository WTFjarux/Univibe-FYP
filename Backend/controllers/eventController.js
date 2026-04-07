const Event = require("../models/Event");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Notification = require("../models/Notification");
const fs = require("fs").promises;
const path = require("path");

// ============================================
// NOTIFICATION HELPER
// ============================================

const createEventNotification = async (
  recipientId,
  senderId,
  type,
  title,
  message,
  targetId,
  targetModel = "Event",
) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      targetId,
      targetModel,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

// ============================================
// HELPER FUNCTION: Format image objects for database
// ============================================

const formatImageObjects = (files) => {
  if (!files || files.length === 0) return [];

  return files.map((file, index) => ({
    filename: file.filename || file.originalname,
    url: file.url,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
    isCover: index === 0,
    uploadedAt: new Date(),
  }));
};

const cleanupUploadedFiles = async (files) => {
  if (!files || files.length === 0) return;

  for (const file of files) {
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (err) {
        console.error("Error cleaning up file:", file.path, err);
      }
    }
  }
};

// ============================================
// HELPER: Get user with profile picture (for single user)
// ============================================

const getUserWithProfile = async (user) => {
  if (!user) return user;

  // If user is already populated with _id
  const userId = user._id || user;
  const profile = await Profile.findOne({ user: userId }).lean();
  const userData = user._id ? user : await User.findById(userId).lean();

  if (!userData) return user;

  return {
    _id: userData._id,
    name: userData.name,
    username: userData.username,
    email: userData.email,
    profilePicture: profile?.profilePicture || null,
    fullName: profile?.fullName || userData.name,
  };
};

// ============================================
// HELPER: Get multiple users with profile pictures
// ============================================

const getUsersWithProfiles = async (users) => {
  if (!users || users.length === 0) return [];

  return await Promise.all(
    users.map(async (user) => {
      const userId = user._id || user;
      const profile = await Profile.findOne({ user: userId }).lean();
      const userData = user._id ? user : await User.findById(userId).lean();

      if (!userData) return user;

      return {
        _id: userData._id,
        name: userData.name,
        username: userData.username,
        email: userData.email,
        profilePicture: profile?.profilePicture || null,
        fullName: profile?.fullName || userData.name,
      };
    }),
  );
};

// ============================================
// EVENT CRUD OPERATIONS
// ============================================

exports.createEvent = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const {
      title,
      description,
      category,
      location,
      startDate,
      endDate,
      visibility,
      maxAttendees,
      isOnline,
      meetingLink,
      tags,
    } = req.body;

    const userId = req.user._id;

    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    if (uploadedFiles.length > 5) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Maximum 5 images allowed per event",
      });
    }

    const user = await User.findById(userId);
    const organizerName = profile.fullName || user.name;

    const formattedImages = formatImageObjects(uploadedFiles);

    const event = new Event({
      title,
      description,
      category,
      location,
      campus: profile.campus,
      startDate: start,
      endDate: end,
      organizer: userId,
      organizerName,
      visibility: visibility || "campus",
      maxAttendees: maxAttendees || null,
      isOnline: isOnline || false,
      meetingLink: meetingLink || "",
      tags: tags || [],
      images: formattedImages,
    });

    if (formattedImages.length > 0) {
      event.coverImage = formattedImages[0].url;
    }

    await event.save();

    // Get created event with populated organizer
    const populatedEvent = await Event.findById(event._id)
      .populate("organizer", "name username email")
      .lean();

    const organizerWithProfile = await getUserWithProfile(
      populatedEvent.organizer,
    );
    populatedEvent.organizer = organizerWithProfile;
    populatedEvent.organizerName =
      organizerWithProfile?.fullName || organizerWithProfile?.name;

    populatedEvent.coverImageUrl = event.coverImageUrl;
    populatedEvent.imageUrls = event.imageUrls;
    populatedEvent.imageCount = event.imageCount;

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: populatedEvent,
    });
  } catch (error) {
    console.error("Create event error:", error);
    await cleanupUploadedFiles(uploadedFiles);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create event",
    });
  }
};

// ============================================
// GET EVENTS WITH FILTERS
// ============================================
exports.getEvents = async (req, res) => {
  try {
    const {
      category,
      campus,
      status,
      page = 1,
      limit = 20,
      search,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user._id;

    const userProfile = await Profile.findOne({ user: userId });
    const userCampus = userProfile?.campus;

    const currentUser = await User.findById(userId);
    const connectionIds = currentUser?.connections || [];

    let query = {};

    if (campus) {
      query.campus = campus;
    } else if (userCampus) {
      query.campus = userCampus;
    }

    if (category && category !== "All" && category !== "all") {
      query.category = category;
    }

    if (status && status !== "all") {
      query.status = status;
    } else {
      query.status = { $in: ["upcoming", "ongoing"] };
    }

    query.$or = [
      { visibility: "campus" },
      { visibility: "public" },
      { visibility: "connections", organizer: userId },
      {
        visibility: "connections",
        organizer: { $in: connectionIds },
      },
    ];

    const events = await Event.find(query)
      .populate("organizer", "name username email")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add profile pictures to each event's organizer
    const eventsWithProfiles = await Promise.all(
      events.map(async (event) => {
        const organizerWithProfile = await getUserWithProfile(event.organizer);
        return {
          ...event,
          organizer: organizerWithProfile,
          organizerName:
            organizerWithProfile?.fullName ||
            organizerWithProfile?.name ||
            event.organizerName,
          coverImageUrl:
            event.images?.length > 0
              ? event.images.find((img) => img.isCover)?.url ||
                event.images[0]?.url
              : "",
          imageUrls: event.images?.map((img) => img.url) || [],
          imageCount: event.images?.length || 0,
          isInterested: event.interested?.some(
            (id) => id.toString() === userId.toString(),
          ),
          isRsvpd: event.rsvp?.some(
            (id) => id.toString() === userId.toString(),
          ),
        };
      }),
    );

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: eventsWithProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
    });
  }
};

// ============================================
// GET SINGLE EVENT BY ID
// ============================================
exports.getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId)
      .populate("organizer", "name username email")
      .populate("interested", "name username email")
      .populate("rsvp", "name username email")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Get organizer with profile picture
    event.organizer = await getUserWithProfile(event.organizer);
    event.organizerName = event.organizer.fullName || event.organizer.name;

    // Get interested users with profile pictures
    event.interested = await getUsersWithProfiles(event.interested || []);

    // Get RSVP users with profile pictures
    event.rsvp = await getUsersWithProfiles(event.rsvp || []);

    // Add image helper fields
    event.coverImageUrl =
      event.images?.length > 0
        ? event.images.find((img) => img.isCover)?.url || event.images[0]?.url
        : "";
    event.imageUrls = event.images?.map((img) => img.url) || [];
    event.imageCount = event.images?.length || 0;

    // Add user interaction status
    event.isInterested = event.interested?.some(
      (user) => user._id.toString() === userId.toString(),
    );
    event.isRsvpd = event.rsvp?.some(
      (user) => user._id.toString() === userId.toString(),
    );

    res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Get event by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch event",
    });
  }
};

// ============================================
// UPDATE EVENT
// ============================================
exports.updateEvent = async (req, res) => {
  const newUploadedFiles = req.files || [];

  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    const { imagesToDelete, setCoverImageIndex } = updates;

    const event = await Event.findById(eventId);
    if (!event) {
      await cleanupUploadedFiles(newUploadedFiles);
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.organizer.toString() !== userId.toString()) {
      await cleanupUploadedFiles(newUploadedFiles);
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this event",
      });
    }

    if (imagesToDelete) {
      const deleteIndices = imagesToDelete.split(",").map((i) => parseInt(i));

      for (const index of deleteIndices.sort((a, b) => b - a)) {
        if (event.images[index]) {
          try {
            await fs.unlink(event.images[index].path);
          } catch (err) {
            console.error("Error deleting image file:", err);
          }
          event.images.splice(index, 1);
        }
      }
    }

    if (newUploadedFiles.length > 0) {
      if (event.images.length + newUploadedFiles.length > 5) {
        await cleanupUploadedFiles(newUploadedFiles);
        return res.status(400).json({
          success: false,
          message: `Cannot add ${newUploadedFiles.length} image(s). Maximum 5 images per event. Current: ${event.images.length}`,
        });
      }

      const newImages = formatImageObjects(newUploadedFiles);
      event.images.push(...newImages);
    }

    if (setCoverImageIndex !== undefined) {
      const index = parseInt(setCoverImageIndex);
      if (event.images[index]) {
        event.images.forEach((img) => {
          img.isCover = false;
        });
        event.images[index].isCover = true;
      }
    }

    const allowedUpdates = [
      "title",
      "description",
      "category",
      "location",
      "startDate",
      "endDate",
      "visibility",
      "maxAttendees",
      "isOnline",
      "meetingLink",
      "tags",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        event[field] = updates[field];
      }
    });

    if (event.images.length > 0) {
      const coverImg =
        event.images.find((img) => img.isCover) || event.images[0];
      event.coverImage = coverImg.url;
    } else {
      event.coverImage = "";
    }

    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("organizer", "name username email")
      .lean();

    const organizerWithProfile = await getUserWithProfile(
      updatedEvent.organizer,
    );
    updatedEvent.organizer = organizerWithProfile;
    updatedEvent.organizerName =
      organizerWithProfile?.fullName || organizerWithProfile?.name;

    updatedEvent.coverImageUrl = event.coverImageUrl;
    updatedEvent.imageUrls = event.imageUrls;
    updatedEvent.imageCount = event.imageCount;

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Update event error:", error);
    await cleanupUploadedFiles(newUploadedFiles);
    res.status(500).json({
      success: false,
      message: "Failed to update event",
    });
  }
};

// ============================================
// DELETE EVENT
// ============================================
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (
      event.organizer.toString() !== userId.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this event",
      });
    }

    for (const image of event.images) {
      try {
        await fs.unlink(image.path);
      } catch (err) {
        console.error("Error deleting image file:", image.path, err);
      }
    }

    await Event.findByIdAndDelete(eventId);

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete event",
    });
  }
};

// ============================================
// ADD EVENT IMAGES
// ============================================
exports.addEventImages = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.organizer.toString() !== userId.toString()) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this event",
      });
    }

    if (event.images.length + uploadedFiles.length > 5) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: `Cannot add ${uploadedFiles.length} image(s). Maximum 5 images per event. Current: ${event.images.length}`,
      });
    }

    const newImages = formatImageObjects(uploadedFiles);
    event.images.push(...newImages);

    if (event.images.length === newImages.length && newImages.length > 0) {
      event.coverImage = newImages[0].url;
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} image(s) added successfully`,
      imageCount: event.images.length,
      images: event.images,
    });
  } catch (error) {
    console.error("Add event images error:", error);
    await cleanupUploadedFiles(uploadedFiles);
    res.status(500).json({
      success: false,
      message: "Failed to add images",
    });
  }
};

// ============================================
// REMOVE EVENT IMAGE
// ============================================
exports.removeEventImage = async (req, res) => {
  try {
    const { eventId, imageIndex } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.organizer.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this event",
      });
    }

    const index = parseInt(imageIndex);
    if (isNaN(index) || index < 0 || index >= event.images.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid image index",
      });
    }

    try {
      await fs.unlink(event.images[index].path);
    } catch (err) {
      console.error("Error deleting image file:", err);
    }

    const wasCover = event.images[index].isCover;
    event.images.splice(index, 1);

    if (wasCover && event.images.length > 0) {
      event.images[0].isCover = true;
    }

    if (event.images.length > 0) {
      const coverImg =
        event.images.find((img) => img.isCover) || event.images[0];
      event.coverImage = coverImg.url;
    } else {
      event.coverImage = "";
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: "Image removed successfully",
      imageCount: event.images.length,
      images: event.images,
    });
  } catch (error) {
    console.error("Remove event image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove image",
    });
  }
};

// ============================================
// MARK INTERESTED
// ============================================
exports.markInterested = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const isInterested = event.isUserInterested(userId);

    if (isInterested) {
      await event.removeInterested(userId);
    } else {
      await event.addInterested(userId);

      if (event.organizer.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        const profile = await Profile.findOne({ user: userId });
        await createEventNotification(
          event.organizer,
          userId,
          "event_interest",
          "New Interest",
          `${profile?.fullName || user.name} is interested in your event: ${event.title}`,
          event._id,
          "Event",
        );
      }
    }

    res.status(200).json({
      success: true,
      message: isInterested ? "Interest removed" : "Interest added",
      isInterested: !isInterested,
      interestedCount: event.interestedCount,
    });
  } catch (error) {
    console.error("Mark interested error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update interest",
    });
  }
};

// ============================================
// RSVP EVENT
// ============================================
exports.rsvpEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.isFull && !event.isUserRsvpd(userId)) {
      return res.status(400).json({
        success: false,
        message: "Event is full",
      });
    }

    const isRsvpd = event.isUserRsvpd(userId);

    if (isRsvpd) {
      await event.removeRsvp(userId);
    } else {
      await event.addRsvp(userId);

      if (event.organizer.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        const profile = await Profile.findOne({ user: userId });
        await createEventNotification(
          event.organizer,
          userId,
          "event_rsvp",
          "New RSVP",
          `${profile?.fullName || user.name} has RSVP'd for your event: ${event.title}`,
          event._id,
          "Event",
        );
      }
    }

    res.status(200).json({
      success: true,
      message: isRsvpd ? "RSVP cancelled" : "RSVP confirmed",
      isRsvpd: !isRsvpd,
      rsvpCount: event.rsvpCount,
      isFull: event.isFull,
    });
  } catch (error) {
    console.error("RSVP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update RSVP",
    });
  }
};

// ============================================
// GET MY EVENTS
// ============================================
exports.getMyEvents = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { organizer: userId };

    if (status && status !== "all") {
      query.status = status;
    }

    const events = await Event.find(query)
      .populate("organizer", "name username email")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const organizerWithProfile = await getUserWithProfile({ _id: userId });

    const eventsWithProfiles = events.map((event) => ({
      ...event,
      organizer: organizerWithProfile,
      organizerName:
        organizerWithProfile?.fullName || organizerWithProfile?.name,
      coverImageUrl:
        event.images?.length > 0
          ? event.images.find((img) => img.isCover)?.url || event.images[0]?.url
          : "",
      imageUrls: event.images?.map((img) => img.url) || [],
      imageCount: event.images?.length || 0,
      isInterested: true,
      isRsvpd: event.rsvp?.some((id) => id.toString() === userId.toString()),
    }));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: eventsWithProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your events",
    });
  }
};

// ============================================
// GET ATTENDING EVENTS
// ============================================
exports.getAttendingEvents = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.find({ rsvp: userId })
      .populate("organizer", "name username email")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const eventsWithProfiles = await Promise.all(
      events.map(async (event) => {
        const organizerWithProfile = await getUserWithProfile(event.organizer);
        return {
          ...event,
          organizer: organizerWithProfile,
          organizerName:
            organizerWithProfile?.fullName || organizerWithProfile?.name,
          coverImageUrl:
            event.images?.length > 0
              ? event.images.find((img) => img.isCover)?.url ||
                event.images[0]?.url
              : "",
          imageUrls: event.images?.map((img) => img.url) || [],
          imageCount: event.images?.length || 0,
          isInterested: event.interested?.some(
            (id) => id.toString() === userId.toString(),
          ),
          isRsvpd: true,
        };
      }),
    );

    const total = await Event.countDocuments({ rsvp: userId });

    res.status(200).json({
      success: true,
      data: eventsWithProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get attending events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attending events",
    });
  }
};
