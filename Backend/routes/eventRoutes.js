// Backend/routes/eventRoutes.js (updated)
const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const { protect } = require("../middleware/authmiddleware");
const { uploadEventImage } = require("../middleware/uploadEventMiddleware");

// Apply authentication to all routes
router.use(protect);

// Event CRUD
router.post(
  "/",
  uploadEventImage.single("coverImage"),
  eventController.createEvent,
);
router.get("/", eventController.getEvents);
router.get("/my-events", eventController.getMyEvents);
router.get("/attending", eventController.getAttendingEvents);
router.get("/:eventId", eventController.getEventById);
router.put(
  "/:eventId",
  uploadEventImage.single("coverImage"),
  eventController.updateEvent,
);
router.delete("/:eventId", eventController.deleteEvent);

// Event interactions
router.post("/:eventId/interested", eventController.markInterested);
router.post("/:eventId/rsvp", eventController.rsvpEvent);

module.exports = router;
