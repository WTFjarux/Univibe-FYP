// app/hooks/community/useCommunity.ts
import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { communityService } from "../../lib/services/communityService";
import { Community } from "../../lib/types/community";

export function useCommunity(communityId: string | undefined) {
  const router = useRouter();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommunity = useCallback(async () => {
    if (!communityId) return;
    setError(null);
    try {
      const result = await communityService.getCommunity(communityId);
      if (result.success && result.data) {
        setCommunity(result.data);
      } else {
        setError("Community not found");
        Alert.alert("Error", "Community not found");
        router.back();
      }
    } catch (err) {
      console.error("Load community error:", err);
      setError("Failed to load community");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  // Computed permissions
  const isMember = community?.isMember || false;
  const isAdmin = community?.isAdmin || false;
  const isModerator = community?.isModerator || false;
  const canManage = isAdmin || isModerator;
  const isApproved = community?.approvalStatus === "approved";
  const isPending = community?.approvalStatus === "pending";
  const isRejected = community?.approvalStatus === "rejected";

  return {
    community,
    loading,
    refreshing,
    error,
    refresh,
    loadCommunity,
    setCommunity,
    // Permissions
    isMember,
    isAdmin,
    isModerator,
    canManage,
    isApproved,
    isPending,
    isRejected,
  };
}
