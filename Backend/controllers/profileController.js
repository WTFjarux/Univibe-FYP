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

  // Already a full URL (http:// or https://) - return as is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Construct full URL for uploaded files
  const baseUrl = req ? `${req.protocol}://${req.get("host")}` : "";

  // If it's already a path like /uploads/profile-pictures/filename.jpg
  if (imagePath.startsWith("/uploads/")) {
    return `${baseUrl}${imagePath}`;
  }

  // If it's just a filename, determine which directory it belongs to
  if (imagePath.includes("profilePicture-")) {
    return `${baseUrl}/uploads/profile-pictures/${imagePath}`;
  } else if (imagePath.includes("coverPhoto-")) {
    return `${baseUrl}/uploads/cover-photos/${imagePath}`;
  } else if (imagePath.includes("user-")) {
    // For old format files, assume they're profile pictures
    return `${baseUrl}/uploads/profile-pictures/${imagePath}`;
  }

  // Default fallback
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
      console.log(`✅ Cleaned up ${fileType} file: ${filename}`);
    }
  } catch (error) {
    console.error(`❌ Error cleaning up file ${filename}:`, error);
  }
};

// ============================================
// PROFILE SETUP & BASIC INFO
// ============================================

/**
 * Check if a username is available for registration/profile setup
 * Used during signup and profile completion
 */
exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.user.id;

    // Basic validation
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

    // Validate allowed characters
    const validUsernameRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!validUsernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          "Username can only contain letters, numbers, dots, underscores and hyphens",
      });
    }

    const lowercaseUsername = username.toLowerCase();

    // Check against existing users (excluding current user)
    const existingUser = await User.findOne({
      username: lowercaseUsername,
      _id: { $ne: userId },
    });

    // Check against existing profiles
    const existingProfile = await Profile.findOne({
      username: lowercaseUsername,
    });

    // Username is taken
    if (existingUser || existingProfile) {
      return res.status(409).json({
        success: false,
        message: "Username already taken",
        available: false,
      });
    }

    // Username is available
    res.status(200).json({
      success: true,
      message: "Username available",
      available: true,
    });
  } catch (error) {
    console.error("❌ Username check error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking username availability",
    });
  }
};

/**
 * Complete initial profile setup for new users
 * Creates profile with required information
 */
exports.setupProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = req.body;

    // Validate required fields
    if (!profileData.username || !profileData.major || !profileData.year) {
      return res.status(400).json({
        success: false,
        message: "Username, major, and year are required",
      });
    }

    // Find user
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

    // Update user with profile completion status and username
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        profileComplete: true,
        username: profileData.username.trim(),
      },
      { new: true },
    );

    // Prepare profile data
    const profileFields = {
      user: userId,
      fullName: existingUser.name,
      username: profileData.username.trim(),
      major: profileData.major.trim(),
      year: profileData.year,
      graduationYear:
        profileData.graduationYear || String(new Date().getFullYear() + 1),
      bio: (profileData.bio || "").trim(),
      pronouns: (profileData.pronouns || "").trim(),
      universityEmail: (profileData.universityEmail || existingUser.email)
        .toLowerCase()
        .trim(),
      // Default profile picture using DiceBear avatar generator
      profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.username.trim()}`,
      // Default empty cover photo
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
        { new: true },
      );
    } else {
      profile = await Profile.create(profileFields);
    }

    // Convert image paths to full URLs for response
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
          name: updatedUser.name,
          username: updatedUser.username,
          email: updatedUser.email,
          profileComplete: updatedUser.profileComplete,
        },
        profile: profileResponse,
      },
    });
  } catch (error) {
    console.error("❌ Profile setup error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    // Handle duplicate username
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
 * Used to determine if user needs to complete profile setup
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

    // Create basic profile if user is marked as complete but profile doesn't exist
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

    // Convert image paths to full URLs
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
    console.error("❌ Profile status check error:", error);
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
 * Accepts image file and updates user's profile picture
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

    // Create the correct path for profile picture
    // Profile pictures go to: /uploads/profile-pictures/filename.jpg
    const profilePicturePath = `/uploads/profile-pictures/${imageFilename}`;

    // Get full URL for response
    const fullImageUrl = getFullImageUrl(imageFilename, req);

    console.log("📸 Profile picture upload details:", {
      userId,
      filename: imageFilename,
      path: profilePicturePath,
      fullUrl: fullImageUrl,
    });

    // Update profile with the correct path (not just filename)
    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { profilePicture: profilePicturePath }, // Store the path, not just filename
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
        profilePicture: profilePicturePath, // Store path here too
        coverPhoto: "",
      });

      // Mark user as having completed profile
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
    console.error("❌ Profile picture upload error:", error);

    // Clean up uploaded file on error
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
 * Delete profile picture
 * Removes uploaded file and resets to default DiceBear avatar
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

    // Check if it's an uploaded file (not external URL)
    const isUploadedFile = !profile.profilePicture.includes("http");

    // Delete file from server if it's uploaded
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

    // Reset to default DiceBear avatar
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
    console.error("❌ Profile picture delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete profile picture",
    });
  }
};

/**
 * Upload cover photo
 * Accepts image file and updates user's cover photo
 */
exports.uploadCoverPhoto = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No cover photo file provided",
      });
    }

    const userId = req.user.id;
    const imageFilename = req.file.filename;

    console.log("📸 Uploading cover photo for user:", userId);

    // ✅ FIXED: Store relative path instead of full URL
    const coverPhotoPath = `/uploads/cover-photos/${imageFilename}`;

    // Update the user's profile with the relative path
    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { coverPhoto: coverPhotoPath }, // Store relative path, NOT full URL
      { new: true },
    );

    if (!updatedProfile) {
      // Clean up uploaded file if profile not found
      cleanupUploadedFile(imageFilename, "cover-photo");

      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // ✅ Get full URL for response only (not storage)
    const fullImageUrl = getFullImageUrl(coverPhotoPath, req);

    console.log("✅ Cover photo updated successfully for user:", userId);

    res.status(200).json({
      success: true,
      message: "Cover photo uploaded successfully",
      data: {
        coverPhoto: fullImageUrl, // Send full URL in response
        profile: updatedProfile,
      },
    });
  } catch (error) {
    console.error("❌ Cover photo upload error:", error);

    // Clean up uploaded file on error
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
 * Removes uploaded file and sets cover photo to empty
 */
exports.deleteCoverPhoto = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("🗑️ Deleting cover photo for user:", userId);

    // Find the user's profile
    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Check if there's a cover photo to delete
    if (!profile.coverPhoto || profile.coverPhoto === "") {
      return res.status(400).json({
        success: false,
        message: "No cover photo to delete",
      });
    }

    // Extract filename from URL (handle both full URL and relative path)
    let coverPhotoUrl = profile.coverPhoto;
    let filename;

    if (coverPhotoUrl.includes("/uploads/cover-photos/")) {
      filename = coverPhotoUrl.split("/uploads/cover-photos/")[1];
    } else if (coverPhotoUrl.includes("/")) {
      filename = coverPhotoUrl.split("/").pop();
    } else {
      filename = coverPhotoUrl;
    }

    // Delete the file from server
    cleanupUploadedFile(filename, "cover-photo");

    // Update profile to remove cover photo URL
    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { coverPhoto: "" }, // Set to empty string
      { new: true },
    );

    console.log("✅ Cover photo deleted successfully for user:", userId);

    res.status(200).json({
      success: true,
      message: "Cover photo deleted successfully",
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error) {
    console.error("❌ Cover photo delete error:", error);
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
 * Includes all profile fields with full image URLs
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

    // Ensure profile has username (fallback to user's username)
    if (!profile.username && user.username) {
      profile.username = user.username;
    }

    // Convert image paths to full URLs
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
    console.error("❌ Get profile details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile details",
    });
  }
};

/**
 * Get authenticated user's full profile with timestamps
 * Used for the main profile screen
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

    // Convert image paths to full URLs
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
    console.error("❌ Get my profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

/**
 * Get public profile by username
 * Used for viewing other users' profiles
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

    // Convert image paths to full URLs
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
    console.error("❌ Get profile by username error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

/**
 * Get public profile by user ID
 * Alternative public profile endpoint
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
        "fullName username profilePicture coverPhoto bio major year graduationYear pronouns interests stats",
      )
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Convert image paths to full URLs
    profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
    profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          profileComplete: user.profileComplete,
        },
        profile,
      },
    });
  } catch (error) {
    console.error("❌ Get public profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch public profile",
    });
  }
};

// ============================================
// PROFILE UPDATE
// ============================================

/**
 * Update profile information
 * Allows updating all editable profile fields
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

    const profileUpdate = {
      fullName: currentUser.name,
    };

    // Handle username change with availability check
    if (updateData.username && updateData.username !== currentUser.username) {
      // Check username availability
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

      // Update username in both models
      currentUser.username = updateData.username;
      await currentUser.save();
      profileUpdate.username = updateData.username;
    }

    // Update other profile fields
    if (updateData.bio !== undefined) profileUpdate.bio = updateData.bio;
    if (updateData.major) profileUpdate.major = updateData.major;
    if (updateData.year) profileUpdate.year = updateData.year;
    if (updateData.graduationYear)
      profileUpdate.graduationYear = updateData.graduationYear;
    if (updateData.pronouns !== undefined)
      profileUpdate.pronouns = updateData.pronouns;
    if (updateData.universityEmail)
      profileUpdate.universityEmail = updateData.universityEmail;

    // Handle profile picture update (only allow external URLs)
    if (
      updateData.profilePicture &&
      updateData.profilePicture.includes("http")
    ) {
      profileUpdate.profilePicture = updateData.profilePicture;
    }

    // Handle cover photo update (allow empty string or external URLs)
    if (updateData.coverPhoto !== undefined) {
      // If it's an empty string, set to empty
      if (updateData.coverPhoto === "") {
        profileUpdate.coverPhoto = "";
      }
      // If it's an uploaded file path (starts with /uploads/)
      else if (updateData.coverPhoto.startsWith("/uploads/")) {
        profileUpdate.coverPhoto = updateData.coverPhoto;
      }
      // If it's an external URL, store as is
      else if (updateData.coverPhoto.includes("http")) {
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
      // Include username when creating new profile
      if (!profileUpdate.username && currentUser.username) {
        profileUpdate.username = currentUser.username;
      }

      profile = await Profile.create({
        user: userId,
        ...profileUpdate,
      });
    } else {
      // Ensure username is included in update
      if (!profileUpdate.username && currentUser.username) {
        profileUpdate.username = currentUser.username;
      }

      profile = await Profile.findOneAndUpdate(
        { user: userId },
        { $set: profileUpdate },
        { new: true },
      );
    }

    // Convert image paths to full URLs for response
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
          name: currentUser.name,
          username: currentUser.username,
          email: currentUser.email,
        },
        profile: profileResponse,
      },
    });
  } catch (error) {
    console.error("❌ Update profile error:", error);

    // Handle duplicate username
    if (error.code === 11000 && error.keyPattern?.username) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Handle validation errors
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
 * Used for browsing/exploring users
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

    // Convert image paths to full URLs
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
    console.error("❌ Get all profiles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profiles",
    });
  }
};

/**
 * Search profiles by name, username, major, or bio
 * Used for the search functionality
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

    // Convert image paths to full URLs
    profiles.forEach((profile) => {
      profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
      profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);
    });

    res.status(200).json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    console.error("❌ Search profiles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search profiles",
    });
  }
};
