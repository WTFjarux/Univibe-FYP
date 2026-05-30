// app/hooks/community/useCommunitiesList.ts
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { communityService } from "../../lib/services/communityService";
import { Community } from "../../lib/types/community";

interface FilterParams {
  type?: string;
  privacy?: string;
}

export function useCommunitiesList(filters: FilterParams = {}) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params: any = {};
      if (filters.type && filters.type !== "all") params.type = filters.type;
      if (filters.privacy && filters.privacy !== "all") params.privacy = filters.privacy;

      const [allResult, myResult] = await Promise.all([
        communityService.getCommunities(params),
        communityService.getMyCommunities(),
      ]);

      if (allResult.success) setCommunities(allResult.data);
      if (myResult.success) setMyCommunities(myResult.data);
    } catch (error) {
      console.error("Load communities error:", error);
    } finally {
      setLoading(false);
    }
  }, [filters.type, filters.privacy]);

  const joinCommunity = useCallback(async (community: Community) => {
    setJoiningId(community._id);
    try {
      let result;
      if (community.privacy === "private") {
        result = await communityService.requestToJoin(community._id);
        if (result.success) {
          Alert.alert("Request Sent", result.message);
        }
      } else {
        result = await communityService.joinCommunity(community._id);
      }
      
      if (result.success) {
        await loadData();
      } else {
        Alert.alert("Error", result.message || "Failed to join");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to join community");
    } finally {
      setJoiningId(null);
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    communities,
    myCommunities,
    loading,
    joiningId,
    loadData,
    joinCommunity,
  };
}