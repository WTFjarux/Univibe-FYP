const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const { protect } = require("../middleware/authmiddleware");
const {
  uploadEventImage,
  uploadEventImages,
} = require("../middleware/uploadEventMiddleware");
const { validateEventImages } = require("../middleware/validateEventImages");

// Apply authentication to all routes
router.use(protect);

// ============================================
// EVENT CRUD OPERATIONS
// ============================================

// Create event - supports multiple images including iPhone HEIC
router.post(
  "/",
  uploadEventImages, // This now handles HEIC conversion automatically
  validateEventImages, // Additional validation
  eventController.createEvent,
);

// Get events with filters
router.get("/", eventController.getEvents);

// Get user's events
router.get("/my-events", eventController.getMyEvents);
router.get("/attending", eventController.getAttendingEvents);

// Get single event
router.get("/:eventId", eventController.getEventById);

// Update event - supports image management
router.put(
  "/:eventId",
  uploadEventImages, // Handles new image uploads with HEIC support
  validateEventImages,
  eventController.updateEvent,
);

// Delete event
router.delete("/:eventId", eventController.deleteEvent);

// ============================================
// IMAGE MANAGEMENT ROUTES
// ============================================

// Add more images to an existing event
router.post(
  "/:eventId/images",
  uploadEventImages,
  validateEventImages,
  eventController.addEventImages,
);

// Remove a specific image from an event (by index)
router.delete("/:eventId/images/:imageIndex", eventController.removeEventImage);

// ============================================
// EVENT INTERACTIONS
// ============================================

router.post("/:eventId/interested", eventController.markInterested);
router.post("/:eventId/rsvp", eventController.rsvpEvent);

module.exports = router;
