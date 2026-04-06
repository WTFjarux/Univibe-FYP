// Backend/controllers/eventController.js
const Event = require("../models/Event");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Notification = require("../models/Notification");

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
// EVENT CRUD OPERATIONS
// ============================================

/**
 * Create a new event
 */
exports.createEvent = async (req, res) => {
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

    // Get user's profile for campus info
    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Get user's name for organizer field
    const user = await User.findById(userId);
    const organizerName = profile.fullName || user.name;

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
    });

    // Handle cover image if uploaded
    if (req.file) {
      event.coverImage = `/uploads/events/${req.file.filename}`;
    }

    await event.save();

    // Populate organizer info for response
    const populatedEvent = await Event.findById(event._id)
      .populate("organizer", "name username email")
      .lean();

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: populatedEvent,
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create event",
    });
  }
};

/**
 * Get events with filters
 */
exports.getEvents = async (req, res) => {
  try {
    const {
      category,
      campus,
      status,
      visibility,
      page = 1,
      limit = 20,
      search,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user._id;

    // Get user's profile for campus filtering
    const userProfile = await Profile.findOne({ user: userId });
    const userCampus = userProfile?.campus;

    // Build query
    let query = {};

    // Filter by campus (show events from user's campus by default)
    if (campus) {
      query.campus = campus;
    } else if (userCampus) {
      query.campus = userCampus;
    }

    // Filter by category
    if (category && category !== "All") {
      query.category = category;
    }

    // Filter by status
    if (status && status !== "all") {
      query.status = status;
    } else {
      // Default: show upcoming and ongoing events
      query.status = { $in: ["upcoming", "ongoing"] };
    }

    // Filter by visibility
    if (visibility === "connections") {
      const currentUser = await User.findById(userId);
      const connectionIds = currentUser?.connections || [];
      query.visibility = { $in: ["campus", "connections"] };
      query.$or = [
        { visibility: "campus" },
        { visibility: "connections", organizer: { $in: connectionIds } },
        { organizer: userId },
      ];
    } else {
      query.visibility = { $in: ["campus", "public"] };
    }

    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const events = await Event.find(query)
      .populate("organizer", "name username email")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add user interaction status to each event
    const eventsWithStatus = events.map((event) => ({
      ...event,
      isInterested: event.interested?.some(
        (id) => id.toString() === userId.toString(),
      ),
      isRsvpd: event.rsvp?.some((id) => id.toString() === userId.toString()),
    }));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: eventsWithStatus,
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

/**
 * Get single event by ID
 */
exports.getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId)
      .populate("organizer", "name username email")
      .populate("interested", "name username")
      .populate("rsvp", "name username")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

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

/**
 * Update an event
 */
exports.updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check if user is the organizer
    if (event.organizer.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this event",
      });
    }

    // Prevent updating certain fields
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

    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("organizer", "name username email")
      .lean();

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update event",
    });
  }
};

/**
 * Delete an event
 */
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

    // Check if user is the organizer or admin
    if (
      event.organizer.toString() !== userId.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this event",
      });
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
// EVENT INTERACTIONS
// ============================================

/**
 * Mark interest in an event
 */
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

      // Create notification for event organizer (if not the same person)
      if (event.organizer.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        await createEventNotification(
          event.organizer,
          userId,
          "event_interest",
          "New Interest",
          `${user.name} is interested in your event: ${event.title}`,
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

/**
 * RSVP for an event
 */
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

      // Create notification for event organizer (if not the same person)
      if (event.organizer.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        await createEventNotification(
          event.organizer,
          userId,
          "event_rsvp",
          "New RSVP",
          `${user.name} has RSVP'd for your event: ${event.title}`,
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

/**
 * Get events created by user
 */
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

    const eventsWithStatus = events.map((event) => ({
      ...event,
      isInterested: true,
      isRsvpd: event.rsvp?.some((id) => id.toString() === userId.toString()),
    }));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: eventsWithStatus,
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

/**
 * Get events user is attending (RSVP'd)
 */
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

    const eventsWithStatus = events.map((event) => ({
      ...event,
      isInterested: event.interested?.some(
        (id) => id.toString() === userId.toString(),
      ),
      isRsvpd: true,
    }));

    const total = await Event.countDocuments({ rsvp: userId });

    res.status(200).json({
      success: true,
      data: eventsWithStatus,
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
