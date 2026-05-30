// app/hooks/community/useCommunityJoin.ts
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { communityService } from "../../lib/services/communityService";
import { Community } from "../../lib/types/community";

export function useCommunityJoin(
  community: Community | null,
  onSuccess?: () => void,
) {
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
          Alert.alert("Request Sent", result.message);
        }
      } else {
        result = await communityService.joinCommunity(community._id);
      }

      if (result.success) {
        onSuccess?.();
      } else {
        Alert.alert("Error", result.message || "Failed to join");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to join community");
    } finally {
      setJoining(false);
    }
  }, [community, onSuccess]);

  const leave = useCallback(async () => {
    if (!community) return;
    return new Promise<void>((resolve) => {
      Alert.alert("Leave Community", "Are you sure you want to leave?", [
        { text: "Cancel", style: "cancel", onPress: () => resolve() },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            const result = await communityService.leaveCommunity(community._id);
            if (result.success) {
              Alert.alert("Success", "Left community");
              onSuccess?.();
            } else {
              Alert.alert("Error", "Failed to leave");
            }
            resolve();
          },
        },
      ]);
    });
  }, [community, onSuccess]);

  return {
    joining,
    joinRequested,
    setJoinRequested,
    join,
    leave,
  };
}
