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

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = new RegExp(q.trim(), "i");

    const blockedUserIds = await BlockService.getBlockedUserIds(currentUserId);
    const excludeIds = [...blockedUserIds, currentUserId.toString()];

    const searchFilter = {
      user: { $nin: excludeIds },
      $or: [
        { fullName: { $regex: searchRegex } },
        { username: { $regex: searchRegex } },
        { bio: { $regex: searchRegex } },
        { major: { $regex: searchRegex } },
      ],
    };

    if (campus) searchFilter.campus = campus;
    if (major) searchFilter.major = { $regex: new RegExp(major, "i") };
    if (year) searchFilter.year = year;

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

    const enrichedProfiles = profiles.map((profile) => {
      const profileUserId = profile.user?._id?.toString();
      let connectionStatus = "not_connected";
      if (connectionIds.includes(profileUserId)) connectionStatus = "connected";
      else if (sentRequestIds.includes(profileUserId))
        connectionStatus = "pending_sent";
      else if (receivedRequestIds.includes(profileUserId))
        connectionStatus = "pending_received";

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
    res.status(500).json({ success: false, message: "Failed to search users" });
  }
};

// ============================================
// 2. SEARCH POSTS
// ============================================
exports.searchPosts = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { q, page = 1, limit = 10, campus, type } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = new RegExp(q.trim(), "i");

    const blockedUserIds = await BlockService.getBlockedUserIds(currentUserId);
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

    const searchConditions = [];
    if (!type || type === "caption")
      searchConditions.push({ content: { $regex: searchRegex } });
    if (!type || type === "tags")
      searchConditions.push({ tags: { $regex: searchRegex } });

    const visibilityConditions = [
      { user: currentUserId, isDeleted: false },
      {
        visibility: "campus",
        campus: currentUserCampus,
        isDeleted: false,
        user: { $nin: blockedUserIds },
      },
      {
        visibility: "connections",
        user: { $in: connectionIds, $nin: blockedUserIds },
        isDeleted: false,
      },
      { isAnonymous: true, isDeleted: false },
    ];

    const finalQuery = {
      $and: [{ $or: searchConditions }, { $or: visibilityConditions }],
    };
    if (campus) finalQuery.campus = campus;

    const [posts, total] = await Promise.all([
      Post.find(finalQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "name username email verified")
        .populate("community", "name coverImage")
        .lean(),
      Post.countDocuments(finalQuery),
    ]);

    const userIds = posts.map((post) => post.user?._id).filter(Boolean);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();
    const profilePictureMap = {};
    profiles.forEach((profile) => {
      if (profile.user)
        profilePictureMap[profile.user.toString()] =
          profile.profilePicture || "";
    });

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

    const enrichedPosts = posts.map((post) => {
      if (post.isAnonymous) {
        return {
          ...post,
          community: post.community || null,
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
        community: post.community || null,
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
    res.status(500).json({ success: false, message: "Failed to search posts" });
  }
};

// ============================================
// 3. SEARCH EVENTS
// ============================================
exports.searchEvents = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { q, page = 1, limit = 10, campus, category, status } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = new RegExp(q.trim(), "i");
    const blockedUserIds = await BlockService.getBlockedUserIds(currentUserId);

    const searchFilter = {
      organizer: { $nin: blockedUserIds },
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } },
        { location: { $regex: searchRegex } },
      ],
    };

    if (campus) searchFilter.campus = campus;
    if (category) searchFilter.category = category;
    if (status) searchFilter.status = status;
    else searchFilter.status = { $in: ["upcoming", "ongoing"] };

    const [events, total] = await Promise.all([
      Event.find(searchFilter)
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("organizer", "name username")
        .lean(),
      Event.countDocuments(searchFilter),
    ]);

    const organizerIds = events
      .map((event) => event.organizer?._id)
      .filter(Boolean);
    const profiles = await Profile.find({ user: { $in: organizerIds } })
      .select("user profilePicture")
      .lean();
    const profilePictureMap = {};
    profiles.forEach((profile) => {
      if (profile.user)
        profilePictureMap[profile.user.toString()] =
          profile.profilePicture || "";
    });

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
    res
      .status(500)
      .json({ success: false, message: "Failed to search events" });
  }
};

// ============================================
// 4. SEARCH COMMUNITIES
// ============================================
exports.searchCommunities = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const userProfile = await Profile.findOne({ user: currentUserId })
      .select("campus")
      .lean();
    const university = userProfile?.campus;

    const Community = require("../models/Community");
    const searchRegex = new RegExp(q.trim(), "i");

    const query = {
      university,
      isActive: true,
      $or: [
        { name: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ],
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [communities, total] = await Promise.all([
      Community.find(query)
        .sort({ memberCount: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Community.countDocuments(query),
    ]);

    const result = communities.map((c) => ({
      _id: c._id,
      name: c.name,
      description: c.description,
      memberCount: c.memberCount,
      coverImage: c.coverImage,
      isMember: c.members.some(
        (m) => m.user.toString() === currentUserId.toString(),
      ),
    }));

    res.json({
      success: true,
      data: {
        communities: result,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        searchMeta: { query: q.trim() },
      },
    });
  } catch (error) {
    console.error("Search communities error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to search communities" });
  }
};

// ============================================
// 5. UNIFIED SEARCH (all types at once)
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

    const Community = require("../models/Community");
    const userProfile = await Profile.findOne({ user: req.user._id })
      .select("campus")
      .lean();

    const [userResults, postResults, eventResults, communityResults] =
      await Promise.allSettled([
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
            user: { _id: profile.user?._id, name: profile.fullName },
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
        // Communities
        (async () => {
          const searchRegex = new RegExp(q.trim(), "i");
          const communities = await Community.find({
            university: userProfile?.campus,
            isActive: true,
            name: { $regex: searchRegex },
          })
            .sort({ memberCount: -1 })
            .limit(parseInt(limit))
            .select("name memberCount coverImage")
            .lean();
          return communities.map((c) => ({
            _id: c._id,
            name: c.name,
            memberCount: c.memberCount,
            coverImage: c.coverImage,
            type: "community",
          }));
        })(),
      ]);

    res.status(200).json({
      success: true,
      data: {
        users: userResults.status === "fulfilled" ? userResults.value : [],
        posts: postResults.status === "fulfilled" ? postResults.value : [],
        events: eventResults.status === "fulfilled" ? eventResults.value : [],
        communities:
          communityResults.status === "fulfilled" ? communityResults.value : [],
      },
      searchMeta: { query: q.trim() },
    });
  } catch (error) {
    console.error("Unified search error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to perform search" });
  }
};
