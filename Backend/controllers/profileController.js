// backend/controllers/profileController.js
const User = require("../models/User");
const Profile = require("../models/Profile");
const Block = require("../models/Block");
const BlockService = require("../services/blockService");
const fs = require("fs");
const path = require("path");

// ============================================
// HELPER FUNCTIONS
// ============================================

const getFullImageUrl = (imagePath, req) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  const baseUrl = req ? `${req.protocol}://${req.get("host")}` : "";

  if (imagePath.startsWith("/uploads/")) {
    return `${baseUrl}${imagePath}`;
  }

  if (imagePath.includes("profilePicture-")) {
    return `${baseUrl}/uploads/profile-pictures/${imagePath}`;
  } else if (imagePath.includes("coverPhoto-")) {
    return `${baseUrl}/uploads/cover-photos/${imagePath}`;
  }

  return `${baseUrl}/uploads/${imagePath}`;
};

const cleanupUploadedFile = (filename, fileType = "profile-picture") => {
  try {
    const directory =
      fileType === "cover-photo" ? "cover-photos" : "profile-pictures";
    const filePath = path.join(__dirname, "..", "uploads", directory, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    // Silent fail - cleanup is best effort
  }
};

// ============================================
// PROFILE SETUP
// ============================================

exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.user.id;

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
          "Username can only contain letters, numbers, underscores, dots and hyphens",
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
    console.error("Username check error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking username availability",
    });
  }
};

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

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        profileComplete: true,
        username: profileData.username.trim(),
        ...(profileData.fullName && { name: profileData.fullName }),
      },
      { new: true },
    );

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
      profilePicture: "",
      coverPhoto: "",
      socialLinks: {
        instagram: (profileData.instagram || "").trim(),
        linkedin: (profileData.linkedin || "").trim(),
        github: (profileData.github || "").trim(),
      },
      interests: Array.isArray(profileData.interests)
        ? profileData.interests
        : [],
      stats: { posts: 0, connections: 0, groups: 0 },
    };

    let profile = await Profile.findOne({ user: userId });

    if (profile) {
      profile = await Profile.findOneAndUpdate(
        { user: userId },
        profileFields,
        {
          new: true,
          runValidators: true,
        },
      );
    } else {
      profile = await Profile.create(profileFields);
    }

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
    console.error("Profile setup error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res
        .status(400)
        .json({ success: false, message: messages.join(", ") });
    }

    if (error.code === 11000 && error.keyPattern?.username) {
      return res
        .status(400)
        .json({ success: false, message: "Username already exists" });
    }

    res.status(500).json({ success: false, message: "Profile setup failed" });
  }
};

exports.checkProfileStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name profileComplete username email",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let profile = await Profile.findOne({ user: req.user.id });

    if (!profile && user.profileComplete) {
      profile = await Profile.create({
        user: req.user.id,
        fullName: user.name,
        username: user.username || `user_${user._id}`,
        major: "Not set yet",
        year: "UPC",
        graduationYear: String(new Date().getFullYear() + 1),
        universityEmail: user.email,
        profilePicture: "",
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
    console.error("Profile status check error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to check profile status" });
  }
};

// ============================================
// IMAGE UPLOAD & MANAGEMENT
// ============================================

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image file uploaded" });
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
        data: { profilePicture: fullImageUrl, profile: newProfile },
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: { profilePicture: fullImageUrl },
    });
  } catch (error) {
    if (req.file?.filename)
      cleanupUploadedFile(req.file.filename, "profile-picture");
    console.error("Profile picture upload error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to upload profile picture" });
  }
};

exports.deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await Profile.findOne({ user: userId });

    if (!profile?.profilePicture) {
      return res
        .status(404)
        .json({ success: false, message: "No profile picture found" });
    }

    const isUploadedFile =
      profile.profilePicture &&
      !profile.profilePicture.startsWith("http") &&
      profile.profilePicture.trim() !== "";

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
      if (filename) {
        cleanupUploadedFile(filename, "profile-picture");
      }
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { user: userId },
      { profilePicture: "" },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "Profile picture removed successfully",
      data: { profilePicture: "", profile: updatedProfile },
    });
  } catch (error) {
    console.error("Profile picture deletion error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete profile picture" });
  }
};

exports.uploadCoverPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No cover photo file provided" });
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
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    const fullImageUrl = getFullImageUrl(coverPhotoPath, req);

    res.status(200).json({
      success: true,
      message: "Cover photo uploaded successfully",
      data: { coverPhoto: fullImageUrl, profile: updatedProfile },
    });
  } catch (error) {
    if (req.file?.filename)
      cleanupUploadedFile(req.file.filename, "cover-photo");
    console.error("Cover photo upload error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to upload cover photo" });
  }
};

exports.deleteCoverPhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    if (!profile.coverPhoto || profile.coverPhoto === "") {
      return res
        .status(400)
        .json({ success: false, message: "No cover photo to delete" });
    }

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
      data: { profile: updatedProfile },
    });
  } catch (error) {
    console.error("Cover photo deletion error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete cover photo" });
  }
};

// ============================================
// PROFILE RETRIEVAL
// ============================================

exports.getProfileDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select(
      "name username email profileComplete",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const profile = await Profile.findOne({ user: userId })
      .select("-__v -createdAt -updatedAt")
      .lean();

    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    if (!profile.username && user.username) profile.username = user.username;

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
    console.error("Profile details error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch profile details" });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "name username email profileComplete createdAt",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
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

    const currentUser = await User.findById(userId).select("connectionCount");
    const Post = require("../models/Post");
    const Community = require("../models/Community");

    const [postCount, communityCount] = await Promise.all([
      Post.countDocuments({
        user: userId,
        isAnonymous: false,
        isDeleted: { $ne: true },
        community: null,
      }),
      Community.countDocuments({
        $or: [{ "members.user": userId }, { admins: userId }],
      }),
    ]);

    // ✅ Move console.log here after variables are defined
    console.log(`📊 Stats for user ${userId}:`, {
      postCount,
      connectionCount: currentUser?.connectionCount || 0,
      communityCount,
    });

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
          stats: {
            posts: postCount,
            connections: currentUser?.connectionCount || 0,
            groups: profile.stats?.groups || 0,
            communities: communityCount,
          },
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Get my profile error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch profile" });
  }
};

exports.getProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user.id;

    const profile = await Profile.findOne({ username })
      .populate("user", "name email profileComplete")
      .select(
        "fullName username profilePicture coverPhoto bio major year graduationYear pronouns interests stats socialLinks",
      )
      .lean();

    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    const profileOwnerId = profile.user._id.toString();
    if (profileOwnerId !== currentUserId) {
      const isBlocked = await Block.areUsersBlocked(
        currentUserId,
        profileOwnerId,
      );
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "You cannot view this profile",
          isBlocked: true,
        });
      }
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
    console.error("Get profile by username error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch profile" });
  }
};

exports.getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // ✅ Import models
    const Post = require("../models/Post");
    const Community = require("../models/Community");

    if (userId === currentUserId) {
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

      profile.socialLinks = profile.socialLinks || {
        instagram: "",
        linkedin: "",
        github: "",
      };
      profile.stats = profile.stats || { posts: 0, connections: 0, groups: 0 };

      profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
      profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);

      const targetUser = await User.findById(userId).select("connectionCount");

      // ✅ Fetch post count and community count in parallel
      const [postCount, communityCount] = await Promise.all([
        Post.countDocuments({
          user: userId,
          isAnonymous: false,
          isDeleted: { $ne: true },
          community: null, // Exclude community posts from personal count
        }),
        Community.countDocuments({
          $or: [{ "members.user": userId }, { admins: userId }],
        }),
      ]);

      const profileResponse = {
        ...profile,
        stats: {
          posts: postCount,
          connections: targetUser?.connectionCount || 0,
          groups: profile.stats?.groups || 0,
          communities: communityCount, // ✅ Added
        },
      };

      return res.status(200).json({
        success: true,
        data: {
          user: {
            _id: user._id,
            name: user.name,
            username: user.username,
            profileComplete: user.profileComplete,
          },
          profile: {
            _id: profileResponse._id,
            fullName: profileResponse.fullName,
            username: profileResponse.username,
            bio: profileResponse.bio || "",
            major: profileResponse.major || "",
            year: profileResponse.year || "",
            graduationYear: profileResponse.graduationYear || "",
            pronouns: profileResponse.pronouns || "",
            profilePicture: profileResponse.profilePicture || "",
            coverPhoto: profileResponse.coverPhoto || "",
            socialLinks: profileResponse.socialLinks,
            stats: profileResponse.stats,
          },
        },
      });
    }

    // Other user's profile
    const isBlocked = await Block.areUsersBlocked(currentUserId, userId);

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this profile",
        isBlocked: true,
      });
    }

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

    profile.socialLinks = profile.socialLinks || {
      instagram: "",
      linkedin: "",
      github: "",
    };
    profile.stats = profile.stats || { posts: 0, connections: 0, groups: 0 };

    profile.profilePicture = getFullImageUrl(profile.profilePicture, req);
    profile.coverPhoto = getFullImageUrl(profile.coverPhoto, req);

    const targetUser = await User.findById(userId).select("connectionCount");

    // ✅ Fetch post count and community count in parallel
    const [postCount, communityCount] = await Promise.all([
      Post.countDocuments({
        user: userId,
        isAnonymous: false,
        isDeleted: { $ne: true },
        community: null, // Exclude community posts from personal count
      }),
      Community.countDocuments({
        $or: [{ "members.user": userId }, { admins: userId }],
      }),
    ]);

    const profileResponse = {
      ...profile,
      stats: {
        posts: postCount,
        connections: targetUser?.connectionCount || 0,
        groups: profile.stats?.groups || 0,
        communities: communityCount, // ✅ Added
      },
    };

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
          _id: profileResponse._id,
          fullName: profileResponse.fullName,
          username: profileResponse.username,
          bio: profileResponse.bio || "",
          major: profileResponse.major || "",
          year: profileResponse.year || "",
          graduationYear: profileResponse.graduationYear || "",
          pronouns: profileResponse.pronouns || "",
          profilePicture: profileResponse.profilePicture || "",
          coverPhoto: profileResponse.coverPhoto || "",
          socialLinks: profileResponse.socialLinks,
          stats: profileResponse.stats,
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

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const profileUpdate = {};

    if (
      updateData.fullName !== undefined &&
      updateData.fullName !== currentUser.name
    ) {
      currentUser.name = updateData.fullName;
      await currentUser.save();
      profileUpdate.fullName = updateData.fullName;
    }

    if (updateData.username && updateData.username !== currentUser.username) {
      const existingUser = await User.findOne({
        username: updateData.username,
        _id: { $ne: userId },
      });
      const existingProfile = await Profile.findOne({
        username: updateData.username,
      });

      if (existingUser || existingProfile) {
        return res
          .status(400)
          .json({ success: false, message: "Username is already taken" });
      }

      currentUser.username = updateData.username;
      await currentUser.save();
      profileUpdate.username = updateData.username;
    }

    if (updateData.bio !== undefined) profileUpdate.bio = updateData.bio;
    if (updateData.major) profileUpdate.major = updateData.major;
    if (updateData.year) profileUpdate.year = updateData.year;
    if (updateData.graduationYear)
      profileUpdate.graduationYear = updateData.graduationYear;
    if (updateData.pronouns !== undefined)
      profileUpdate.pronouns = updateData.pronouns;
    if (updateData.universityEmail)
      profileUpdate.universityEmail = updateData.universityEmail;

    if (updateData.profilePicture !== undefined) {
      if (updateData.profilePicture === "") {
        profileUpdate.profilePicture = "";
      } else if (updateData.profilePicture.includes("http")) {
        profileUpdate.profilePicture = updateData.profilePicture;
      } else if (updateData.profilePicture.startsWith("/uploads/")) {
        profileUpdate.profilePicture = updateData.profilePicture;
      }
    }

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

    if (updateData.socialLinks) {
      profileUpdate.socialLinks = {
        instagram: updateData.socialLinks.instagram || "",
        linkedin: updateData.socialLinks.linkedin || "",
        github: updateData.socialLinks.github || "",
      };
    }

    let profile = await Profile.findOne({ user: userId });

    if (!profile) {
      if (!profileUpdate.username && currentUser.username)
        profileUpdate.username = currentUser.username;
      if (!profileUpdate.fullName) profileUpdate.fullName = currentUser.name;

      profile = await Profile.create({ user: userId, ...profileUpdate });
    } else {
      if (!profileUpdate.username && currentUser.username)
        profileUpdate.username = currentUser.username;
      if (!profileUpdate.fullName) profileUpdate.fullName = profile.fullName;

      profile = await Profile.findOneAndUpdate(
        { user: userId },
        { $set: profileUpdate },
        { new: true, runValidators: true },
      );
    }

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
    console.error("Profile update error:", error);

    if (error.code === 11000 && error.keyPattern?.username) {
      return res
        .status(400)
        .json({ success: false, message: "Username already exists" });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ success: false, message: messages.join(", ") });
    }

    res
      .status(500)
      .json({ success: false, message: "Failed to update profile" });
  }
};

// ============================================
// PUBLIC & SEARCH FUNCTIONS
// ============================================

exports.getAllProfiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const blockedUserIds = await BlockService.getBlockedUserIds(userId);

    const totalProfiles = await Profile.countDocuments({
      user: { $nin: blockedUserIds },
    });

    const profiles = await Profile.find({
      user: { $nin: blockedUserIds },
    })
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
    console.error("Get all profiles error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch profiles" });
  }
};

exports.searchProfiles = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.id;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const blockedUserIds = await BlockService.getBlockedUserIds(userId);

    const profiles = await Profile.find({
      user: { $nin: blockedUserIds },
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
    console.error("Search profiles error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to search profiles" });
  }
};

exports.searchConnections = async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    const userId = req.user.id;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const blockedUserIds = await BlockService.getBlockedUserIds(userId);

    const currentUser = await User.findById(userId)
      .select("connections")
      .lean();

    const connectionIds = (currentUser?.connections || [])
      .map((id) => id.toString())
      .filter((id) => !blockedUserIds.includes(id));

    if (connectionIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const users = await User.find({
      _id: { $in: connectionIds },
      $or: [
        { name: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
      ],
    })
      .select("name username profilePicture")
      .limit(parseInt(limit))
      .lean();

    const profiles = await Promise.all(
      users.map(async (user) => {
        const profile = await Profile.findOne({ user: user._id })
          .select("profilePicture bio")
          .lean();
        return {
          user: {
            _id: user._id,
            name: user.name,
            username: user.username,
          },
          profilePicture: profile?.profilePicture || "",
          bio: profile?.bio || "",
        };
      }),
    );

    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error("searchConnections error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Report a user
 */
exports.reportUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const reporterId = req.user._id;
    const { reason, description } = req.body;

    console.log("📝 Report user request:", {
      targetUserId,
      reporterId,
      reason,
      description,
    });

    // Validate required fields
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }

    // Validate reason enum
    const validReasons = [
      "spam",
      "harassment",
      "hate_speech",
      "inappropriate_content",
      "violence",
      "self_harm",
      "misinformation",
      "impersonation",
      "copyright",
      "other",
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report reason",
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent self-reporting
    if (targetUserId.toString() === reporterId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot report yourself",
      });
    }

    // FIX: Use getAdminModel to get the Report model
    const { getAdminModel } = require("../config/database");
    const Report = getAdminModel("Report");

    // Check for existing report
    const existingReport = await Report.findOne({
      reportedBy: reporterId,
      targetType: "User",
      targetId: targetUserId,
      status: { $in: ["pending", "reviewing"] },
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: "You have already reported this user",
      });
    }

    // Create the report
    const report = await Report.create({
      reportedBy: reporterId,
      targetType: "User",
      targetId: targetUserId,
      reason,
      description: description || "",
      status: "pending",
    });

    console.log("✅ Report created successfully:", report._id);

    res.status(201).json({
      success: true,
      message: "User reported successfully. We'll review this report.",
      reportId: report._id,
    });
  } catch (error) {
    console.error("Report user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to report user",
    });
  }
};
