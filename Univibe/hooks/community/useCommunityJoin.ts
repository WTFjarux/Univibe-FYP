import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { communityService } from "../../lib/services/communityService";
import { Community } from "../../lib/types/community";

interface UseCommunityJoinOptions {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onRefresh?: () => void;
}

export function useCommunityJoin(
  community: Community | null,
  options?: UseCommunityJoinOptions,
) {
  const { onSuccess, onError, onRefresh } = options || {};
  const [joining, setJoining] = useState(false);
  const [joinRequested, setJoinRequested] = useState(false);

  const join = useCallback(async () => {
    if (!community) return;
    setJoining(true);
    try {
      let result;
      if (community.privacy === "private") {
        result = await communityService.requestToJoin(community._id);
        if (result.success) {
          setJoinRequested(true);
          onSuccess?.(result.message || "Join request sent to admins");
        } else {
          onError?.(result.message || "Failed to send join request");
        }
      } else {
        result = await communityService.joinCommunity(community._id);
        if (result.success) {
          onSuccess?.(
            result.message || `Joined ${community.name} successfully`,
          );
        } else {
          onError?.(result.message || "Failed to join community");
        }
      }

      if (result.success) {
        onRefresh?.();
      }
    } catch (error: any) {
      onError?.(error?.message || "Failed to join community");
    } finally {
      setJoining(false);
    }
  }, [community, onSuccess, onError, onRefresh]);

  const leave = useCallback(async () => {
    if (!community) return;

    return new Promise<void>((resolve) => {
      Alert.alert("Leave Community", "Are you sure you want to leave?", [
        { text: "Cancel", style: "cancel", onPress: () => resolve() },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await communityService.leaveCommunity(
                community._id,
              );
              if (result.success) {
                // Reset joinRequested state when leaving
                setJoinRequested(false);
                onSuccess?.(result.message || "Left community");
                onRefresh?.();
              } else {
                onError?.(result.message || "Failed to leave community");
              }
            } catch (error: any) {
              onError?.(error?.message || "Failed to leave community");
            }
            resolve();
          },
        },
      ]);
    });
  }, [community, onSuccess, onError, onRefresh]);

  return {
    joining,
    joinRequested,
    setJoinRequested,
    join,
    leave,
  };
}
