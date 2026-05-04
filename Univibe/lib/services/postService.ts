// lib/services/postService.ts
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";

// Default avatar constant
export const DEFAULT_AVATAR = "default-avatar";

// ============================================
// INTERFACES
// ============================================

export interface Post {
  _id: string;
  user: {
    _id: string | null;
    name: string;
    username: string;
    email: string | null;
    verified: boolean;
    profilePicture: string | null;
  };
  originalUser?: {
    _id: string;
    name: string;
    username: string;
  };
  content: string;
  images: Array<{
    filename: string;
    url: string;
    path?: string;
    mimetype: string;
    size: number;
  }>;
  tags: string[];
  campus: string;
  visibility: "campus" | "connections";
  isAnonymous: boolean;
  isEdited: boolean;
  editedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isLiked: boolean;
  isOwner?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;

  // Counts (denormalized)
  likeCount: number;
  commentCount: number;

  // Only populated in single post view
  likes?: Array<{
    _id: string;
    name: string;
    username: string;
  }>;
  comments?: any[];
  reposts?: any[];
  mentions?: any[];
  recentComments?: Comment[];

  // Legacy fields
  isPinned?: boolean;
  isReposted?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  __v?: number;
}

export interface Comment {
  _id: string;
  post: string;
  user: {
    _id: string;
    name: string;
    username: string;
    email?: string;
    profilePicture?: string | null;
  };
  content: string;
  parentComment: string | null;
  rootComment?: string | null;
  replies: Comment[] | string[];
  likes: Array<string | { _id: string; name?: string; username?: string }>;
  isEdited: boolean;
  editedAt?: string;
  isFromAnonymousPost: boolean;
  isAnonymous: boolean;
  depth: number;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  isLiked?: boolean;
  likeCount?: number;
  replyCount?: number;
}

export interface LikeResponse {
  success: boolean;
  likes: number;
  isLiked: boolean;
}

export interface DeletePostResponse {
  success: boolean;
  message: string;
  post?: {
    _id: string;
    isDeleted: boolean;
    deletedAt?: string;
  };
}

export interface RestorePostResponse {
  success: boolean;
  message: string;
  post?: Post;
}

export interface CommentsResponse {
  success: boolean;
  comments: Comment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  totalComments: number;
}

export interface CommentThreadResponse {
  success: boolean;
  thread: Comment;
}

export interface ProfilePostsResponse {
  success: boolean;
  data?: {
    posts: Post[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    viewerStatus: {
      isOwnProfile: boolean;
      isConnected: boolean;
    };
  };
  message?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    return token || null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

const buildApiUrl = (endpoint: string): string => {
  let baseUrl = API_BASE_URL;
  if (!baseUrl.endsWith("/")) {
    baseUrl += "/";
  }
  let cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  if (!baseUrl.includes("/api/") && !cleanEndpoint.startsWith("api/")) {
    cleanEndpoint = `api/${cleanEndpoint}`;
  }
  return `${baseUrl}${cleanEndpoint}`;
};

const getFileExtension = (uri: string): string => {
  const filename = uri.split("/").pop() || "";
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext || "jpg";
};

const getMimeTypeFromExtension = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return mimeTypes[extension] || "image/jpeg";
};

export const getFullImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const baseUrl = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${baseUrl}${cleanUrl}`;
};

// ============================================
// POST CRUD OPERATIONS
// ============================================

export const createPost = async (
  content: string,
  images: any[] = [],
  visibility: string = "campus",
  isAnonymous: boolean = false,
): Promise<{ success: boolean; message: string; post: Post }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl("posts");

    const formData = new FormData();
    formData.append("content", content.trim());
    formData.append("visibility", visibility);
    formData.append("isAnonymous", isAnonymous.toString());

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const uri = image.uri;
        const ext = getFileExtension(uri);
        const mimeType = getMimeTypeFromExtension(ext);
        const filename =
          uri.split("/").pop() || `post_${Date.now()}_${i}.${ext}`;

        formData.append("images", {
          uri: uri,
          name: filename,
          type: mimeType,
        } as any);
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errorData = await response.json();
        errorDetail = errorData.message || errorData.error || "Unknown error";
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(
        `Failed to create post: ${response.status} - ${errorDetail}`,
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error creating post:", error.message || error);
    throw error;
  }
};

export const getPostById = async (
  postId: string,
): Promise<{ success: boolean; post: Post }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching post:", error);
    throw error;
  }
};

export const updatePost = async (
  postId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string; post: Post }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}`);

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update post");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating post:", error);
    throw error;
  }
};

export const deletePost = async (
  postId: string,
): Promise<DeletePostResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete post: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting post:", error);
    throw error;
  }
};

export const restorePost = async (
  postId: string,
): Promise<RestorePostResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/restore`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Failed to restore post: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("Error restoring post:", error);
    throw error;
  }
};

export const permanentlyDeletePost = async (
  postId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/permanent`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to permanently delete post: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error permanently deleting post:", error);
    throw error;
  }
};

// ============================================
// POST INTERACTIONS
// ============================================

export const toggleLike = async (postId: string): Promise<LikeResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/like`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to toggle like: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error toggling like:", error);
    throw error;
  }
};

// ============================================
// PROFILE POSTS
// ============================================

export const getProfilePosts = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
): Promise<ProfilePostsResponse> => {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { success: false, message: "No authentication token" };
    }

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const url = `${buildApiUrl(`posts/user/${userId}`)}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error fetching profile posts:", error);
    return { success: false, message: "Failed to fetch posts" };
  }
};

export const searchPosts = async (
  query: string,
  page: number = 1,
  limit: number = 10,
): Promise<{ success: boolean; posts: Post[] }> => {
  try {
    const token = await getAuthToken();

    const params = new URLSearchParams({
      q: query,
      page: page.toString(),
      limit: limit.toString(),
    });

    const url = `${buildApiUrl("posts/search")}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search posts: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error searching posts:", error);
    throw error;
  }
};

// ============================================
// COMMENT OPERATIONS
// ============================================

export const getPostComments = async (
  postId: string,
  page: number = 1,
  limit: number = 20,
): Promise<CommentsResponse> => {
  try {
    const token = await getAuthToken();

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const url = `${buildApiUrl(`posts/${postId}/comments`)}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch comments");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
};

export const addComment = async (
  postId: string,
  content: string,
  isAnonymous: boolean = false,
): Promise<{ success: boolean; comment: Comment }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, isAnonymous }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add comment");
    }

    return await response.json();
  } catch (error) {
    console.error("Error adding comment:", error);
    throw error;
  }
};

export const addReply = async (
  postId: string,
  commentId: string,
  content: string,
  isAnonymous: boolean = false,
): Promise<{ success: boolean; reply: Comment }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}/replies`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, isAnonymous }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add reply");
    }

    return await response.json();
  } catch (error) {
    console.error("Error adding reply:", error);
    throw error;
  }
};

export const getCommentThread = async (
  postId: string,
  commentId: string,
): Promise<CommentThreadResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch comment thread");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching comment thread:", error);
    throw error;
  }
};

export const toggleCommentLike = async (
  postId: string,
  commentId: string,
): Promise<LikeResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}/like`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to toggle comment like");
    }

    return await response.json();
  } catch (error) {
    console.error("Error toggling comment like:", error);
    throw error;
  }
};

export const updateComment = async (
  postId: string,
  commentId: string,
  content: string,
): Promise<{ success: boolean; comment: Comment }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}`);

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update comment");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating comment:", error);
    throw error;
  }
};

export const deleteComment = async (
  postId: string,
  commentId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete comment");
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
};

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if replies are populated (objects) or just IDs (strings)
 */
export function areRepliesPopulated(replies: string[] | Comment[]): boolean {
  if (!Array.isArray(replies) || replies.length === 0) return false;
  return typeof replies[0] !== "string";
}

/**
 * Get populated replies from a comment
 */
export function getPopulatedReplies(comment: Comment): Comment[] {
  if (Array.isArray(comment.replies) && comment.replies.length > 0) {
    const firstReply = comment.replies[0];
    if (typeof firstReply !== "string") {
      return comment.replies as Comment[];
    }
  }
  return [];
}

/**
 * Check if a comment has replies
 */
export function hasReplies(comment: Comment): boolean {
  return Array.isArray(comment.replies) && comment.replies.length > 0;
}

/**
 * Get reply count for a comment
 */
export function getReplyCount(comment: Comment): number {
  if (Array.isArray(comment.replies)) {
    return comment.replies.length;
  }
  return 0;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const formatUserDisplay = (
  post: Post,
): { name: string; username: string } => {
  if (post.isAnonymous) {
    return { name: "Anonymous", username: "anonymous" };
  }
  return {
    name: post.user?.name || "User",
    username: post.user?.username ? `@${post.user.username}` : "@user",
  };
};

export const getVisibilityLabel = (visibility: string): string => {
  switch (visibility) {
    case "campus":
      return "Campus";
    case "connections":
      return "Connections";
    default:
      return visibility;
  }
};

export const formatCommentUserDisplay = (
  comment: Comment,
  isPostAnonymous: boolean = false,
): { name: string; username: string; profilePicture: string | null } => {
  if (isPostAnonymous && comment.isFromAnonymousPost) {
    return { name: "Anonymous", username: "anonymous", profilePicture: null };
  }
  if (comment.isAnonymous) {
    return { name: "Anonymous", username: "anonymous", profilePicture: null };
  }
  return {
    name: comment.user?.name || "User",
    username: comment.user?.username || "user",
    profilePicture: comment.user?.profilePicture || null,
  };
};

export const formatCommentTimestamp = (createdAt: string): string => {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

export const isCommentFromPostAuthor = (
  comment: Comment,
  postUserId: string,
): boolean => {
  if (comment.isAnonymous) return false;
  if (comment.isFromAnonymousPost) return true;
  return comment.user?._id === postUserId;
};

export const getCommentDepthColor = (depth: number): string => {
  const colors = ["#666666", "#4CAF50", "#2196F3", "#FF9800", "#F44336"];
  return colors[Math.min(depth - 1, colors.length - 1)];
};

export const getVisibilityIcon = (visibility: string): string => {
  switch (visibility) {
    case "campus":
      return "school-outline";
    case "connections":
      return "people-outline";
    default:
      return "globe-outline";
  }
};
