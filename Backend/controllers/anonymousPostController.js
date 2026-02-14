// // Backend/controllers/anonymousPostController.js
// // Handles ANONYMOUS posts only

// const Post = require("../models/Post");
// const Profile = require("../models/Profile");
// const {
//   getPostImageRelativePath,
//   deletePostImages,
// } = require("../middleware/uploadPostMiddleware");

// // ===================== HELPER FUNCTIONS =====================

// // Check daily anonymous post limit
// async function checkDailyAnonymousLimit(userId) {
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);

//   const anonymousPostsToday = await Post.countDocuments({
//     user: userId,
//     isAnonymous: true,
//     createdAt: { $gte: today },
//   });

//   const MAX_DAILY_ANONYMOUS = 5;

//   return {
//     canPost: anonymousPostsToday < MAX_DAILY_ANONYMOUS,
//     used: anonymousPostsToday,
//     remaining: MAX_DAILY_ANONYMOUS - anonymousPostsToday,
//     limit: MAX_DAILY_ANONYMOUS,
//   };
// }

// // Sanitize content for anonymous posts (remove personal info)
// function sanitizeAnonymousContent(content) {
//   if (!content) return content;

//   let sanitized = content;

//   // Remove email addresses
//   sanitized = sanitized.replace(
//     /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
//     "[email redacted]",
//   );

//   // Remove phone numbers
//   sanitized = sanitized.replace(
//     /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
//     "[phone redacted]",
//   );

//   // Remove @mentions (convert to generic)
//   sanitized = sanitized.replace(/@(\w+)/g, "@user");

//   return sanitized;
// }

// // Transform anonymous post to hide author info
// function transformAnonymousPost(post, currentUserId) {
//   const isOwnPost = post.user?._id?.toString() === currentUserId.toString();

//   if (isOwnPost) {
//     // User sees their own anonymous post (marked as anonymous)
//     post.user.isAnonymous = true;
//     post.user.displayName = "You (Anonymous)";
//     post.isOwnPost = true;
//   } else {
//     // Others see anonymous identity
//     post.user = {
//       _id: null,
//       name: "Anonymous",
//       username: "anonymous",
//       profilePicture:
//         "https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous",
//       isAnonymous: true,
//       campus: post.anonymousUserData?.campus || post.campus,
//     };
//     post.isOwnPost = false;
//   }

//   return post;
// }

// // ===================== ANONYMOUS POST CONTROLLERS =====================

// /**
//  * Create a new ANONYMOUS post
//  */
// exports.createAnonymousPost = async (req, res) => {
//   try {
//     const { content, tags, visibility, category } = req.body;
//     const userId = req.user._id;

//     // Check daily limit
//     const limitInfo = await checkDailyAnonymousLimit(userId);
//     if (!limitInfo.canPost) {
//       return res.status(429).json({
//         success: false,
//         error: `Daily anonymous post limit reached (${limitInfo.limit} posts)`,
//         limitInfo,
//       });
//     }

//     // Get user's profile
//     const profile = await Profile.findOne({ user: userId });
//     if (!profile) {
//       return res.status(404).json({
//         success: false,
//         error: "Profile not found",
//       });
//     }

//     // Sanitize content (remove personal info)
//     const sanitizedContent = sanitizeAnonymousContent(content);

//     // Extract hashtags from sanitized content
//     const hashtagRegex = /#(\w+)/g;
//     const extractedTags = (sanitizedContent.match(hashtagRegex) || []).map(
//       (tag) => tag.substring(1).toLowerCase(),
//     );

//     const allTags = [...new Set([...(tags || []), ...extractedTags])];

//     // Process uploaded images
//     const images = [];
//     if (req.files && req.files.length > 0) {
//       // Process each uploaded file
//       for (const file of req.files) {
//         const relativePath = await getPostImageRelativePath(req, file.filename);
//         if (relativePath) {
//           images.push({
//             filename: file.filename,
//             url: relativePath,
//             path: file.path,
//             mimetype: file.mimetype,
//             size: file.size,
//           });
//         }
//       }
//     }

//     // Create new ANONYMOUS post
//     const campus = profile.campus || "Unknown Campus";
//     const post = new Post({
//       user: userId,
//       content: sanitizedContent,
//       images,
//       tags: allTags,
//       campus,
//       visibility: visibility || "campus",
//       category: category || "general",
//       isAnonymous: true, // This is an anonymous post
//     });

//     await post.save();

//     // Get populated post
//     const populatedPost = await Post.findById(post._id)
//       .populate("user", "name username email verified")
//       .lean();

//     // Transform for anonymity (user sees their own post as anonymous)
//     transformAnonymousPost(populatedPost, userId);

//     res.status(201).json({
//       success: true,
//       message: "Anonymous post created successfully",
//       post: populatedPost,
//       limitInfo,
//     });
//   } catch (error) {
//     console.error("Error creating anonymous post:", error);

//     // Cleanup uploaded images on error
//     if (req.files && req.files.length > 0) {
//       const userId = req.user._id;
//       const filenames = req.files.map((file) => file.filename);
//       await deletePostImages(userId, filenames);
//     }

//     res.status(500).json({
//       success: false,
//       error: "Failed to create anonymous post",
//       details:
//         process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

// /**
//  * Get all ANONYMOUS posts only
//  */
// exports.getAnonymousPosts = async (req, res) => {
//   try {
//     const { filter = "all", category, page = 1, limit = 20 } = req.query;

//     const skip = (page - 1) * limit;
//     const currentUserId = req.user._id;

//     // Get current user's campus
//     const currentUserProfile = await Profile.findOne({ user: currentUserId });
//     const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

//     // Build query for ANONYMOUS posts only
//     let query = { isAnonymous: true };

//     switch (filter) {
//       case "campus":
//         query.campus = currentUserCampus;
//         break;
//       case "trending":
//         query.createdAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
//         break;
//     }

//     // Apply visibility filter
//     query.$or = [
//       { visibility: "public" },
//       { visibility: "campus", campus: currentUserCampus },
//       { user: currentUserId }, // Users can see their own anonymous posts
//     ];

//     if (category) query.category = category;

//     // Fetch anonymous posts
//     const posts = await Post.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit))
//       .populate("user", "name username")
//       .lean();

//     // Transform posts for anonymity
//     const transformedPosts = posts.map((post) =>
//       transformAnonymousPost(post, currentUserId),
//     );

//     // Get total count
//     const total = await Post.countDocuments(query);

//     res.json({
//       success: true,
//       posts: transformedPosts,
//       feedType: "anonymous",
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching anonymous posts:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch anonymous posts",
//     });
//   }
// };

// /**
//  * Get single ANONYMOUS post by ID
//  */
// exports.getAnonymousPostById = async (req, res) => {
//   try {
//     const postId = req.params.id;
//     const currentUserId = req.user._id;

//     // Fetch post
//     const post = await Post.findById(postId)
//       .populate("user", "name username")
//       .populate("comments.user", "name username")
//       .lean();

//     if (!post) {
//       return res.status(404).json({
//         success: false,
//         error: "Post not found",
//       });
//     }

//     // Check if post is anonymous
//     if (!post.isAnonymous) {
//       return res.status(400).json({
//         success: false,
//         error: "This is not an anonymous post",
//       });
//     }

//     // Transform post for anonymity
//     transformAnonymousPost(post, currentUserId);

//     // Transform comments for anonymity
//     post.comments.forEach((comment) => {
//       if (comment.isAnonymous) {
//         comment.user = {
//           _id: null,
//           name: "Anonymous",
//           username: "anonymous",
//           profilePicture:
//             "https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous-comment",
//           isAnonymous: true,
//         };
//       }
//     });

//     res.json({
//       success: true,
//       post,
//     });
//   } catch (error) {
//     console.error("Error fetching anonymous post:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch anonymous post",
//     });
//   }
// };

// /**
//  * Like or unlike an ANONYMOUS post
//  */
// exports.toggleAnonymousLike = async (req, res) => {
//   try {
//     const post = await Post.findById(req.params.id);
//     if (!post) {
//       return res.status(404).json({
//         success: false,
//         error: "Post not found",
//       });
//     }

//     // Check if post is anonymous
//     if (!post.isAnonymous) {
//       return res.status(400).json({
//         success: false,
//         error: "This is not an anonymous post",
//       });
//     }

//     const likeIndex = post.likes.findIndex(
//       (like) => like.toString() === req.user._id.toString(),
//     );

//     if (likeIndex === -1) {
//       post.likes.push(req.user._id);
//     } else {
//       post.likes.splice(likeIndex, 1);
//     }

//     await post.save();

//     res.json({
//       success: true,
//       likes: post.likes.length,
//       isLiked: likeIndex === -1,
//       note: "You liked an anonymous post",
//     });
//   } catch (error) {
//     console.error("Error toggling anonymous like:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to toggle like on anonymous post",
//     });
//   }
// };

// /**
//  * Add ANONYMOUS comment to anonymous post
//  */
// exports.addAnonymousComment = async (req, res) => {
//   try {
//     const { content, isAnonymous = true } = req.body; // Default to anonymous
//     const postId = req.params.id;
//     const userId = req.user._id;

//     const post = await Post.findById(postId);
//     if (!post) {
//       return res.status(404).json({
//         success: false,
//         error: "Post not found",
//       });
//     }

//     // Check if post is anonymous
//     if (!post.isAnonymous) {
//       return res.status(400).json({
//         success: false,
//         error: "Cannot add anonymous comment to regular post",
//       });
//     }

//     // Sanitize comment if anonymous
//     let finalContent = content;
//     if (isAnonymous) {
//       finalContent = sanitizeAnonymousContent(content);
//     }

//     const comment = {
//       user: userId,
//       content: finalContent,
//       isAnonymous: isAnonymous, // Can be anonymous or not
//     };

//     post.comments.push(comment);
//     await post.save();

//     const lastComment = post.comments[post.comments.length - 1];
//     const populatedComment = await Post.populate(lastComment, {
//       path: "user",
//       select: "name username",
//     });

//     // Transform comment if anonymous
//     if (populatedComment.isAnonymous) {
//       populatedComment.user = {
//         _id: null,
//         name: "Anonymous",
//         username: "anonymous",
//         profilePicture:
//           "https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous-comment",
//         isAnonymous: true,
//       };
//     }

//     res.status(201).json({
//       success: true,
//       comment: populatedComment,
//       message: isAnonymous ? "Anonymous comment added" : "Comment added",
//     });
//   } catch (error) {
//     console.error("Error adding anonymous comment:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to add comment",
//     });
//   }
// };

// /**
//  * Delete an ANONYMOUS post (only by author)
//  */
// exports.deleteAnonymousPost = async (req, res) => {
//   try {
//     const post = await Post.findById(req.params.id);

//     if (!post) {
//       return res.status(404).json({
//         success: false,
//         error: "Post not found",
//       });
//     }

//     // Check if post is anonymous
//     if (!post.isAnonymous) {
//       return res.status(400).json({
//         success: false,
//         error: "This is not an anonymous post",
//       });
//     }

//     if (post.user.toString() !== req.user._id.toString()) {
//       return res.status(403).json({
//         success: false,
//         error: "Not authorized to delete this anonymous post",
//       });
//     }

//     if (post.images && post.images.length > 0) {
//       const filenames = post.images.map((img) => img.filename);
//       await deletePostImages(req.user._id, filenames);
//     }

//     await post.deleteOne();

//     res.json({
//       success: true,
//       message: "Anonymous post deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting anonymous post:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to delete anonymous post",
//     });
//   }
// };

// /**
//  * Get user's anonymous post statistics
//  */
// exports.getAnonymousStats = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     // Get anonymous stats from Post model
//     const stats = await Post.getUserAnonymousStats(userId);

//     // Get daily limit info
//     const limitInfo = await checkDailyAnonymousLimit(userId);

//     // Get total post count for percentage
//     const totalPosts = await Post.countDocuments({ user: userId });
//     const anonymousPercentage =
//       totalPosts > 0
//         ? Math.round((stats.totalAnonymousPosts / totalPosts) * 100)
//         : 0;

//     res.json({
//       success: true,
//       stats: {
//         ...stats,
//         totalPosts,
//         anonymousPercentage,
//         dailyLimit: limitInfo,
//       },
//     });
//   } catch (error) {
//     console.error("Error getting anonymous stats:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to get anonymous statistics",
//     });
//   }
// };

// /**
//  * Check anonymous post creation limits
//  */
// exports.checkAnonymousLimit = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const limitInfo = await checkDailyAnonymousLimit(userId);

//     res.json({
//       success: true,
//       ...limitInfo,
//     });
//   } catch (error) {
//     console.error("Error checking anonymous limit:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to check anonymous limits",
//     });
//   }
// };

// /**
//  * Get user's own anonymous posts
//  */
// exports.getMyAnonymousPosts = async (req, res) => {
//   try {
//     const { page = 1, limit = 20 } = req.query;
//     const skip = (page - 1) * limit;
//     const userId = req.user._id;

//     // Get user's anonymous posts
//     const posts = await Post.find({
//       user: userId,
//       isAnonymous: true,
//     })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit))
//       .populate("user", "name username")
//       .lean();

//     // Get user's profile
//     const profile = await Profile.findOne({ user: userId })
//       .select("profilePicture username")
//       .lean();

//     // Mark as anonymous but show it's the user's own post
//     posts.forEach((post) => {
//       post.user.profilePicture = profile?.profilePicture || null;
//       post.user.isAnonymous = true;
//       post.user.displayName = "You (Anonymous)";
//       post.user.username = profile?.username || "user";
//       post.isOwnPost = true;
//     });

//     // Get total count
//     const total = await Post.countDocuments({
//       user: userId,
//       isAnonymous: true,
//     });

//     res.json({
//       success: true,
//       posts,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching my anonymous posts:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch your anonymous posts",
//     });
//   }
// };
