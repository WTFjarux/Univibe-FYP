// lib/postService.ts - UPDATED VERSION WITHOUT DICEBEAR
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/ipConstants'; 

// Default avatar constant (will be provided by the component)
export const DEFAULT_AVATAR = "default-avatar";

export interface Post {
  _id: string;
  user: {
    _id: string;
    name: string;
    username: string;
    profilePicture: string;
    verified: boolean;
    email?: string;
  };
  originalUser?: {  // Add this for anonymous posts
    _id: string;
    name: string;
    username: string;
  };
  content: string;
  images: Array<{
    filename: string;
    url: string;
    path: string;
    mimetype: string;
    size: number;
  }>;
  likes: any[];
  comments: any[];
  reposts: any[];
  tags: string[];
  mentions: any[];
  campus: string;
  visibility: string;
  isPinned: boolean;
  isEdited: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  isLiked?: boolean;
  isReposted?: boolean;
  isAnonymous?: boolean;
  commentCount?: number;
  recentComments?: Comment[];
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
  likes: string[];
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

export interface LikeResponse {
  success: boolean;
  likes: number;
  isLiked: boolean;
}

export interface ReplyCountResponse {
  success: boolean;
  replyCount: number;
}

export interface CommentLikesResponse {
  success: boolean;
  likeCount: number;
  likes: Array<{
    _id: string;
    name: string;
    username: string;
    profilePicture?: string;
  }>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PostsResponse {
  success: boolean;
  posts: Post[];
  pagination: Pagination;
  currentCampus?: string;
}

// Get auth token
export const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync('authToken');
    return token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Helper to build API URL
const buildApiUrl = (endpoint: string): string => {
  let baseUrl = API_BASE_URL;
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }
  
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  if (!baseUrl.includes('/api/') && !cleanEndpoint.startsWith('api/')) {
    cleanEndpoint = `api/${cleanEndpoint}`;
  }
  
  return `${baseUrl}${cleanEndpoint}`;
};

// Get file extension from URI
const getFileExtension = (uri: string): string => {
  const filename = uri.split('/').pop() || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext || 'jpg';
};

// Get mime type from extension
const getMimeType = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
  };
  return mimeTypes[extension] || 'image/jpeg';
};

// ============ POST FUNCTIONS ============

// Get all posts
export const getPosts = async (
  filter: string = 'all',
  page: number = 1,
  limit: number = 10,
): Promise<PostsResponse> => {
  try {
    const token = await getAuthToken();
    
    const params = new URLSearchParams({
      filter,
      page: page.toString(),
      limit: limit.toString(),
    });
    
    const url = `${buildApiUrl('posts')}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        await SecureStore.deleteItemAsync('authToken');
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};

// Like/unlike a post
export const toggleLike = async (
  postId: string
): Promise<LikeResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/like`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to toggle like: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

// Create a new post
export const createPost = async (
  content: string,
  images: any[] = [],
  visibility: string = 'campus',
  isAnonymous: boolean = false
): Promise<{success: boolean; message: string; post: Post}> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl('posts');
    
    const formData = new FormData();
    
    formData.append('content', content.trim());
    formData.append('visibility', visibility);
    formData.append('isAnonymous', isAnonymous.toString());
    
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const uri = image.uri;
        
        const ext = getFileExtension(uri);
        const mimeType = getMimeType(ext);
        const filename = uri.split('/').pop() || `post_${Date.now()}_${i}.${ext}`;
        
        const fileObject = {
          uri: uri,
          name: filename,
          type: mimeType,
        };
        
        formData.append('images', fileObject as any);
      }
    }
    
    console.log('Creating post with:', {
      contentLength: content.length,
      imageCount: images.length,
      visibility,
      isAnonymous,
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = errorData.message || errorData.error || 'Unknown error';
      } catch {
        errorDetail = await response.text();
      }
      
      throw new Error(`Failed to create post: ${response.status} - ${errorDetail}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error creating post:', error.message || error);
    throw error;
  }
};

// Get single post by ID
export const getPostById = async (
  postId: string
): Promise<{success: boolean; post: Post}> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};

// Delete a post
export const deletePost = async (
  postId: string
): Promise<{success: boolean; message: string}> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}`);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete post: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

/**
 * Update a post
 */
export const updatePost = async (
  postId: string,
  formData: FormData
): Promise<{success: boolean; message: string; post: Post}> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}`);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update post');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

// Search posts
export const searchPosts = async (
  query: string,
  page: number = 1,
  limit: number = 10
): Promise<PostsResponse> => {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({
      q: query,
      page: page.toString(),
      limit: limit.toString(),
    });
    
    const url = `${buildApiUrl('posts/search')}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search posts: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching posts:', error);
    throw error;
  }
};

// ============ COMMENT FUNCTIONS ============

// Get all comments for a post
export const getPostComments = async (
  postId: string,
  page: number = 1,
  limit: number = 20
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
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch comments');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

// Add a comment to a post (with anonymous option)
export const addComment = async (
  postId: string,
  content: string,
  isAnonymous: boolean = false
): Promise<{ success: boolean; comment: Comment }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        content,
        isAnonymous
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add comment');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

// Add a reply to a comment (with anonymous option)
export const addReply = async (
  postId: string,
  commentId: string,
  content: string,
  isAnonymous: boolean = false
): Promise<{ success: boolean; reply: Comment }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}/replies`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        content,
        isAnonymous
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add reply');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding reply:', error);
    throw error;
  }
};

// Get a specific comment thread
export const getCommentThread = async (
  postId: string,
  commentId: string
): Promise<CommentThreadResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch comment thread');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching comment thread:', error);
    throw error;
  }
};

// Like/unlike a comment
export const toggleCommentLike = async (
  postId: string,
  commentId: string
): Promise<LikeResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}/like`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to toggle comment like');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error toggling comment like:', error);
    throw error;
  }
};

// Update a comment
export const updateComment = async (
  postId: string,
  commentId: string,
  content: string
): Promise<{ success: boolean; comment: Comment }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}`);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update comment');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

// Delete a comment
export const deleteComment = async (
  postId: string,
  commentId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}`);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete comment');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// ============ COMMENT UTILITY FUNCTIONS ============

// Get reply count for a comment
export const getCommentReplyCount = async (
  postId: string,
  commentId: string
): Promise<ReplyCountResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}/reply-count`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch reply count');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching reply count:', error);
    throw error;
  }
};

// Get likes for a comment with user details
export const getCommentLikes = async (
  postId: string,
  commentId: string
): Promise<CommentLikesResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments/${commentId}/likes`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch comment likes');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching comment likes:', error);
    throw error;
  }
};

// ============ HELPER FUNCTIONS ============

// Get full image URL
export const getFullImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  const baseUrl = API_BASE_URL.endsWith('/') 
    ? API_BASE_URL.slice(0, -1) 
    : API_BASE_URL;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanUrl}`;
};

// Format user display for anonymous posts
export const formatUserDisplay = (post: Post): { name: string; username: string } => {
  if (post.isAnonymous) {
    return {
      name: 'Anonymous',
      username: 'anonymous',
    };
  }
  return {
    name: post.user?.name || 'User',
    username: post.user?.username ? `@${post.user.username}` : '@user',
  };
};

// Format comment user display (handles both post-level and comment-level anonymity)
export const formatCommentUserDisplay = (
  comment: Comment,
  isPostAnonymous: boolean = false
): { name: string; username: string; profilePicture: string | null } => {
  // Case 1: Post is anonymous AND this is the post author's comment
  if (isPostAnonymous && comment.isFromAnonymousPost) {
    return {
      name: 'Anonymous',
      username: 'anonymous',
      profilePicture: null,
    };
  }
  
  // Case 2: User chose to comment anonymously
  if (comment.isAnonymous) {
    return {
      name: 'Anonymous',
      username: 'anonymous',
      profilePicture: null,
    };
  }
  
  // Case 3: Regular comment
  return {
    name: comment.user?.name || 'User',
    username: comment.user?.username || 'user',
    profilePicture: comment.user?.profilePicture || null,
  };
};

// Get visibility label
export const getVisibilityLabel = (visibility: string): string => {
  switch (visibility) {
    case 'campus':
      return 'Campus';
    case 'connections':
      return 'Connections';
    case 'following':
      return 'Following';
    case 'private':
      return 'Only Me';
    default:
      return visibility;
  }
};

// Get visibility icon
export const getVisibilityIcon = (visibility: string): string => {
  switch (visibility) {
    case 'campus':
      return 'school-outline';
    case 'connections':
      return 'people-outline';
    case 'following':
      return 'eye-outline';
    case 'private':
      return 'lock-closed-outline';
    default:
      return 'globe-outline';
  }
};

// Format comment content with reply indicator
export const formatCommentContent = (
  content: string,
  depth: number
): string => {
  if (depth === 1) return content;
  
  const indent = '  '.repeat(depth - 1);
  return `${indent}↳ ${content}`;
};

// Get comment depth color (for UI accent)
export const getCommentDepthColor = (depth: number): string => {
  const colors = [
    '#666666', // depth 1
    '#4CAF50', // depth 2
    '#2196F3', // depth 3
    '#FF9800', // depth 4
    '#F44336', // depth 5
  ];
  return colors[Math.min(depth - 1, colors.length - 1)];
};

// Check if comment is from post author (handles anonymous and edge cases)
export const isCommentFromPostAuthor = (
  comment: Comment,
  postUserId: string
): boolean => {
  // If comment is anonymous, it's not from the author (even if it technically is)
  if (comment.isAnonymous) return false;
  
  // If post is anonymous and this is the post author's comment, it's anonymous
  // but we still might want to know for internal logic
  if (comment.isFromAnonymousPost) return true;
  
  // Regular case: check if user IDs match
  return comment.user?._id === postUserId;
};

// Format comment timestamp
export const formatCommentTimestamp = (createdAt: string): string => {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

// ============ TYPE GUARDS ============

// Type guard to check if replies are populated
export function areRepliesPopulated(replies: string[] | Comment[]): replies is Comment[] {
  return replies.length > 0 && typeof replies[0] !== 'string';
}

// Helper to safely get populated replies
export function getPopulatedReplies(comment: Comment): Comment[] {
  if (Array.isArray(comment.replies) && comment.replies.length > 0) {
    const firstReply = comment.replies[0];
    if (typeof firstReply !== 'string') {
      return comment.replies as Comment[];
    }
  }
  return [];
}

// Helper to check if comment has replies
export function hasReplies(comment: Comment): boolean {
  return Array.isArray(comment.replies) && comment.replies.length > 0;
}

// Helper to get reply count safely
export function getReplyCount(comment: Comment): number {
  if (Array.isArray(comment.replies)) {
    return comment.replies.length;
  }
  return 0;
}