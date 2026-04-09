const Event = require("../models/Event");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Notification = require("../models/Notification");
const fs = require("fs").promises;
const path = require("path");

// ============================================
// HELPER FUNCTIONS
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

// Format image objects for database storage
const formatImageObjects = (files) => {
  if (!files || files.length === 0) return [];

  return files.map((file, index) => ({
    filename: file.originalname || file.filename,
    url: file.url || `/uploads/events/${file.filename}`,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
    isCover: index === 0,
    uploadedAt: new Date(),
  }));
};

// Clean up uploaded files if something goes wrong
const cleanupUploadedFiles = async (files) => {
  if (!files || files.length === 0) return;

  for (const file of files) {
    if (file.path) {
      try {
        await fs.unlink(file.path);
        console.log(`🗑️ Cleaned up file: ${file.path}`);
      } catch (err) {
        console.error("Error cleaning up file:", file.path, err);
      }
    }
  }
};

// Get user with profile picture
const getUserWithProfile = async (user) => {
  if (!user) return null;

  try {
    const userId = user._id || user;
    const [profile, userData] = await Promise.all([
      Profile.findOne({ user: userId }).lean(),
      user._id ? user : User.findById(userId).lean(),
    ]);

    if (!userData) return user;

    return {
      _id: userData._id,
      name: userData.name,
      username: userData.username,
      email: userData.email,
      profilePicture: profile?.profilePicture || null,
      fullName: profile?.fullName || userData.name,
    };
  } catch (error) {
    console.error("Get user with profile error:", error);
    return user;
  }
};

// Get multiple users with profile pictures
const getUsersWithProfiles = async (users) => {
  if (!users || users.length === 0) return [];
  return await Promise.all(users.map((user) => getUserWithProfile(user)));
};

// Build full image URL (for responses)
const getFullImageUrl = (req, relativeUrl) => {
  if (!relativeUrl) return "";
  if (relativeUrl.startsWith("http")) return relativeUrl;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}${relativeUrl}`;
};

// Process event images for response
const processEventImagesForResponse = (req, event) => {
  if (!event.images || event.images.length === 0) {
    return {
      ...event,
      coverImageUrl: "",
      imageUrls: [],
      imageCount: 0,
    };
  }

  const processedImages = event.images.map((img) => ({
    ...img,
    url: getFullImageUrl(req, img.url),
  }));

  return {
    ...event,
    images: processedImages,
    coverImageUrl:
      processedImages.find((img) => img.isCover)?.url ||
      processedImages[0]?.url ||
      "",
    imageUrls: processedImages.map((img) => img.url),
    imageCount: processedImages.length,
  };
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

    // Validate required fields
    if (
      !title ||
      !description ||
      !category ||
      !location ||
      !startDate ||
      !endDate
    ) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, description, category, location, startDate, endDate",
      });
    }

    // Get user profile
    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({
        success: false,
        message: "Profile not found. Please complete your profile first.",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    if (start >= end) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Validate image count
    if (uploadedFiles.length > 5) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Maximum 5 images allowed per event",
      });
    }

    // Get user for organizer name
    const user = await User.findById(userId);
    if (!user) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const organizerName = profile.fullName || user.name;
    const formattedImages = formatImageObjects(uploadedFiles);

    // Create event
    const event = new Event({
      title: title.trim(),
      description: description.trim(),
      category,
      location: location.trim(),
      campus: profile.campus,
      startDate: start,
      endDate: end,
      organizer: userId,
      organizerName,
      visibility: visibility || "campus",
      maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
      isOnline: isOnline === true || isOnline === "true",
      meetingLink: meetingLink || "",
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(",")) : [],
      images: formattedImages,
    });

    // Set cover image if there are images
    if (formattedImages.length > 0) {
      event.coverImage = formattedImages[0].url;
    }

    await event.save();

    // Fetch created event with populated data
    const populatedEvent = await Event.findById(event._id)
      .populate("organizer", "name username email")
      .lean();

    const organizerWithProfile = await getUserWithProfile(
      populatedEvent.organizer,
    );
    populatedEvent.organizer = organizerWithProfile;
    populatedEvent.organizerName =
      organizerWithProfile?.fullName || organizerWithProfile?.name;

    // Process images for response
    const finalEvent = processEventImagesForResponse(req, populatedEvent);

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: finalEvent,
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

    // Get user profile and connections
    const [userProfile, currentUser] = await Promise.all([
      Profile.findOne({ user: userId }),
      User.findById(userId),
    ]);

    const userCampus = userProfile?.campus;
    const connectionIds = currentUser?.connections || [];

    let query = {};

    // Campus filter
    if (campus) {
      query.campus = campus;
    } else if (userCampus) {
      query.campus = userCampus;
    }

    // Category filter
    if (category && category !== "All" && category !== "all") {
      query.category = category;
    }

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    } else {
      query.status = { $in: ["upcoming", "ongoing"] };
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { tags: { $in: [searchRegex] } },
      ];
    }

    // Visibility filter
    query.$or = [
      { visibility: "campus" },
      { visibility: "public" },
      { visibility: "connections", organizer: userId },
      { visibility: "connections", organizer: { $in: connectionIds } },
    ];

    // Execute query
    const [events, total] = await Promise.all([
      Event.find(query)
        .populate("organizer", "name username email")
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Event.countDocuments(query),
    ]);

    // Process events with profile pictures and image URLs
    const eventsWithProfiles = await Promise.all(
      events.map(async (event) => {
        const organizerWithProfile = await getUserWithProfile(event.organizer);
        const processedEvent = processEventImagesForResponse(req, event);

        return {
          ...processedEvent,
          organizer: organizerWithProfile,
          organizerName:
            organizerWithProfile?.fullName ||
            organizerWithProfile?.name ||
            event.organizerName,
          isInterested: event.interested?.some(
            (id) => id.toString() === userId.toString(),
          ),
          isRsvpd: event.rsvp?.some(
            (id) => id.toString() === userId.toString(),
          ),
        };
      }),
    );

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

    // Validate eventId
    if (!eventId || eventId === "undefined" || eventId === "null") {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

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

    // Get profiles for all users
    const [organizerWithProfile, interestedWithProfiles, rsvpWithProfiles] =
      await Promise.all([
        getUserWithProfile(event.organizer),
        getUsersWithProfiles(event.interested || []),
        getUsersWithProfiles(event.rsvp || []),
      ]);

    event.organizer = organizerWithProfile;
    event.organizerName =
      organizerWithProfile?.fullName || organizerWithProfile?.name;
    event.interested = interestedWithProfiles;
    event.rsvp = rsvpWithProfiles;

    // Process images for response
    const processedEvent = processEventImagesForResponse(req, event);

    // Add user interaction status
    processedEvent.isInterested = event.interested?.some(
      (user) => user._id?.toString() === userId.toString(),
    );
    processedEvent.isRsvpd = event.rsvp?.some(
      (user) => user._id?.toString() === userId.toString(),
    );

    res.status(200).json({
      success: true,
      event: processedEvent,
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

    // Validate eventId
    if (!eventId || eventId === "undefined" || eventId === "null") {
      await cleanupUploadedFiles(newUploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      await cleanupUploadedFiles(newUploadedFiles);
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check authorization
    if (event.organizer.toString() !== userId.toString()) {
      await cleanupUploadedFiles(newUploadedFiles);
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this event",
      });
    }

    // Handle image deletion by indices
    if (updates.imagesToDelete) {
      const deleteIndices = updates.imagesToDelete
        .split(",")
        .map((i) => parseInt(i));

      for (const index of deleteIndices.sort((a, b) => b - a)) {
        if (event.images[index]) {
          try {
            await fs.unlink(event.images[index].path);
            console.log(`🗑️ Deleted image: ${event.images[index].path}`);
          } catch (err) {
            console.error("Error deleting image file:", err);
          }
          event.images.splice(index, 1);
        }
      }
    }

    // Handle new image uploads
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

    // Handle cover image setting
    if (updates.setCoverImageIndex !== undefined) {
      const index = parseInt(updates.setCoverImageIndex);
      if (event.images[index]) {
        event.images.forEach((img, i) => {
          img.isCover = i === index;
        });
      }
    }

    // Update text fields
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

    for (const field of allowedUpdates) {
      if (updates[field] !== undefined) {
        if (field === "tags" && typeof updates[field] === "string") {
          event[field] = updates[field].split(",").map((t) => t.trim());
        } else if (field === "maxAttendees") {
          event[field] = updates[field] ? parseInt(updates[field]) : null;
        } else if (field === "isOnline") {
          event[field] = updates[field] === true || updates[field] === "true";
        } else if (field === "startDate" || field === "endDate") {
          event[field] = new Date(updates[field]);
        } else {
          event[field] = updates[field];
        }
      }
    }

    // Update coverImage field
    if (event.images.length > 0) {
      const coverImg =
        event.images.find((img) => img.isCover) || event.images[0];
      event.coverImage = coverImg.url;
    } else {
      event.coverImage = "";
    }

    await event.save();

    // Fetch updated event
    const updatedEvent = await Event.findById(eventId)
      .populate("organizer", "name username email")
      .lean();

    const organizerWithProfile = await getUserWithProfile(
      updatedEvent.organizer,
    );
    updatedEvent.organizer = organizerWithProfile;
    updatedEvent.organizerName =
      organizerWithProfile?.fullName || organizerWithProfile?.name;

    // Process images for response
    const finalEvent = processEventImagesForResponse(req, updatedEvent);

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event: finalEvent,
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

    // Validate eventId
    if (!eventId || eventId === "undefined" || eventId === "null") {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check authorization
    if (
      event.organizer.toString() !== userId.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this event",
      });
    }

    // Delete all associated images
    for (const image of event.images) {
      try {
        await fs.unlink(image.path);
        console.log(`🗑️ Deleted image: ${image.path}`);
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

    // Validate eventId
    if (!eventId || eventId === "undefined" || eventId === "null") {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check authorization
    if (event.organizer.toString() !== userId.toString()) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this event",
      });
    }

    // Check image limit
    if (event.images.length + uploadedFiles.length > 5) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: `Cannot add ${uploadedFiles.length} image(s). Maximum 5 images per event. Current: ${event.images.length}`,
      });
    }

    // Add new images
    const newImages = formatImageObjects(uploadedFiles);
    event.images.push(...newImages);

    // Set cover image if this was the first image
    if (event.images.length === newImages.length && newImages.length > 0) {
      event.images[0].isCover = true;
      event.coverImage = newImages[0].url;
    }

    await event.save();

    // Process images for response
    const processedImages = event.images.map((img) => ({
      ...img,
      url: getFullImageUrl(req, img.url),
    }));

    res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} image(s) added successfully`,
      imageCount: event.images.length,
      images: processedImages,
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

    // Validate parameters
    if (!eventId || eventId === "undefined" || eventId === "null") {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check authorization
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

    // Delete the image file
    try {
      await fs.unlink(event.images[index].path);
      console.log(`🗑️ Deleted image: ${event.images[index].path}`);
    } catch (err) {
      console.error("Error deleting image file:", err);
    }

    const wasCover = event.images[index].isCover;
    event.images.splice(index, 1);

    // If we removed the cover image and there are other images, set the first as cover
    if (wasCover && event.images.length > 0) {
      event.images[0].isCover = true;
    }

    // Update coverImage field
    if (event.images.length > 0) {
      const coverImg =
        event.images.find((img) => img.isCover) || event.images[0];
      event.coverImage = coverImg.url;
    } else {
      event.coverImage = "";
    }

    await event.save();

    // Process images for response
    const processedImages = event.images.map((img) => ({
      ...img,
      url: getFullImageUrl(req, img.url),
    }));

    res.status(200).json({
      success: true,
      message: "Image removed successfully",
      imageCount: event.images.length,
      images: processedImages,
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

      // Send notification to event organizer
      if (event.organizer.toString() !== userId.toString()) {
        const [user, profile] = await Promise.all([
          User.findById(userId),
          Profile.findOne({ user: userId }),
        ]);

        await createEventNotification(
          event.organizer,
          userId,
          "event_interest",
          "New Interest",
          `${profile?.fullName || user?.name || "Someone"} is interested in your event: ${event.title}`,
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

    // Check if event is full
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

      // Send notification to event organizer
      if (event.organizer.toString() !== userId.toString()) {
        const [user, profile] = await Promise.all([
          User.findById(userId),
          Profile.findOne({ user: userId }),
        ]);

        await createEventNotification(
          event.organizer,
          userId,
          "event_rsvp",
          "New RSVP",
          `${profile?.fullName || user?.name || "Someone"} has RSVP'd for your event: ${event.title}`,
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
      message: error.message || "Failed to update RSVP",
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

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate("organizer", "name username email")
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Event.countDocuments(query),
    ]);

    const organizerWithProfile = await getUserWithProfile({ _id: userId });

    const eventsWithProfiles = events.map((event) => {
      const processedEvent = processEventImagesForResponse(req, event);
      return {
        ...processedEvent,
        organizer: organizerWithProfile,
        organizerName:
          organizerWithProfile?.fullName || organizerWithProfile?.name,
        isInterested: true,
        isRsvpd: event.rsvp?.some((id) => id.toString() === userId.toString()),
      };
    });

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

    const [events, total] = await Promise.all([
      Event.find({ rsvp: userId })
        .populate("organizer", "name username email")
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Event.countDocuments({ rsvp: userId }),
    ]);

    const eventsWithProfiles = await Promise.all(
      events.map(async (event) => {
        const organizerWithProfile = await getUserWithProfile(event.organizer);
        const processedEvent = processEventImagesForResponse(req, event);

        return {
          ...processedEvent,
          organizer: organizerWithProfile,
          organizerName:
            organizerWithProfile?.fullName || organizerWithProfile?.name,
          isInterested: event.interested?.some(
            (id) => id.toString() === userId.toString(),
          ),
          isRsvpd: true,
        };
      }),
    );

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
