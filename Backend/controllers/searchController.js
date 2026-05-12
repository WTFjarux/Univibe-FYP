// controllers/searchController.js

const User = require("../models/User");
const Profile = require("../models/Profile");
const Post = require("../models/Post");
const Event = require("../models/Event");
const BlockService = require("../services/blockService");

// ============================================
// HELPER: Get full image URL (consistent with profileController)
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
  return `${baseUrl}/uploads/${imagePath}`;
};

// ============================================
// 1. SEARCH USERS
// ============================================
exports.searchUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { q, page = 1, limit = 20, campus, major, year } = req.query;

    // Validate query
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = new RegExp(q.trim(), "i");

    // Get blocked user IDs (both directions)
    const blockedUserIds = await BlockService.getBlockedUserIds(currentUserId);
    // Also exclude the current user from results
    const excludeIds = [...blockedUserIds, currentUserId.toString()];

    // Build search filter
    const searchFilter = {
      user: { $nin: excludeIds },
      $or: [
        { fullName: { $regex: searchRegex } },
        { username: { $regex: searchRegex } },
        { bio: { $regex: searchRegex } },
        { major: { $regex: searchRegex } },
      ],
    };

    // Apply optional filters
    if (campus) searchFilter.campus = campus;
    if (major) searchFilter.major = { $regex: new RegExp(major, "i") };
    if (year) searchFilter.year = year;

    // Execute search with pagination
    const [profiles, total] = await Promise.all([
      Profile.find(searchFilter)
        .select(
          "user fullName username profilePicture bio major year campus verified",
        )
        .populate("user", "name email")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Profile.countDocuments(searchFilter),
    ]);

    // Get current user's connections for status check
    const currentUser = await User.findById(currentUserId)
      .select("connections connectionRequestsSent connectionRequestsReceived")
      .lean();

    const connectionIds = (currentUser?.connections || []).map((id) =>
      id.toString(),
    );
    const sentRequestIds = (currentUser?.connectionRequestsSent || []).map(
      (id) => id.toString(),
    );
    const receivedRequestIds = (
      currentUser?.connectionRequestsReceived || []
    ).map((id) => id.toString());

    // Enrich profiles with connection status and full image URLs
    const enrichedProfiles = profiles.map((profile) => {
      const profileUserId = profile.user?._id?.toString();

      // Determine connection status
      let connectionStatus = "not_connected";
      if (connectionIds.includes(profileUserId)) {
        connectionStatus = "connected";
      } else if (sentRequestIds.includes(profileUserId)) {
        connectionStatus = "pending_sent";
      } else if (receivedRequestIds.includes(profileUserId)) {
        connectionStatus = "pending_received";
      }

      return {
        _id: profile._id,
        user: {
          _id: profile.user?._id,
          name: profile.user?.name || profile.fullName,
          email: profile.user?.email,
        },
        fullName: profile.fullName,
        username: profile.username,
        bio: profile.bio || "",
        major: profile.major || "",
        year: profile.year || "",
        campus: profile.campus || "",
        verified: profile.verified || false,
        profilePicture: getFullImageUrl(profile.profilePicture, req),
        connectionStatus,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        users: enrichedProfiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        searchMeta: {
          query: q.trim(),
          campus: campus || null,
          major: major || null,
          year: year || null,
        },
      },
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search users",
    });
  }
};

// ============================================
// 2. SEARCH POSTS
// ============================================
exports.searchPosts = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const {
      q,
      page = 1,
      limit = 10,
      campus,
      type, // "caption" | "tags" | undefined (both)
    } = req.query;

    // Validate query
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = new RegExp(q.trim(), "i");

    // Get blocked user IDs
    const blockedUserIds = await BlockService.getBlockedUserIds(currentUserId);

    // Get current user's campus and connections
    const currentUser = await User.findById(currentUserId)
      .select("connections")
      .lean();
    const currentUserProfile = await Profile.findOne({ user: currentUserId })
      .select("campus")
      .lean();
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";
    const connectionIds = (currentUser?.connections || []).map((id) =>
      id.toString(),
    );

    // Build search conditions based on type
    const searchConditions = [];
    if (!type || type === "caption") {
      searchConditions.push({ content: { $regex: searchRegex } });
    }
    if (!type || type === "tags") {
      searchConditions.push({ tags: { $regex: searchRegex } });
    }

    // Build visibility conditions (same logic as feed)
    const visibilityConditions = [
      // Own posts
      { user: currentUserId, isDeleted: false },
      // Campus posts
      {
        visibility: "campus",
        campus: currentUserCampus,
        isDeleted: false,
        user: { $nin: blockedUserIds },
      },
      // Connection posts
      {
        visibility: "connections",
        user: { $in: connectionIds, $nin: blockedUserIds },
        isDeleted: false,
      },
      // Anonymous posts
      { isAnonymous: true, isDeleted: false },
    ];

    // Build final query
    const finalQuery = {
      $and: [{ $or: searchConditions }, { $or: visibilityConditions }],
    };

    // Apply optional campus filter
    if (campus) {
      finalQuery.campus = campus;
    }

    // Execute search
    const [posts, total] = await Promise.all([
      Post.find(finalQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "name username email verified")
        .lean(),
      Post.countDocuments(finalQuery),
    ]);

    // Get profile pictures for post authors
    const userIds = posts.map((post) => post.user?._id).filter(Boolean);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      if (profile.user) {
        profilePictureMap[profile.user.toString()] =
          profile.profilePicture || "";
      }
    });

    // Count comments for each post
    const Comment = require("../models/Comment");
    const postIds = posts.map((post) => post._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    // Enrich posts
    const enrichedPosts = posts.map((post) => {
      if (post.isAnonymous) {
        return {
          ...post,
          originalUser: post.user,
          user: {
            _id: null,
            name: "Anonymous",
            username: "anonymous",
            email: null,
            verified: false,
            profilePicture: null,
          },
          commentCount: commentCountMap[post._id.toString()] || 0,
          isLiked: false,
        };
      }

      return {
        ...post,
        user: {
          ...post.user,
          profilePicture: getFullImageUrl(
            profilePictureMap[post.user?._id?.toString()] || "",
            req,
          ),
        },
        commentCount: commentCountMap[post._id.toString()] || 0,
        isLiked: false,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        posts: enrichedPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        searchMeta: {
          query: q.trim(),
          type: type || "all",
          campus: campus || currentUserCampus,
        },
      },
    });
  } catch (error) {
    console.error("Search posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search posts",
    });
  }
};

// ============================================
// 3. SEARCH EVENTS
// ============================================
exports.searchEvents = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { q, page = 1, limit = 10, campus, category, status } = req.query;

    // Validate query
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = new RegExp(q.trim(), "i");

    // Get blocked user IDs (exclude events from blocked users)
    const blockedUserIds = await BlockService.getBlockedUserIds(currentUserId);

    // Build search filter
    const searchFilter = {
      organizer: { $nin: blockedUserIds },
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } },
        { location: { $regex: searchRegex } },
      ],
    };

    // Apply optional filters
    if (campus) searchFilter.campus = campus;
    if (category) searchFilter.category = category;
    if (status) {
      searchFilter.status = status;
    } else {
      // Default: show only upcoming and ongoing events
      searchFilter.status = { $in: ["upcoming", "ongoing"] };
    }

    // Execute search
    const [events, total] = await Promise.all([
      Event.find(searchFilter)
        .sort({ startDate: 1 }) // Nearest events first
        .skip(skip)
        .limit(parseInt(limit))
        .populate("organizer", "name username")
        .lean(),
      Event.countDocuments(searchFilter),
    ]);

    // Get organizer profile pictures
    const organizerIds = events
      .map((event) => event.organizer?._id)
      .filter(Boolean);
    const profiles = await Profile.find({ user: { $in: organizerIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      if (profile.user) {
        profilePictureMap[profile.user.toString()] =
          profile.profilePicture || "";
      }
    });

    // Enrich events
    const enrichedEvents = events.map((event) => {
      const coverImage =
        event.images?.find((img) => img.isCover) || event.images?.[0];

      return {
        ...event,
        organizer: {
          ...event.organizer,
          profilePicture: getFullImageUrl(
            profilePictureMap[event.organizer?._id?.toString()] || "",
            req,
          ),
        },
        coverImage: coverImage ? getFullImageUrl(coverImage.url, req) : null,
        imageCount: event.images?.length || 0,
        isFull: event.maxAttendees
          ? event.rsvpCount >= event.maxAttendees
          : false,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        events: enrichedEvents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        searchMeta: {
          query: q.trim(),
          campus: campus || null,
          category: category || null,
          status: status || "upcoming,ongoing",
        },
      },
    });
  } catch (error) {
    console.error("Search events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search events",
    });
  }
};

// ============================================
// 4. UNIFIED SEARCH (all types at once)
// ============================================
exports.searchAll = async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    // Run all 3 searches in parallel with smaller limits
    const [userResults, postResults, eventResults] = await Promise.allSettled([
      // Users
      (async () => {
        const blockedUserIds = await BlockService.getBlockedUserIds(
          req.user._id,
        );
        const searchRegex = new RegExp(q.trim(), "i");
        const profiles = await Profile.find({
          user: { $nin: [...blockedUserIds, req.user._id.toString()] },
          $or: [
            { fullName: { $regex: searchRegex } },
            { username: { $regex: searchRegex } },
          ],
        })
          .select("user fullName username profilePicture verified")
          .limit(parseInt(limit))
          .lean();

        return profiles.map((profile) => ({
          _id: profile._id,
          user: {
            _id: profile.user?._id,
            name: profile.fullName,
          },
          username: profile.username,
          profilePicture: getFullImageUrl(profile.profilePicture, req),
          verified: profile.verified || false,
          type: "user",
        }));
      })(),

      // Posts
      (async () => {
        const searchRegex = new RegExp(q.trim(), "i");
        const posts = await Post.find({
          isDeleted: false,
          content: { $regex: searchRegex },
        })
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .select("content createdAt")
          .lean();

        return posts.map((post) => ({
          _id: post._id,
          content: post.content?.substring(0, 100),
          createdAt: post.createdAt,
          type: "post",
        }));
      })(),

      // Events
      (async () => {
        const searchRegex = new RegExp(q.trim(), "i");
        const events = await Event.find({
          status: { $in: ["upcoming", "ongoing"] },
          title: { $regex: searchRegex },
        })
          .sort({ startDate: 1 })
          .limit(parseInt(limit))
          .select("title startDate category")
          .lean();

        return events.map((event) => ({
          _id: event._id,
          title: event.title,
          startDate: event.startDate,
          category: event.category,
          type: "event",
        }));
      })(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: userResults.status === "fulfilled" ? userResults.value : [],
        posts: postResults.status === "fulfilled" ? postResults.value : [],
        events: eventResults.status === "fulfilled" ? eventResults.value : [],
      },
      searchMeta: {
        query: q.trim(),
      },
    });
  } catch (error) {
    console.error("Unified search error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform search",
    });
  }
};
