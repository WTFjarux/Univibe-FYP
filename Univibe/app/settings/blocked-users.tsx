// app/profile/blocked-users.tsx

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { useTheme } from "../../lib/contexts/ThemeContext";
import {
  getBlockedUsers,
  toggleBlockUser,
} from "../../lib/services/contentService";
import { getFullImageUrl } from "../../lib/services/postService";

interface BlockedUserData {
  _id: string;
  user: {
    _id: string;
    name: string;
    username: string;
    email: string;
    fullName?: string;
    profilePicture?: string;
  };
  direction: string;
  blockedByMe: boolean;
  isMutual: boolean;
  blockedAt: string;
  reason?: string;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useTheme();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    blockedByMe: 0,
    blockedMe: 0,
    mutual: 0,
  });

  const loadBlockedUsers = useCallback(
    async (pageNum: number = 1, shouldAppend: boolean = false) => {
      if (!token) return;
      if (shouldAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const response = await getBlockedUsers(pageNum, 20, "blocked_by_me");
        if (response.success && response.data) {
          const newUsers = response.data.users || [];
          if (shouldAppend) {
            setBlockedUsers((prev) => [...prev, ...newUsers]);
          } else {
            setBlockedUsers(newUsers);
          }
          if (response.data.stats) {
            setStats(response.data.stats);
          }
          setHasMore(
            response.data.pagination.page < response.data.pagination.pages,
          );
          setPage(pageNum);
        } else {
          setBlockedUsers([]);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load blocked users");
        setBlockedUsers([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await loadBlockedUsers(1, false);
  };
  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadBlockedUsers(page + 1, true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadBlockedUsers(1, false);
      }
    }, [token]),
  );

  const handleUnblock = async (blockedUser: BlockedUserData) => {
    const userData = blockedUser.user;
    const userName = userData.fullName || userData.name;
    Alert.alert(
      "Unblock User",
      `Do you want to unblock ${userName}? They will be able to interact with you again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setBlockedUsers((prev) =>
              prev.filter((u) => u._id !== blockedUser._id),
            );
            try {
              await toggleBlockUser(userData._id);
              await loadBlockedUsers(1, false);
            } catch (error: any) {
              await loadBlockedUsers(1, false);
              Alert.alert("Error", error.message || "Failed to unblock user");
            }
          },
        },
      ],
    );
  };

  const formatBlockedDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const renderUser = ({ item }: { item: BlockedUserData }) => {
    const userData = item.user;
    const displayName = userData.fullName || userData.name || "Unknown";
    const initial = displayName.charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={[
          styles.userCard,
          { backgroundColor: colors.card, shadowColor: colors.shadow },
        ]}
        onPress={() => router.push(`/profile/${userData._id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          {userData.profilePicture ? (
            <Image
              source={{ uri: getFullImageUrl(userData.profilePicture) }}
              style={[styles.avatar, { backgroundColor: colors.skeleton }]}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {displayName}
              </Text>
              {item.isMutual && (
                <View style={styles.mutualBadge}>
                  <Text style={styles.mutualBadgeText}>Mutual</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.userUsername, { color: colors.textSecondary }]}
            >
              @{userData.username}
            </Text>
            <Text style={[styles.blockedDate, { color: colors.textMuted }]}>
              Blocked {formatBlockedDate(item.blockedAt)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.unblockButton, { backgroundColor: colors.skeleton }]}
          onPress={(e) => {
            e.stopPropagation();
            handleUnblock(item);
          }}
        >
          <Ionicons
            name="person-add-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.unblockText, { color: colors.primary }]}>
            Unblock
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="person-remove-outline"
        size={64}
        color={colors.textMuted}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No blocked users
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Users you block will appear here
      </Text>
      <TouchableOpacity
        style={[styles.browseButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(tabs)/feed")}
      >
        <Text style={styles.browseButtonText}>Browse Feed</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Blocked Users
        </Text>
        <View style={{ width: 40 }} />
      </View>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading blocked users...
          </Text>
        </View>
      ) : (
        <>
          {stats.total > 0 && (
            <View
              style={[
                styles.statsContainer,
                {
                  backgroundColor: colors.skeleton,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                {stats.blockedByMe} blocked • {stats.mutual} mutual
              </Text>
            </View>
          )}
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item._id}
            renderItem={renderUser}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.loadingMoreText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Loading more...
                  </Text>
                </View>
              ) : null
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.card}
              />
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statsText: { fontSize: 13, textAlign: "center" },
  listContent: { flexGrow: 1, paddingBottom: 20 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  avatarPlaceholder: {
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 20, fontWeight: "600" },
  userDetails: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  mutualBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mutualBadgeText: { fontSize: 11, color: "#92400e", fontWeight: "500" },
  userUsername: { fontSize: 14 },
  blockedDate: { fontSize: 12, marginTop: 2 },
  unblockButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  unblockText: { fontSize: 14, fontWeight: "500" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: "center" },
  browseButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  browseButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: { fontSize: 12 },
});
