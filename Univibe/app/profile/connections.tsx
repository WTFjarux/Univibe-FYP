// app/profile/connections.tsx

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { connectionService } from "../../lib/services/connectionService";
import { getFullImageUrl } from "../../lib/services/postService";

interface Connection {
  _id: string;
  name: string;
  username: string;
  email: string;
  isOnline?: boolean;
  lastSeen?: string;
  profilePicture?: string;
}

export default function ConnectionsScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { token, user: currentUser } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadConnections = useCallback(
    async (pageNum: number = 1, shouldAppend: boolean = false) => {
      if (!token) return;

      if (shouldAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await connectionService.getConnections(
          userId || currentUser?.id || "",
          pageNum,
          20,
        );

        if (response.success && response.data) {
          const newConnections = response.data.connections;

          if (shouldAppend) {
            setConnections((prev) => [...prev, ...newConnections]);
          } else {
            setConnections(newConnections);
          }

          const pagination = response.data.pagination;
          if (pagination) {
            setHasMore(pagination.page < pagination.pages);
          }
        }
      } catch (error) {
        console.error("Error loading connections:", error);
        Alert.alert("Error", "Failed to load connections");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [token, userId],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await loadConnections(1, false);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadConnections(page + 1, true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadConnections(1, false);
      }
    }, [token]),
  );

  const renderUser = ({ item }: { item: Connection }) => {
    const displayName = item.name || "Unknown";
    const initial = displayName.charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => router.push(`/profile/${item._id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
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
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userUsername}>@{item.username || "user"}</Text>
            {!item.isOnline && item.lastSeen && (
              <Text style={styles.lastSeen}>
                Last seen {formatLastSeen(item.lastSeen)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const formatLastSeen = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No connections</Text>
      <Text style={styles.emptyText}>
        Connect with other students to see them here
      </Text>
    </View>
  );

  // ✅ Single return - header always present
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading connections...</Text>
        </View>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item._id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-SemiBold",
  },
  listContent: { flexGrow: 1, paddingBottom: 20 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarContainer: { position: "relative", marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },

  userDetails: { flex: 1, marginLeft: 6 },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
    fontFamily: "SofiaSans-SemiBold",
  },
  userUsername: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  lastSeen: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
    fontFamily: "SofiaSans-Regular",
  },
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
    fontFamily: "SofiaSans-SemiBold",
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
});
