// Backend/controllers/profileController.js
const User = require("../models/User");
const Profile = require("../models/Profile");
const fs = require("fs");
const path = require("path");

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert image path to full URL for frontend consumption
 */
const getFullImageUrl = (imagePath, req) => {
  if (!imagePath) return null;

  // Already a full URL
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  const baseUrl = req ? `${req.protocol}://${req.get("host")}` : "";

  if (imagePath.startsWith("/uploads/")) {
    return `${baseUrl}${imagePath}`;
  }

  // Determine correct directory based on filename pattern
  if (imagePath.includes("profilePicture-")) {
    return `${baseUrl}/uploads/profile-pictures/${imagePath}`;
  } else if (imagePath.includes("coverPhoto-")) {
    return `${baseUrl}/uploads/cover-photos/${imagePath}`;
  } else if (imagePath.includes("user-")) {
    return `${baseUrl}/uploads/profile-pictures/${imagePath}`;
  }

  return `${baseUrl}/uploads/${imagePath}`;
};

/**
 * Clean up uploaded file on server if operation fails
 */
const cleanupUploadedFile = (filename, fileType = "profile-picture") => {
  try {
    const directory =
      fileType === "cover-photo" ? "cover-photos" : "profile-pictures";
    const filePath = path.join(__dirname, "..", "uploads", directory, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Silently fail - cleanup is best effort
  }
};

// ============================================
// PROFILE SETUP & BASIC INFO
// ============================================

/**
 * Check if a username is available for registration/profile setup
 */
exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.user.id;

    // Validation
    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters",
      });
    }

    if (username.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Username must be less than 20 characters",
      });
    }

    const validUsernameRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!validUsernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          "Username can only contain letters, numbers, dots, underscores and hyphens",
      });
    }

    const lowercaseUsername = username.toLowerCase();

    const existingUser = await User.findOne({
      username: lowercaseUsername,
      _id: { $ne: userId },
    });

    const existingProfile = await Profile.findOne({
      username: lowercaseUsername,
    });

    if (existingUser || existingProfile) {
      return res.status(409).json({
        success: false,
        message: "Username already taken",
        available: false,
      });
    }

    res.status(200).json({
      success: true,
      message: "Username available",
      available: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking username availability",
    });
  }
};

/**
 * Complete initial profile setup for new users
 */
exports.setupProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = req.body;

    if (!profileData.username || !profileData.major || !profileData.year) {
      return res.status(400).json({
        success: false,
        message: "Username, major, and year are required",
      });
    }

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check username availability
    const lowercaseUsername = profileData.username.trim().toLowerCase();

    const usernameTakenInUser = await User.findOne({
      username: lowercaseUsername,
      _id: { $ne: userId },
    });

    const usernameTakenInProfile = await Profile.findOne({
      username: lowercaseUsername,
    });

    if (usernameTakenInUser || usernameTakenInProfile) {
      return res.status(400).json({
        success: false,
        message: "Username is already taken",
      });
    }

    // ✅ Update user with username and mark profile complete
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        profileComplete: true,
        username: profileData.username.trim(),
        // ✅ Also update name if fullName is provided during setup
        ...(profileData.fullName && { name: profileData.fullName }),
      },
      { new: true },
    );

    // Use fullName from input or fallback to user's name
    const fullName = profileData.fullName || existingUser.name;

    const profileFields = {
      user: userId,
      fullName: fullName,
      username: profileData.username.trim(),
      campus: profileData.campus || "Herald College Kathmandu",
      major: profileData.major.trim(),
      year: profileData.year,
      graduationYear:
        profileData.graduationYear || String(new Date().getFullYear() + 1),
      bio: (profileData.bio || "").trim(),
      pronouns: (profileData.pronouns || "").trim(),
      universityEmail: (profileData.universityEmail || existingUser.email)
        .toLowerCase()
        .trim(),
      profilePicture: "", // Empty string - will use local default avatar
      coverPhoto: "",
      socialLinks: {
        instagram: (profileData.instagram || "").trim(),
        linkedin: (profileData.linkedin || "").trim(),
        github: (profileData.github || "").trim(),
      },
      interests: Array.isArray(profileData.interests)
        ? profileData.interests
        : [],
      stats: {
        posts: 0,
        connections: 0,
        groups: 0,
      },
    };

    // Create or update profile
    let profile = await Profile.findOne({ user: userId });

    if (profile) {
      profile = await Profile.findOneAndUpdate(
        { user: userId },
        profileFields,
        { new: true, runValidators: true },
      );
    } else {
      profile = await Profile.create(profileFields);
    }

    // Prepare response
    const profileResponse = profile.toObject();
    profileResponse.profilePicture = getFullImageUrl(
      profileResponse.profilePicture,
      req,
    );
    profileResponse.coverPhoto = getFullImageUrl(
      profileResponse.coverPhoto,
      req,
    );

    res.status(200).json({
      success: true,
      message: "Profile setup complete",
      data: {
        user: {
          _id: updatedUser._id,
          name: updatedUser.name, // ✅ Now has updated name
          username: updatedUser.username,
          email: updatedUser.email,
          profileComplete: updatedUser.profileComplete,
        },
        profile: profileResponse,
      },
    });
  } catch (error) {
    console.error("Profile setup error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (error.code === 11000 && error.keyPattern?.username) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Profile setup failed",
    });
  }
};

/**
 * Check if user has completed their profile
 */
exports.checkProfileStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name profileComplete username email",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let profile = await Profile.findOne({ user: req.user.id });

    // Create basic profile if user is marked complete but profile doesn't exist
    if (!profile && user.profileComplete) {
      profile = await Profile.create({
        user: req.user.id,
        fullName: user.name,
        username: user.username || `user_${user._id}`,
        major: "Not set yet",
        year: "UPC",
        graduationYear: String(new Date().getFullYear() + 1),
        universityEmail: user.email,
        profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username || `user-${user._id}`}`,
        coverPhoto: "",
      });
    }

    const profileData = profile ? profile.toObject() : null;
    if (profileData) {
      profileData.profilePicture = getFullImageUrl(
        profileData.profilePicture,
        req,
      );
      profileData.coverPhoto = getFullImageUrl(profileData.coverPhoto, req);
    }

    res.status(200).json({
      success: true,
      data: {
        name: user.name,
        profileComplete: user.profileComplete || false,
        username: user.username || null,
        email: user.email || null,
        hasProfile: !!profile,
        profile: profileData,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check profile status",
    });
  }
};

// ============================================
// IMAGE UPLOAD & MANAGEMENT
// ============================================

/**
 * Upload profile picture
 */
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    const userId = req.user.id;
    const imageFilename = req.file.filename;
    const profilePicturePath = `/uploads/profile-pictures/${imageFilename}`;
    const fullImageUrl = getFullImageUrl(imageFilename, req);

    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { profilePicture: profilePicturePath },
      { new: true },
    );

    // Create profile if it doesn't exist
    if (!updatedProfile) {
      const user = await User.findById(userId);
      const newProfile = await Profile.create({
        user: userId,
        fullName: user.name,
        username: user.username || `user_${user._id}`,
        major: "Not set yet",
        year: "UPC",
        graduationYear: String(new Date().getFullYear() + 1),
        universityEmail: user.email,
        profilePicture: profilePicturePath,
        coverPhoto: "",
      });

      await User.findByIdAndUpdate(userId, { profileComplete: true });

      return res.status(200).json({
        success: true,
        message: "Profile picture uploaded and profile created",
        data: {
          profilePicture: fullImageUrl,
          profile: newProfile,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        profilePicture: fullImageUrl,
      },
    });
  } catch (error) {
    if (req.file && req.file.filename) {
      cleanupUploadedFile(req.file.filename, "profile-picture");
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
    });
  }
};

/**
 * Delete profile picture and reset to default avatar
 */
exports.deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await Profile.findOne({ user: userId });

    if (!profile || !profile.profilePicture) {
      return res.status(404).json({
        success: false,
        message: "No profile picture found",
      });
    }

    // Delete uploaded file if it's not an external URL
    const isUploadedFile = !profile.profilePicture.includes("http");
    if (isUploadedFile) {
      let filename;
      if (profile.profilePicture.includes("/uploads/profile-pictures/")) {
        filename = profile.profilePicture.split(
          "/uploads/profile-pictures/",
        )[1];
      } else if (profile.profilePicture.includes("/")) {
        filename = profile.profilePicture.split("/").pop();
      } else {
        filename = profile.profilePicture;
      }
      cleanupUploadedFile(filename, "profile-picture");
    }

    // Reset to default avatar
    const user = await User.findById(userId);
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username || userId}`;

    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { profilePicture: defaultAvatar },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "Profile picture removed",
      data: {
        profilePicture: defaultAvatar,
        profile: updatedProfile,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete profile picture",
    });
  }
};

/**
 * Upload cover photo
 */
exports.uploadCoverPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No cover photo file provided",
      });
    }

    const userId = req.user.id;
    const imageFilename = req.file.filename;
    const coverPhotoPath = `/uploads/cover-photos/${imageFilename}`;

    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { coverPhoto: coverPhotoPath },
      { new: true },
    );

    if (!updatedProfile) {
      cleanupUploadedFile(imageFilename, "cover-photo");
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const fullImageUrl = getFullImageUrl(coverPhotoPath, req);

    res.status(200).json({
      success: true,
      message: "Cover photo uploaded successfully",
      data: {
        coverPhoto: fullImageUrl,
        profile: updatedProfile,
      },
    });
  } catch (error) {
    if (req.file && req.file.filename) {
      cleanupUploadedFile(req.file.filename, "cover-photo");
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload cover photo",
      error: error.message,
    });
  }
};

/**
 * Delete cover photo
 */
exports.deleteCoverPhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    if (!profile.coverPhoto || profile.coverPhoto === "") {
      return res.status(400).json({
        success: false,
        message: "No cover photo to delete",
      });
    }

    // Extract filename from path
    let coverPhotoUrl = profile.coverPhoto;
    let filename;

    if (coverPhotoUrl.includes("/uploads/cover-photos/")) {
      filename = coverPhotoUrl.split("/uploads/cover-photos/")[1];
    } else if (coverPhotoUrl.includes("/")) {
      filename = coverPhotoUrl.split("/").pop();
    } else {
      filename = coverPhotoUrl;
    }

    cleanupUploadedFile(filename, "cover-photo");

    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { coverPhoto: "" },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "Cover photo deleted successfully",
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete cover photo",
      error: error.message,
    });
  }
};

// ============================================
// PROFILE RETRIEVAL
// ============================================

/**
 * Get authenticated user's detailed profile information
 */
exports.getProfileDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "name username email profileComplete",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = await Profile.findOne({ user: userId })
      .select("-__v -createdAt -updatedAt")
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    if (!profile.username && user.username) {
      profile.username = user.username;
    }

    profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
    profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          profileComplete: user.profileComplete,
        },
        profile,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile details",
    });
  }
};

/**
 * Get authenticated user's full profile with timestamps
 */
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "name username email profileComplete createdAt",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = await Profile.findOne({ user: userId })
      .select("-__v")
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found. Please complete your profile setup.",
      });
    }

    profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
    profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          profileComplete: user.profileComplete,
          createdAt: user.createdAt,
        },
        profile: {
          ...profile,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

/**
 * Get public profile by username
 */
exports.getProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const profile = await Profile.findOne({ username })
      .populate("user", "name email profileComplete")
      .select(
        "fullName username profilePicture coverPhoto bio major year graduationYear pronouns interests stats socialLinks",
      )
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
    profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: profile.user._id,
          name: profile.user.name,
          email: profile.user.email,
          profileComplete: profile.user.profileComplete,
          username: profile.username,
        },
        profile,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

/**
 * Get public profile by user ID
 */
/**
 * Get public profile by user ID
 */

exports.getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      "name username profileComplete",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = await Profile.findOne({ user: userId })
      .select(
        "fullName username profilePicture coverPhoto bio major year graduationYear pronouns interests stats socialLinks",
      )
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    if (!profile.socialLinks) {
      profile.socialLinks = {
        instagram: "",
        linkedin: "",
        github: "",
      };
    }

    if (!profile.stats) {
      profile.stats = {
        posts: 0,
        connections: 0,
        groups: 0,
      };
    }

    profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
    profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);

    // Get post count for this user - EXCLUDE ANONYMOUS POSTS
    const Post = require("../models/Post");
    const postCount = await Post.countDocuments({
      user: userId,
      isAnonymous: false, // ✅ Exclude anonymous posts
      isDeleted: { $ne: true },
    });

    profile.stats.posts = postCount;

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          profileComplete: user.profileComplete,
        },
        profile: {
          _id: profile._id,
          fullName: profile.fullName,
          username: profile.username,
          bio: profile.bio || "",
          major: profile.major || "",
          year: profile.year || "",
          graduationYear: profile.graduationYear || "",
          pronouns: profile.pronouns || "",
          profilePicture: profile.profilePicture || "",
          coverPhoto: profile.coverPhoto || "",
          socialLinks: profile.socialLinks,
          stats: profile.stats,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching public profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch public profile",
      error: error.message,
    });
  }
};

// ============================================
// PROFILE UPDATE
// ============================================

/**
 * Update profile information
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profileUpdate = {};

    // ✅ CRITICAL FIX: Handle fullName update - sync with User model
    if (
      updateData.fullName !== undefined &&
      updateData.fullName !== currentUser.name
    ) {
      // Update User model's name field
      currentUser.name = updateData.fullName;
      await currentUser.save();

      // Also update profile's fullName
      profileUpdate.fullName = updateData.fullName;
      console.log(`✅ Synced user name: ${currentUser.name}`);
    }

    // Handle username change
    if (updateData.username && updateData.username !== currentUser.username) {
      const existingUser = await User.findOne({
        username: updateData.username,
        _id: { $ne: userId },
      });

      const existingProfile = await Profile.findOne({
        username: updateData.username,
      });

      if (existingUser || existingProfile) {
        return res.status(400).json({
          success: false,
          message: "Username is already taken",
        });
      }

      currentUser.username = updateData.username;
      await currentUser.save();
      profileUpdate.username = updateData.username;
    }

    // Update profile fields
    if (updateData.bio !== undefined) profileUpdate.bio = updateData.bio;
    if (updateData.major) profileUpdate.major = updateData.major;
    if (updateData.year) profileUpdate.year = updateData.year;
    if (updateData.graduationYear)
      profileUpdate.graduationYear = updateData.graduationYear;
    if (updateData.pronouns !== undefined)
      profileUpdate.pronouns = updateData.pronouns;
    if (updateData.universityEmail)
      profileUpdate.universityEmail = updateData.universityEmail;

    // Handle profile picture (only external URLs)
    if (
      updateData.profilePicture &&
      updateData.profilePicture.includes("http")
    ) {
      profileUpdate.profilePicture = updateData.profilePicture;
    }

    // Handle cover photo
    if (updateData.coverPhoto !== undefined) {
      if (updateData.coverPhoto === "") {
        profileUpdate.coverPhoto = "";
      } else if (updateData.coverPhoto.startsWith("/uploads/")) {
        profileUpdate.coverPhoto = updateData.coverPhoto;
      } else if (updateData.coverPhoto.includes("http")) {
        profileUpdate.coverPhoto = updateData.coverPhoto;
      }
    }

    if (updateData.interests) profileUpdate.interests = updateData.interests;

    // Update social links
    if (updateData.socialLinks) {
      profileUpdate.socialLinks = {
        instagram: updateData.socialLinks.instagram || "",
        linkedin: updateData.socialLinks.linkedin || "",
        github: updateData.socialLinks.github || "",
      };
    }

    // Find or create profile
    let profile = await Profile.findOne({ user: userId });

    if (!profile) {
      if (!profileUpdate.username && currentUser.username) {
        profileUpdate.username = currentUser.username;
      }
      // Set default fullName from user if not provided
      if (!profileUpdate.fullName) {
        profileUpdate.fullName = currentUser.name;
      }

      profile = await Profile.create({
        user: userId,
        ...profileUpdate,
      });
    } else {
      if (!profileUpdate.username && currentUser.username) {
        profileUpdate.username = currentUser.username;
      }
      // Keep existing fullName if not updating
      if (!profileUpdate.fullName) {
        profileUpdate.fullName = profile.fullName;
      }

      profile = await Profile.findOneAndUpdate(
        { user: userId },
        { $set: profileUpdate },
        { new: true, runValidators: true },
      );
    }

    // Prepare response
    const profileResponse = profile.toObject();
    profileResponse.profilePicture = getFullImageUrl(
      profileResponse.profilePicture,
      req,
    );
    profileResponse.coverPhoto = getFullImageUrl(
      profileResponse.coverPhoto,
      req,
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          _id: currentUser._id,
          name: currentUser.name, // ✅ This will now have the updated name
          username: currentUser.username,
          email: currentUser.email,
        },
        profile: profileResponse,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);

    if (error.code === 11000 && error.keyPattern?.username) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// ============================================
// PUBLIC & SEARCH FUNCTIONS
// ============================================

/**
 * Get all profiles with pagination
 */
exports.getAllProfiles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const totalProfiles = await Profile.countDocuments();

    const profiles = await Profile.find()
      .select(
        "user fullName username profilePicture coverPhoto bio major year interests",
      )
      .populate("user", "name email")
      .skip(skip)
      .limit(limit)
      .lean();

    profiles.forEach((profile) => {
      profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
      profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);
    });

    res.status(200).json({
      success: true,
      data: {
        profiles,
        pagination: {
          page,
          limit,
          total: totalProfiles,
          pages: Math.ceil(totalProfiles / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profiles",
    });
  }
};

/**
 * Search profiles by name, username, major, or bio
 */
exports.searchProfiles = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const profiles = await Profile.find({
      $or: [
        { fullName: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
        { major: { $regex: query, $options: "i" } },
        { bio: { $regex: query, $options: "i" } },
      ],
    })
      .select("user fullName username profilePicture coverPhoto bio major year")
      .populate("user", "name email")
      .limit(20)
      .lean();

    profiles.forEach((profile) => {
      profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
      profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);
    });

    res.status(200).json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search profiles",
    });
  }
};
