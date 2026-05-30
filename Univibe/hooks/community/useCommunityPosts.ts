// app/hooks/community/useCommunityPosts.ts

import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { communityService } from "../../lib/services/communityService";
import { toggleLike, deletePost, Post } from "../../lib/services/postService";

/**
 * Hook for managing community posts - fetching, liking, and deleting
 * Re-fetches posts when communityId or membership status changes
 */
export function useCommunityPosts(
  communityId: string | undefined,
  isMember?: boolean,
) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const prevIsMember = useRef<boolean | undefined>(undefined);

  /**
   * Fetch posts from the community feed
   */
  const loadPosts = useCallback(async () => {
    if (!communityId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await communityService.getCommunityFeed(
        communityId,
        1,
        20,
      );
      if (result.success) {
        setPosts(result.data || []);
      } else {
        setPosts([]);
      }
    } catch (error) {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [communityId, isMember]);

  /**
   * Toggle like on a post with optimistic UI update
   */
  const likePost = useCallback(async (postId: string) => {
    try {
      const response = await toggleLike(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, isLiked: response.isLiked, likeCount: response.likes }
            : p,
        ),
      );
    } catch (error) {
      // Silently fail - UI will correct on next fetch
    }
  }, []);

  /**
   * Remove a post with confirmation dialog
   */
  const removePost = useCallback(async (postId: string) => {
    return new Promise<boolean>((resolve) => {
      Alert.alert("Delete Post", "Remove this post?", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePost(postId);
              setPosts((prev) => prev.filter((p) => p._id !== postId));
              resolve(true);
            } catch (error: any) {
              Alert.alert("Error", error.message);
              resolve(false);
            }
          },
        },
      ]);
    });
  }, []);

  // Fetch posts on mount and when communityId or membership changes
  useEffect(() => {
    prevIsMember.current = isMember;
    loadPosts();
  }, [loadPosts, communityId, isMember]);

  return {
    posts,
    loading,
    loadPosts,
    likePost,
    removePost,
  };
}
