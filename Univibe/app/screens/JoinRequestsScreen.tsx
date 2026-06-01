import React, { useState, useRef, useEffect } from "react";
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
  Animated,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../lib/contexts/ThemeContext";
import { useJoinRequests } from "../../hooks/community/useJoinRequests";
import { getFullImageUrl } from "../../lib/services/communityService";
import { JoinRequest } from "../../lib/types/community";

type FilterType = "pending" | "approved" | "rejected";

export default function JoinRequestsScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { colors, isDark } = useTheme();

  // Info Bar State
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const slideAnim = useRef(new Animated.Value(100)).current;

  // Info Bar Management
  const showInfoBar = (
    message: string,
    type: "success" | "error" | "info" = "info",
    autoHide = true,
  ) => {
    setInfoMessage(message);
    setInfoType(type);

    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      ...(autoHide
        ? [
            Animated.delay(3000),
            Animated.timing(slideAnim, {
              toValue: 100,
              duration: 300,
              useNativeDriver: true,
            }),
          ]
        : []),
    ]).start(() => {
      if (autoHide) {
        setInfoMessage(null);
        slideAnim.setValue(100);
      }
    });
  };

  const hideInfoBar = () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setInfoMessage(null);
      slideAnim.setValue(100);
    });
  };

  // ✅ Updated hook with callbacks for Info Bar
  const {
    requests,
    loading,
    processingId,
    adminIds,
    loadRequests,
    approveRequest,
    rejectRequest,
  } = useJoinRequests(communityId, {
    onSuccess: (message) => {
      showInfoBar(message, "success");
    },
    onError: (message) => {
      showInfoBar(message, "error");
    },
  });

  const [activeFilter, setActiveFilter] = useState<FilterType>("pending");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleApprove = (userId: string, userName: string) => {
    Alert.alert("Approve Request", `Add ${userName} to the community?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          await approveRequest(userId);
        },
      },
    ]);
  };

  const handleReject = (userId: string, userName: string) => {
    Alert.prompt(
      "Reject Request",
      `Why are you rejecting ${userName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async (reason?: string) => {
            if (!reason?.trim()) {
              showInfoBar("Please provide a reason", "error");
              return;
            }
            await rejectRequest(userId, reason.trim());
          },
        },
      ],
      "plain-text",
      "",
      "default",
    );
  };

  const getFilteredData = (): JoinRequest[] => {
    if (!requests) return [];
    if (activeFilter === "pending") return requests.pending;
    return requests.processed.filter((r) => r.status === activeFilter);
  };

  const renderInfoBar = () => {
    if (!infoMessage) return null;

    const bg =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : colors.primary;
    const icon =
      infoType === "success"
        ? "checkmark-circle"
        : infoType === "error"
          ? "alert-circle"
          : "information-circle";

    return (
      <Animated.View
        style={[
          styles.infoBar,
          { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.infoBarText}>{infoMessage}</Text>
      </Animated.View>
    );
  };

  const renderRequest = ({ item }: { item: JoinRequest }) => {
    const isProcessing = processingId === item.user._id;
    const isPending = item.status === "pending";

    return (
      <View
        style={[
          styles.requestCard,
          { backgroundColor: isDark ? "#1e293b" : "#ffffff" },
        ]}
      >
        <View style={styles.userInfo}>
          {item.user.profilePicture ? (
            <Image
              source={{ uri: getFullImageUrl(item.user.profilePicture) }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: colors.primary + "30" },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(item.user.name || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {item.user.name || "Unknown"}
              </Text>
              {adminIds.includes(item.user._id) && (
                <View
                  style={[styles.adminBadge, { backgroundColor: "#8b5cf620" }]}
                >
                  <Text style={[styles.adminBadgeText, { color: "#8b5cf6" }]}>
                    Admin
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.userUsername, { color: colors.textSecondary }]}
            >
              @{item.user.username || "user"}
            </Text>
            <Text style={[styles.requestTime, { color: colors.textSecondary }]}>
              Requested {new Date(item.requestedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {!isPending && (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === "approved" ? "#10b98120" : "#ef444420",
              },
            ]}
          >
            <Ionicons
              name={
                item.status === "approved" ? "checkmark-circle" : "close-circle"
              }
              size={14}
              color={item.status === "approved" ? "#10b981" : "#ef4444"}
            />
            <Text
              style={[
                styles.statusText,
                { color: item.status === "approved" ? "#10b981" : "#ef4444" },
              ]}
            >
              {item.status === "approved" ? "Approved" : "Rejected"}
            </Text>
          </View>
        )}

        {item.status === "rejected" && item.rejectionReason && (
          <Text style={[styles.rejectionReason, { color: "#ef4444" }]}>
            Reason: {item.rejectionReason}
          </Text>
        )}

        {!isPending && item.processedBy && (
          <Text style={[styles.processedInfo, { color: colors.textSecondary }]}>
            Processed by {item.processedBy.name} on{" "}
            {item.processedAt
              ? new Date(item.processedAt).toLocaleDateString()
              : ""}
          </Text>
        )}

        {isPending && !adminIds.includes(item.user._id) && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.approveBtn, { backgroundColor: "#10b981" }]}
              onPress={() => handleApprove(item.user._id, item.user.name)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, { borderColor: "#ef4444" }]}
              onPress={() => handleReject(item.user._id, item.user.name)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="close" size={16} color="#ef4444" />
                  <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
                    Reject
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isPending && adminIds.includes(item.user._id) && (
          <View style={[styles.adminNote, { backgroundColor: "#8b5cf615" }]}>
            <Ionicons name="information-circle" size={14} color="#8b5cf6" />
            <Text style={[styles.adminNoteText, { color: "#8b5cf6" }]}>
              This user is already a community admin
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Join Requests
          </Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const filteredData = getFilteredData();

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
          Join Requests
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <View
        style={[
          styles.filterBar,
          { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
        ]}
      >
        {(["pending", "approved", "rejected"] as FilterType[]).map((filter) => {
          const count =
            filter === "pending"
              ? requests?.pendingCount || 0
              : requests?.processed.filter((r) => r.status === filter).length ||
                0;
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                activeFilter === filter && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color:
                      activeFilter === filter
                        ? colors.primary
                        : colors.textSecondary,
                  },
                ]}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.filterCount,
                    {
                      backgroundColor:
                        activeFilter === filter
                          ? colors.primary + "20"
                          : colors.textSecondary + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      {
                        color:
                          activeFilter === filter
                            ? colors.primary
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredData}
        renderItem={renderRequest}
        keyExtractor={(item) => item._id || item.user._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={
          filteredData.length === 0 ? styles.emptyList : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name={
                activeFilter === "pending"
                  ? "person-add-outline"
                  : "document-text-outline"
              }
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No {activeFilter} requests
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeFilter === "pending"
                ? "All join requests have been processed"
                : `No ${activeFilter} requests found`}
            </Text>
          </View>
        }
      />

      {/* Info Bar */}
      {renderInfoBar()}
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
  filterBar: { flexDirection: "row", borderBottomWidth: 1 },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
  },
  filterText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  filterCountText: { fontSize: 11, fontFamily: "SofiaSans-Bold" },
  listContent: { paddingBottom: 40 },
  emptyList: { flexGrow: 1 },
  requestCard: {
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 14,
    borderRadius: 12,
  },
  userInfo: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontFamily: "SofiaSans-Bold" },
  userDetails: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 15, fontFamily: "SofiaSans-SemiBold" },
  adminBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  adminBadgeText: { fontSize: 9, fontFamily: "SofiaSans-Bold" },
  userUsername: { fontSize: 12, fontFamily: "SofiaSans-Regular", marginTop: 2 },
  requestTime: { fontSize: 11, fontFamily: "SofiaSans-Regular", marginTop: 4 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginBottom: 6,
  },
  statusText: { fontSize: 11, fontFamily: "SofiaSans-SemiBold" },
  rejectionReason: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 4,
  },
  processedInfo: { fontSize: 11, fontFamily: "SofiaSans-Regular" },
  actionButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "SofiaSans-SemiBold",
    color: "#ffffff",
  },
  adminNote: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    gap: 6,
    marginTop: 12,
  },
  adminNoteText: { fontSize: 12, fontFamily: "SofiaSans-Regular", flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontFamily: "SofiaSans-Bold", marginTop: 16 },
  emptyText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    marginTop: 8,
  },
  infoBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 50 : 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 45,
    zIndex: 9999,
  },
  infoBarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
    flex: 1,
    textAlign: "left",
    lineHeight: 20,
  },
});
