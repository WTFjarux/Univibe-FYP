// Backend/routes/connectionRoutes.js
const express = require("express");
const router = express.Router();
const connectionController = require("../controllers/connectionController");
const { protect } = require("../middleware/authmiddleware");

// Apply authentication to all routes
router.use(protect);

// Connection management
router.post("/request/:userId", connectionController.sendConnectionRequest);
router.post("/accept/:requestId", connectionController.acceptConnectionRequest);
router.post("/reject/:requestId", connectionController.rejectConnectionRequest);
router.delete("/remove/:connectionId", connectionController.removeConnection);

// Get connections and requests
router.get("/:userId/connections", connectionController.getConnections);
router.get("/requests/pending", connectionController.getPendingRequests);
router.get("/status/:userId", connectionController.getConnectionStatus);
router.get("/mutual/:userId", connectionController.getMutualConnections);
router.get("/suggestions", connectionController.getConnectionSuggestions);

// ADD THIS ROUTE - Get connection count for a user
router.get("/count/:userId", connectionController.getConnectionCount);

module.exports = router;
