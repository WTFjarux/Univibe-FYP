// app/profile/muted-users.tsx

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import {
  getMutedUsers,
  toggleMuteUser,
} from "../../lib/services/contentService";
import { getFullImageUrl } from "../../lib/services/postService";

interface MutedUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  fullName?: string;
  profilePicture?: string;
}

export default function MutedUsersScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const slideAnim = useRef(new Animated.Value(100)).current;
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showInfoBar = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setInfoMessage(message);
    setInfoType(type);
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInfoMessage(null);
      slideAnim.setValue(100);
    });
    infoTimeoutRef.current = setTimeout(() => {
      setInfoMessage(null);
      slideAnim.setValue(100);
    }, 4000);
  };

  const loadMutedUsers = useCallback(
    async (pageNum: number = 1, shouldAppend: boolean = false) => {
      if (!token) return;
      if (shouldAppend) setLoadingMore(true);
      else setLoading(true);
      try {
        const response = await getMutedUsers(pageNum, 20);
        if (response.success && response.data) {
          const newUsers = response.data.users;
          if (shouldAppend) setMutedUsers((prev) => [...prev, ...newUsers]);
          else setMutedUsers(newUsers);
          setHasMore(
            response.data.pagination.page < response.data.pagination.pages,
          );
          setPage(pageNum);
        } else setMutedUsers([]);
      } catch (error) {
        showInfoBar("Failed to load muted users", "error");
        setMutedUsers([]);
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
    await loadMutedUsers(1, false);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) loadMutedUsers(page + 1, true);
  };

  useFocusEffect(
    useCallback(() => {
      if (token) loadMutedUsers(1, false);
    }, [token]),
  );

  const handleUnmute = (userId: string, userName: string) => {
    Alert.alert(
      "Unmute User",
      `Do you want to unmute ${userName}? You will see their posts again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unmute",
          onPress: async () => {
            setMutedUsers((prev) => prev.filter((user) => user._id !== userId));
            showInfoBar(`${userName} unmuted`, "success");
            try {
              await toggleMuteUser(userId);
            } catch (error: any) {
              await loadMutedUsers(1, false);
              showInfoBar(error.message || "Failed to unmute user", "error");
            }
          },
        },
      ],
    );
  };

  const renderUser = ({ item }: { item: MutedUser }) => {
    const displayName = item.fullName || item.name || "Unknown";
    const initial = displayName.charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => router.push(`/profile/${item._id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          {item.profilePicture ? (
            <Image
              source={{ uri: getFullImageUrl(item.profilePicture) }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userUsername}>@{item.username}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.unmuteButton}
          onPress={(e) => {
            e.stopPropagation();
            handleUnmute(item._id, displayName);
          }}
        >
          <Ionicons name="volume-high-outline" size={20} color="#8b5cf6" />
          <Text style={styles.unmuteText}>Unmute</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Muted Users</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading muted users...</Text>
        </View>
      ) : (
        <FlatList
          data={mutedUsers}
          keyExtractor={(item) => item._id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="volume-off-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No muted users</Text>
              <Text style={styles.emptyText}>
                Users you mute will appear here
              </Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push("/(tabs)/feed")}
              >
                <Text style={styles.browseButtonText}>Browse Feed</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#8b5cf6" />
                <Text style={styles.loadingMoreText}>Loading more...</Text>
              </View>
            ) : null
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8b5cf6"
              colors={["#8b5cf6"]}
            />
          }
        />
      )}
      {infoMessage && (
        <Animated.View
          style={[
            styles.infoBar,
            {
              backgroundColor:
                infoType === "success"
                  ? "#10b981"
                  : infoType === "error"
                    ? "#ef4444"
                    : "#8b5cf6",
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Ionicons
            name={
              infoType === "success"
                ? "checkmark-circle"
                : infoType === "error"
                  ? "alert-circle"
                  : "information-circle"
            }
            size={20}
            color="#fff"
          />
          <Text style={styles.infoBarText}>{infoMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  listContent: { flexGrow: 1, paddingBottom: 20 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  avatarPlaceholder: {
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 20, fontWeight: "600" },
  userDetails: { flex: 1 },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  userUsername: { fontSize: 14, color: "#6b7280" },
  unmuteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    gap: 8,
  },
  unmuteText: { color: "#8b5cf6", fontSize: 14, fontWeight: "500" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  browseButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#8b5cf6",
    borderRadius: 20,
  },
  browseButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: { fontSize: 12, color: "#6b7280" },
  infoBar: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  infoBarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "left",
    lineHeight: 20,
  },
});
