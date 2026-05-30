// app/screens/CommunityMembersScreen.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../lib/contexts/ThemeContext";
import { useAuth } from "../../lib/contexts/AuthContext";
import {
  communityService,
  getFullImageUrl,
} from "../../lib/services/communityService";
import { CommunityMember } from "../../lib/types/community";
import MemberOptionsModal from "../components/community/MemberOptionsModal";
import socketService from "../../lib/services/socketService";

const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");

export default function CommunityMembersScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(
    null,
  );

  const canManage = isAdmin || isModerator;

  const loadMembers = useCallback(async () => {
    if (!communityId) return;
    try {
      const [communityResult, membersResult] = await Promise.all([
        communityService.getCommunity(communityId),
        communityService.getMembers(communityId),
      ]);
      if (communityResult.success && communityResult.data) {
        setIsAdmin(communityResult.data.isAdmin || false);
        setIsModerator(communityResult.data.isModerator || false);
      }
      if (membersResult.success && membersResult.data) {
        setMembers(membersResult.data);
      }
    } catch (error) {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  useEffect(() => {
    if (!communityId) return;

    const handleCommunityUpdate = (data: {
      communityId: string;
      type: string;
      data: any;
    }) => {
      if (data.communityId !== communityId) return;
      if (
        data.type === "member_joined" ||
        data.type === "member_removed" ||
        data.type === "community_updated"
      ) {
        loadMembers();
      }
    };

    socketService.on("community:updated", handleCommunityUpdate);
    return () => {
      socketService.off("community:updated", handleCommunityUpdate);
    };
  }, [communityId, loadMembers]);

  const handleRemoveMember = (member: CommunityMember) => {
    Alert.alert(
      "Remove Member",
      `Remove ${member.user?.name || "this user"} from the community?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ],
    );
  };

  const handleAddModerator = async (member: CommunityMember) => {
    try {
      const result = await communityService.addModerator(
        communityId!,
        member.user._id,
      );
      if (result.success) {
        Alert.alert("Success", `${member.user?.name} is now a moderator`);
        loadMembers();
      } else {
        Alert.alert("Error", result.message || "Failed to add moderator");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to add moderator");
    }
  };

  const handleRemoveModerator = async (member: CommunityMember) => {
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
        loadMembers();
      } else {
        Alert.alert("Error", result.message || "Failed to remove moderator");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to remove moderator");
    }
  };

  const handleOptionsPress = (member: CommunityMember) => {
    setSelectedMember(member);
    setOptionsModalVisible(true);
  };

  const getAvatarUri = (
    profilePicture: string | null | undefined,
  ): string | null => {
    if (
      !profilePicture ||
      profilePicture === "null" ||
      profilePicture === "undefined" ||
      profilePicture === ""
    ) {
      return null;
    }
    if (
      profilePicture.startsWith("http://") ||
      profilePicture.startsWith("https://")
    ) {
      return profilePicture;
    }
    if (profilePicture.startsWith("/")) {
      return getFullImageUrl(profilePicture);
    }
    return getFullImageUrl(profilePicture);
  };

  const handleImageError = (memberId: string) => {
    setImageErrors((prev) => {
      const newSet = new Set(prev);
      newSet.add(memberId);
      return newSet;
    });
  };

  const renderMember = ({ item }: { item: CommunityMember }) => {
    const memberId = item.user?._id || "";
    const isCurrentUser = memberId === user?.id;
    const memberIsAdmin = item.isAdmin || false;
    const isMemberModerator = item.role === "moderator";
    const avatarUri = getAvatarUri(item.user?.profilePicture);
    const hasImageError = imageErrors.has(memberId);
    const userName = item.user?.name || "Unknown";
    const showImage = avatarUri && !hasImageError;

    return (
      <View style={styles.memberItem}>
        {showImage ? (
          <Image
            source={{ uri: avatarUri }}
            style={styles.avatar}
            onError={() => handleImageError(memberId)}
          />
        ) : (
          <Image source={DEFAULT_AVATAR} style={styles.avatar} />
        )}
        <View style={styles.memberDetails}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.memberName, { color: colors.text }]}
              numberOfLines={1}
            >
              {userName}
            </Text>
            {isCurrentUser && (
              <Text style={[styles.youTag, { color: colors.textSecondary }]}>
                (You)
              </Text>
            )}
          </View>
          <Text
            style={[styles.memberUsername, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            @{item.user?.username || "unknown"}
          </Text>
          <View style={styles.roleRow}>
            {isMemberModerator && !memberIsAdmin && (
              <View
                style={[styles.roleBadge, { backgroundColor: "#8b5cf620" }]}
              >
                <Ionicons name="star" size={10} color="#8b5cf6" />
                <Text style={[styles.roleText, { color: "#8b5cf6" }]}>
                  Moderator
                </Text>
              </View>
            )}
            {memberIsAdmin && (
              <View
                style={[styles.roleBadge, { backgroundColor: "#f59e0b20" }]}
              >
                <Ionicons name="shield-checkmark" size={10} color="#f59e0b" />
                <Text style={[styles.roleText, { color: "#f59e0b" }]}>
                  Admin
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.memberRight}>
          {canManage && !memberIsAdmin && !isCurrentUser && (
            <TouchableOpacity
              style={styles.optionsBtn}
              onPress={() => handleOptionsPress(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Members
        </Text>
        <View style={styles.headerBtn} />
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) =>
            (item.user?._id || "") + (item.joinedAt || "")
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={
            members.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No members yet
              </Text>
            </View>
          }
        />
      )}
      <MemberOptionsModal
        visible={optionsModalVisible}
        member={selectedMember}
        isAdmin={canManage}
        currentUserId={user?.id || ""}
        communityId={communityId!}
        onClose={() => {
          setOptionsModalVisible(false);
          setSelectedMember(null);
        }}
        onRemoveMember={handleRemoveMember}
        onAddModerator={isAdmin ? handleAddModerator : () => {}}
        onRemoveModerator={isAdmin ? handleRemoveModerator : () => {}}
        onViewProfile={(member) => {
          if (member.user?._id)
            router.push(`/profile/${member.user._id}` as any);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "SofiaSans-Bold" },
  listContent: { paddingBottom: 40 },
  emptyList: { flexGrow: 1 },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
  },
  memberDetails: { flex: 1, marginLeft: 10 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 1,
  },
  memberName: { fontSize: 15, fontFamily: "SofiaSans-SemiBold", flexShrink: 1 },
  youTag: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  memberUsername: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 3,
  },
  roleRow: { flexDirection: "row", gap: 4 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  roleText: { fontSize: 10, fontFamily: "SofiaSans-SemiBold" },
  memberRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionsBtn: { padding: 4 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: { fontSize: 16, fontFamily: "SofiaSans-Regular", marginTop: 12 },
});
