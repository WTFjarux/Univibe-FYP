// lib/batchService.ts
import { API_BASE_URL } from "@/constants/ipConstants";
import * as SecureStore from "expo-secure-store";

// Direct token getter (no duplicate exports)
const getToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    return token || null;
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
};

export const batchService = {
  /**
   * Fetch all profile data in one batch request
   */
  getProfileBatch: async (userId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      // Make parallel requests for efficiency
      const [profile, posts, stats] = await Promise.all([
        fetch(`${API_BASE_URL}/api/profile/public/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch(`${API_BASE_URL}/api/profile/${userId}/posts?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch(`${API_BASE_URL}/api/profile/${userId}/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
      ]);

      return {
        success: true,
        profile: profile.profile,
        recentPosts: posts.posts || [],
        stats: stats,
      };
    } catch (error) {
      console.error("Batch profile fetch error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch profile data",
      };
    }
  },

  /**
   * Fetch multiple profiles in batch
   */
  getMultipleProfiles: async (userIds: string[]) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      const promises = userIds.map((userId) =>
        fetch(`${API_BASE_URL}/api/profile/public/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
      );

      const results = await Promise.all(promises);

      return {
        success: true,
        profiles: results.map((result) => result.profile),
      };
    } catch (error) {
      console.error("Batch profiles fetch error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch profiles",
      };
    }
  },
};