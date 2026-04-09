const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const { protect } = require("../middleware/authmiddleware");
const {
  uploadAndOptimizeEventImages,
} = require("../middleware/uploadMiddleware");

// Apply authentication to all routes
router.use(protect);

// ============================================
// EVENT QUERIES 
// ============================================

// Get user's events - SPECIFIC routes first
router.get("/my-events", eventController.getMyEvents);
router.get("/attending", eventController.getAttendingEvents);

// Get events with filters
router.get("/", eventController.getEvents);

// ============================================
// EVENT CRUD OPERATIONS
// ============================================

// Create event with images
router.post("/", uploadAndOptimizeEventImages, eventController.createEvent);

// Get single event (dynamic route)
router.get("/:eventId", eventController.getEventById);

// Update event with images
router.put(
  "/:eventId",
  uploadAndOptimizeEventImages,
  eventController.updateEvent,
);

// Delete event
router.delete("/:eventId", eventController.deleteEvent);

// ============================================
// IMAGE MANAGEMENT
// ============================================

// Add more images to existing event
router.post(
  "/:eventId/images",
  uploadAndOptimizeEventImages,
  eventController.addEventImages,
);

// Remove specific image
router.delete("/:eventId/images/:imageIndex", eventController.removeEventImage);

// ============================================
// EVENT INTERACTIONS
// ============================================

// Toggle interest
router.post("/:eventId/interested", eventController.markInterested);

// Toggle RSVP
router.post("/:eventId/rsvp", eventController.rsvpEvent);

// ============================================
// OPTIONAL: Batch operations (if needed)
// ============================================

// Bulk delete events (admin only)
// router.delete("/bulk/delete", protect, adminOnly, eventController.bulkDeleteEvents);

module.exports = router;
