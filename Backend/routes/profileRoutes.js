// backend/routes/profileRoutes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authmiddleware");
const { checkEmailVerified } = require("../middleware/verificationMiddleware");
const {
  uploadProfilePicture,
  uploadCoverPhoto,
} = require("../middleware/uploadMiddleware");
const { checkBlockStatus } = require("../middleware/blockMiddleware");

const profileController = require("../controllers/profileController");
const connectionRoutes = require("./connectionRoutes");

router.use(protect);

router.use("/connections", connectionRoutes);

router.get(
  "/check-username/:username",
  profileController.checkUsernameAvailability,
);
router.get("/status", profileController.checkProfileStatus);

router.post("/setup", checkEmailVerified, profileController.setupProfile);
router.post(
  "/upload-picture",
  checkEmailVerified,
  uploadProfilePicture,
  profileController.uploadProfilePicture,
);
router.post(
  "/upload-cover-photo",
  checkEmailVerified,
  uploadCoverPhoto,
  profileController.uploadCoverPhoto,
);
router.delete(
  "/picture",
  checkEmailVerified,
  profileController.deleteProfilePicture,
);
router.delete(
  "/cover-photo",
  checkEmailVerified,
  profileController.deleteCoverPhoto,
);
router.get("/me", checkEmailVerified, profileController.getProfileDetails);
router.get("/details", checkEmailVerified, profileController.getProfileDetails);
router.put("/update", checkEmailVerified, profileController.updateProfile);
router.get("/my-profile", checkEmailVerified, profileController.getMyProfile);

router.get(
  "/public/:userId",
  checkBlockStatus,
  profileController.getPublicProfile,
);
router.get("/all", profileController.getAllProfiles);
router.get("/search", profileController.searchProfiles);
router.get("/username/:username", profileController.getProfileByUsername);
router.get("/search-connections", profileController.searchConnections);

module.exports = router;
