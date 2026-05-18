// backend/routes/connectionRoutes.js

const express = require("express");
const router = express.Router();
const connectionController = require("../controllers/connectionController");
const {
  protect,
  protectWithStatusCheck,
} = require("../middleware/authmiddleware");

// Apply authentication to all routes
router.use(protect);

// ============================================
// READ OPERATIONS (Auth only - no status check)
// ============================================
router.get("/:userId/connections", connectionController.getConnections);
router.get("/requests/pending", connectionController.getPendingRequests);
router.get("/status/:userId", connectionController.getConnectionStatus);
router.get("/mutual/:userId", connectionController.getMutualConnections);
router.get("/suggestions", connectionController.getConnectionSuggestions);
router.get("/count/:userId", connectionController.getConnectionCount);

// ============================================
// WRITE OPERATIONS (Auth + Status Check)
// ============================================
router.post(
  "/request/:userId",
  protectWithStatusCheck,
  connectionController.sendConnectionRequest,
);
router.post(
  "/accept/:requestId",
  protectWithStatusCheck,
  connectionController.acceptConnectionRequest,
);
router.post(
  "/reject/:requestId",
  protectWithStatusCheck,
  connectionController.rejectConnectionRequest,
);
router.delete(
  "/cancel/:requestId",
  protectWithStatusCheck,
  connectionController.cancelConnectionRequest,
);
router.delete(
  "/remove/:connectionId",
  protectWithStatusCheck,
  connectionController.removeConnection,
);

module.exports = router;
