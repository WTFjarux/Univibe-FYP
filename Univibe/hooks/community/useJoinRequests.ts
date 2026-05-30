// hooks/community/useJoinRequests.ts

import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { communityService } from "../../lib/services/communityService";
import { JoinRequest } from "../../lib/types/community";
import * as SecureStore from "expo-secure-store";

export function useJoinRequests(communityId: string | undefined) {
  const router = useRouter();
  const [requests, setRequests] = useState<{
    pending: JoinRequest[];
    processed: JoinRequest[];
    pendingCount: number;
    totalCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminIds, setAdminIds] = useState<string[]>([]);

  const loadRequests = useCallback(async () => {
    if (!communityId) return;

    setError(null);
    setLoading(true);

    try {
      // Check token first
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        setError("Authentication required");
        router.replace("/(auth)/login");
        return;
      }

      const [communityResult, requestsResult] = await Promise.all([
        communityService.getCommunity(communityId),
        communityService.getJoinRequests(communityId),
      ]);

      if (communityResult.success && communityResult.data) {
        const admins = communityResult.data.admins || [];
        const ids = admins.map((a: any) => a._id || a.toString());
        setAdminIds(ids);
      }

      if (requestsResult.success && requestsResult.data) {
        setRequests(requestsResult.data);
      } else if (
        requestsResult.message?.includes("401") ||
        requestsResult.message?.includes("unauthorized")
      ) {
        // Token expired
        setError("Session expired. Please login again.");
        router.replace("/(auth)/login");
      }
    } catch (error: any) {
      console.error("Load requests error:", error);

      if (error?.response?.status === 401 || error?.message?.includes("401")) {
        setError("Session expired. Please login again.");
        router.replace("/(auth)/login");
      } else {
        setError("Failed to load requests");
      }
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  const approveRequest = useCallback(
    async (userId: string) => {
      setProcessingId(userId);
      try {
        const result = await communityService.handleJoinRequest(
          communityId!,
          userId,
          {
            action: "approve",
          },
        );
        if (result.success) {
          Alert.alert("Success", result.message);
          await loadRequests();
          return true;
        }
        Alert.alert("Error", result.message || "Failed to approve");
        return false;
      } catch (error: any) {
        if (error?.response?.status === 401) {
          Alert.alert("Session Expired", "Please login again.");
          router.replace("/(auth)/login");
        } else {
          Alert.alert("Error", "Failed to process request");
        }
        return false;
      } finally {
        setProcessingId(null);
      }
    },
    [communityId, loadRequests],
  );

  const rejectRequest = useCallback(
    async (userId: string, reason: string) => {
      setProcessingId(userId);
      try {
        const result = await communityService.handleJoinRequest(
          communityId!,
          userId,
          {
            action: "reject",
            reason,
          },
        );
        if (result.success) {
          Alert.alert("Success", result.message);
          await loadRequests();
          return true;
        }
        Alert.alert("Error", result.message || "Failed to reject");
        return false;
      } catch (error: any) {
        if (error?.response?.status === 401) {
          Alert.alert("Session Expired", "Please login again.");
          router.replace("/(auth)/login");
        } else {
          Alert.alert("Error", "Failed to process request");
        }
        return false;
      } finally {
        setProcessingId(null);
      }
    },
    [communityId, loadRequests],
  );

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return {
    requests,
    loading,
    error,
    processingId,
    adminIds,
    loadRequests,
    approveRequest,
    rejectRequest,
  };
}
