const express = require("express");
const router = express.Router();
const {
  getEvents,
  approveEvent,
  rejectEvent,
  featureEvent,
  deleteEvent,
} = require("../../controllers/admin/eventApprovalController");
const { adminProtect } = require("../../middleware/adminAuth");

router.use(adminProtect);

router.get("/", getEvents);
router.put("/:id/approve", approveEvent);
router.put("/:id/reject", rejectEvent);
router.put("/:id/feature", featureEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
