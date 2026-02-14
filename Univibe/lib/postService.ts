// lib/postService.ts - UPDATED
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/stringConstants'; 

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
  visibility: string; // Updated: "campus", "connections", "following", "private"
  isPinned: boolean;
  isEdited: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  isLiked?: boolean;
  isReposted?: boolean;
  isAnonymous?: boolean;
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
const getAuthToken = async (): Promise<string> => {
  try {
    const token = await SecureStore.getItemAsync('authToken');
    
    if (!token) {
      throw new Error('No authentication token found. Please login again.');
    }
    
    return token;
  } catch (error) {
    throw new Error('Authentication error. Please login again.');
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

// Get all posts
export const getPosts = async (
  filter: string = 'all',
  page: number = 1,
  limit: number = 10,
): Promise<PostsResponse> => { // Removed category parameter
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
): Promise<{success: boolean; likes: number; isLiked: boolean}> => {
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

// Create a new post - UPDATED (removed category parameter)
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
    
    // Append text fields
    formData.append('content', content.trim());
    formData.append('visibility', visibility);
    formData.append('isAnonymous', isAnonymous.toString());
    
    // Add images if any
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const uri = image.uri;
        
        // Get correct file extension and mime type
        const ext = getFileExtension(uri);
        const mimeType = getMimeType(ext);
        
        // Extract filename from URI or generate one
        const filename = uri.split('/').pop() || `post_${Date.now()}_${i}.${ext}`;
        
        // Create file object
        const fileObject = {
          uri: uri,
          name: filename,
          type: mimeType,
        };
        
        // Append to form data
        formData.append('images', fileObject as any);
      }
    }
    
    // Debug: Log the actual request details
    console.log('Creating post with:', {
      contentLength: content.length,
      imageCount: images.length,
      visibility,
      isAnonymous,
      url,
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = errorData.message || errorData.error || 'Unknown error';
        console.error('Backend error details:', errorData);
      } catch {
        errorDetail = await response.text();
      }
      
      throw new Error(`Failed to create post: ${response.status} - ${errorDetail}`);
    }
    
    const result = await response.json();
    console.log('Post created successfully', {
      isAnonymous: result.post?.isAnonymous,
      visibility: result.post?.visibility,
    });
    return result;
  } catch (error: any) {
    console.error('Error creating post:', error.message || error);
    throw error;
  }
};

// TEST: Create post without image first - UPDATED (removed category parameter)
export const testCreatePost = async (isAnonymous: boolean = false): Promise<{success: boolean; message: string; post: Post}> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl('posts');
    
    console.log('Testing post creation without image...', { isAnonymous });
    
    const testData = {
      content: `Test post from mobile app - no image ${isAnonymous ? '(Anonymous)' : ''}`,
      visibility: 'campus',
      isAnonymous: isAnonymous,
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    console.log('Test response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Test error:', errorText);
      throw new Error(`Test failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Test successful:', {
      success: result.success,
      isAnonymous: result.post?.isAnonymous,
      visibility: result.post?.visibility,
    });
    return result;
  } catch (error: any) {
    console.error('Test error:', error.message || error);
    throw error;
  }
};

// Add comment to post
export const addComment = async (
  postId: string,
  content: string,
): Promise<{success: boolean; comment: any}> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`posts/${postId}/comments`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add comment: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding comment:', error);
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

// NEW: Get anonymous posts for moderation (admin only)
export const getAnonymousPostsForModeration = async (
  page: number = 1,
  limit: number = 50
): Promise<{success: boolean; posts: Post[]; total: number}> => {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    const url = `${buildApiUrl('posts/admin/anonymous-posts')}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Not authorized to view anonymous posts');
      }
      throw new Error(`Failed to fetch anonymous posts: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching anonymous posts:', error);
    throw error;
  }
};

// NEW: Helper to format user display for anonymous posts
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

// NEW: Helper to get visibility label
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

// NEW: Helper to get visibility icon
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