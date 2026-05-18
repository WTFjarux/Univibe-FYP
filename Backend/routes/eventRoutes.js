// backend/routes/eventRoutes.js

const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const {
  protect,
  protectWithStatusCheck,
} = require("../middleware/authmiddleware");
const {
  uploadAndOptimizeEventImages,
} = require("../middleware/uploadMiddleware");

// Apply authentication to all routes
router.use(protect);

// ============================================
// READ OPERATIONS (Auth only - no status check)
// ============================================
router.get("/my-events", eventController.getMyEvents);
router.get("/attending", eventController.getAttendingEvents);
router.get("/", eventController.getEvents);
router.get("/:eventId", eventController.getEventById);

// ============================================
// WRITE OPERATIONS (Auth + Status Check)
// ============================================
router.post(
  "/",
  protectWithStatusCheck,
  uploadAndOptimizeEventImages,
  eventController.createEvent,
);
router.put(
  "/:eventId",
  protectWithStatusCheck,
  uploadAndOptimizeEventImages,
  eventController.updateEvent,
);
router.delete("/:eventId", protectWithStatusCheck, eventController.deleteEvent);
router.put(
  "/:eventId/refresh-status",
  protectWithStatusCheck,
  eventController.refreshEventStatus,
);
router.post(
  "/:eventId/images",
  protectWithStatusCheck,
  uploadAndOptimizeEventImages,
  eventController.addEventImages,
);
router.delete(
  "/:eventId/images/:imageIndex",
  protectWithStatusCheck,
  eventController.removeEventImage,
);
router.post(
  "/:eventId/interested",
  protectWithStatusCheck,
  eventController.markInterested,
);
router.post(
  "/:eventId/rsvp",
  protectWithStatusCheck,
  eventController.rsvpEvent,
);

module.exports = router;
