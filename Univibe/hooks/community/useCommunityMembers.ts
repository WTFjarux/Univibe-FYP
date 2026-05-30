// hooks/community/useCommunityMembers.ts - FIXED to match MemberList props
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { communityService } from "../../lib/services/communityService";
import { CommunityMember } from "../../lib/types/community";

export function useCommunityMembers(communityId: string | undefined) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    try {
      const result = await communityService.getMembers(communityId);
      if (result.success) {
        setMembers(result.data);
      }
    } catch (error) {
      console.error("Load members error:", error);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  // ✅ Signature matches MemberList: (member: CommunityMember) => void
  const removeMember = useCallback(
    (member: CommunityMember) => {
      Alert.alert(
        "Remove Member",
        `Remove ${member.user?.name || "this user"} from the community?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setProcessingId(member.user._id);
              try {
                const result = await communityService.removeMember(
                  communityId!,
                  member.user._id,
                );
                if (result.success) {
                  setMembers((prev) =>
                    prev.filter((m) => m.user._id !== member.user._id),
                  );
                } else {
                  Alert.alert("Error", result.message || "Failed to remove");
                }
              } catch (error) {
                Alert.alert("Error", "Failed to remove member");
              } finally {
                setProcessingId(null);
              }
            },
          },
        ],
      );
    },
    [communityId],
  );

  // ✅ Signature matches MemberList: (member: CommunityMember) => void
  const addModerator = useCallback(
    async (member: CommunityMember) => {
      setProcessingId(member.user._id);
      try {
        const result = await communityService.addModerator(
          communityId!,
          member.user._id,
        );
        if (result.success) {
          Alert.alert("Success", `${member.user?.name} is now a moderator`);
          await loadMembers();
        } else {
          Alert.alert("Error", result.message || "Failed to add moderator");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to add moderator");
      } finally {
        setProcessingId(null);
      }
    },
    [communityId, loadMembers],
  );

  // ✅ Signature matches MemberList: (member: CommunityMember) => void
  const removeModerator = useCallback(
    async (member: CommunityMember) => {
      setProcessingId(member.user._id);
      try {
        const result = await communityService.removeModerator(
          communityId!,
          member.user._id,
        );
        if (result.success) {
          Alert.alert(
            "Success",
            `Removed moderator role from ${member.user?.name}`,
          );
          await loadMembers();
        } else {
          Alert.alert("Error", result.message || "Failed to remove moderator");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to remove moderator");
      } finally {
        setProcessingId(null);
      }
    },
    [communityId, loadMembers],
  );

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  return {
    members,
    loading,
    processingId,
    loadMembers,
    removeMember,
    addModerator,
    removeModerator,
  };
}
