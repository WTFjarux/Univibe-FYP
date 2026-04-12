// API Service
export { default as api } from './api';

// Socket Service
export { default as socketService } from './socketService';

// Feature Services
export { profileService } from './profileService';

// Post Service (exports individual functions)
export {
  getPosts,
  getFeed,
  createPost,
  getPostById,
  updatePost,
  deletePost,
  restorePost,
  permanentlyDeletePost,
  toggleLike,
  repostPost,
  searchPosts,
  getProfilePosts,
  getPostComments,
  addComment,
  addReply,
  getCommentThread,
  toggleCommentLike,
  updateComment,
  deleteComment,
  clearPostCache,
  invalidatePostCache,
  getFullImageUrl,
  formatUserDisplay,
  formatCommentUserDisplay,
  formatCommentTimestamp,
  getVisibilityLabel,
  getVisibilityIcon,
  isCommentFromPostAuthor,
  getCommentDepthColor,
  formatCommentContent,
  areRepliesPopulated,
  getPopulatedReplies,
  hasReplies,
  getReplyCount,
  DEFAULT_AVATAR
} from './postService';

export { eventService } from './eventService';
export { connectionService } from './connectionService';
export { notificationService } from './notificationService';
export { batchService } from './batchService';