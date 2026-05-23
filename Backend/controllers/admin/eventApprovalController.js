const Event = require("../../models/Event");
const { getAdminModel } = require("../../config/database");
const Notification = require("../../models/Notification");

// GET PENDING EVENTS
// GET PENDING EVENTS
const getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "pending", search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status !== "all") {
      query.approvalStatus = status;

      // If filtering by pending, exclude completed and cancelled events
      if (status === "pending") {
        query.status = { $nin: ["completed", "cancelled"] };
      }
    }
    if (search) query.title = { $regex: search, $options: "i" };

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate("organizer", "name username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Event.countDocuments(query),
    ]);

    // Rest of the code remains the same...
    // Fetch profile pictures for organizers
    const Profile = require("../../models/Profile");
    const organizerIds = [
      ...new Set(events.map((e) => e.organizer?._id).filter(Boolean)),
    ];
    if (organizerIds.length > 0) {
      const profiles = await Profile.find({ user: { $in: organizerIds } })
        .select("user profilePicture")
        .lean();

      const profilePicMap = {};
      profiles.forEach((p) => {
        if (p.user) profilePicMap[p.user.toString()] = p.profilePicture || null;
      });

      events.forEach((event) => {
        if (event.organizer?._id) {
          event.organizer.profilePicture =
            profilePicMap[event.organizer._id.toString()] || null;
        }
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    events.forEach((event) => {
      if (event.images && event.images.length > 0) {
        const coverImg =
          event.images.find((img) => img.isCover) || event.images[0];
        event.coverImageUrl = baseUrl + coverImg.url;
        event.imageUrls = event.images.map((img) => baseUrl + img.url);
        event.imageCount = event.images.length;
      } else {
        event.coverImageUrl = "";
        event.imageUrls = [];
        event.imageCount = 0;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch events" });
  }
};

// APPROVE EVENT
const approveEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    event.approvalStatus = "approved";
    event.approvedBy = req.user._id;
    event.approvedAt = new Date();
    await event.save();

    // ✅ Send notification to event organizer
    await Notification.create({
      recipient: event.organizer,
      sender: req.user._id,
      type: "event_approved", // Using existing type
      title: "Event Approved",
      message: `Your event "${event.title}" has been approved and is now visible to everyone.`,
      targetId: event._id,
      targetModel: "Event",
    });

    // Emit socket notification
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${event.organizer}`).emit("notification:new", {
        notification: {
          type: "event_approved",
          title: "Event Approved",
          message: `Your event "${event.title}" has been approved!`,
        },
      });
    }

    // Log moderation action
    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "event_approved",
      targetType: "Event",
      targetId: event._id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({ success: true, message: "Event approved" });
  } catch (error) {
    console.error("Approve Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to approve event" });
  }
};

// REJECT EVENT
const rejectEvent = async (req, res) => {
  try {
    const { reason } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    event.approvalStatus = "rejected";
    event.rejectionReason = reason || "Violates community guidelines";
    await event.save();

    // ✅ Send notification to event organizer
    await Notification.create({
      recipient: event.organizer,
      sender: req.user._id,
      type: "event_rejected",
      title: "Event Rejected",
      message: `Your event "${event.title}" has been rejected. Reason: ${reason || "Violates community guidelines"}`,
      targetId: event._id,
      targetModel: "Event",
    });

    // Emit socket notification
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${event.organizer}`).emit("notification:new", {
        notification: {
          type: "event_rejected",
          title: "Event Rejected",
          message: `Your event "${event.title}" has been rejected.`,
        },
      });
    }

    // Log moderation action
    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "event_rejected",
      targetType: "Event",
      targetId: event._id,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({ success: true, message: "Event rejected" });
  } catch (error) {
    console.error("Reject Error:", error);
    res.status(500).json({ success: false, message: "Failed to reject event" });
  }
};

// FEATURE EVENT
const featureEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    event.isFeatured = !event.isFeatured;
    await event.save();

    res.status(200).json({
      success: true,
      message: event.isFeatured ? "Event featured" : "Event unfeatured",
      isFeatured: event.isFeatured,
    });
  } catch (error) {
    console.error("Feature Error:", error);
    res.status(500).json({ success: false, message: "Failed to update event" });
  }
};

// DELETE EVENT
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "event_rejected",
      targetType: "Event",
      targetId: event._id,
      reason: "Event deleted by admin",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({ success: true, message: "Event deleted" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete event" });
  }
};

module.exports = {
  getEvents,
  approveEvent,
  rejectEvent,
  featureEvent,
  deleteEvent,
};
