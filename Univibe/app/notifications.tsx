// app/notifications.tsx
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../lib/AuthContext";
import { connectionService } from "../lib/connectionService";
import { notificationService, Notification } from "../lib/notificationService";
import NotificationItem from "./components/Notifications/notificationItem";
import PendingRequestItem from "./components/Notifications/pendingRequestItem";
import DateSectionHeader from "./components/Notifications/dateSectionHeader";

interface SectionData {
  title: string;
  data: any[];
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: Notification[] } = {};

    notifications.forEach((notification) => {
      const date = new Date(notification.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupKey = "";
      if (date.toDateString() === today.toDateString()) {
        groupKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = "Yesterday";
      } else {
        groupKey = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
    });

    return Object.entries(groups).map(([title, data]) => ({
      title,
      data,
    }));
  }, [notifications]);

  // Fetch pending connection requests
  const fetchPendingRequests = async () => {
    if (!token) return;
    try {
      const response = await connectionService.getPendingRequests();
      if (response.success && response.data) {
        setPendingRequests(response.data.requests || []);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  };

  // Fetch notifications
  const fetchNotifications = async (pageNum = 1, shouldAppend = false) => {
    if (!token) return;

    try {
      const response = await notificationService.getNotifications(pageNum, 20);
      if (response.success && response.data) {
        const newNotifications = response.data.notifications;
        setNotifications((prev) =>
          shouldAppend ? [...prev, ...newNotifications] : newNotifications,
        );
        setUnreadCount(response.data.unreadCount);
        setHasMore(response.data.pagination.pages > pageNum);
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load more notifications
  const loadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1, true);
    }
  };

  // Refresh all data
  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await Promise.all([fetchPendingRequests(), fetchNotifications(1, false)]);
    setRefreshing(false);
  };

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    await notificationService.markAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Mark notification as unread
  const handleMarkAsUnread = async (notificationId: string) => {
    await notificationService.markAsUnread(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n._id === notificationId ? { ...n, read: false } : n)),
    );
    setUnreadCount((prev) => prev + 1);
  };

  // Delete notification
  const handleDeleteNotification = (notificationId: string) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const response =
              await notificationService.deleteNotification(notificationId);
            if (response.success) {
              setNotifications((prev) =>
                prev.filter((n) => n._id !== notificationId),
              );
              // Update unread count if the deleted notification was unread
              const wasUnread =
                notifications.find((n) => n._id === notificationId)?.read ===
                false;
              if (wasUnread) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              }
            }
          },
        },
      ],
    );
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      Alert.alert("Info", "No unread notifications");
      return;
    }

    Alert.alert(
      "Mark All as Read",
      `Mark all ${unreadCount} notification${unreadCount !== 1 ? "s" : ""} as read?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark All",
          onPress: async () => {
            try {
              setRefreshing(true);

              const response = await notificationService.markAllAsRead();

              if (response.success) {
                setNotifications((prev) =>
                  prev.map((n) => ({ ...n, read: true })),
                );
                setUnreadCount(0);
                Alert.alert("Success", "All notifications marked as read");
              } else {
                Alert.alert(
                  "Error",
                  response.message || "Failed to mark all as read",
                );
              }
            } catch (error) {
              console.error("Mark all as read error:", error);
              Alert.alert("Error", "Failed to mark all as read");
            } finally {
              setRefreshing(false);
            }
          },
        },
      ],
    );
  };

  // Accept connection request
  const handleAcceptRequest = async (requestId: string, userName: string) => {
    try {
      const response =
        await connectionService.acceptConnectionRequest(requestId);
      if (response.success) {
        setPendingRequests((prev) =>
          prev.filter((req) => req._id !== requestId),
        );
        Alert.alert("Success", `You are now connected with ${userName}`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to accept connection request");
    }
  };

  // Reject connection request
  const handleRejectRequest = async (requestId: string, userName: string) => {
    Alert.alert("Reject Request", `Reject ${userName}'s connection request?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          const response =
            await connectionService.rejectConnectionRequest(requestId);
          if (response.success) {
            setPendingRequests((prev) =>
              prev.filter((req) => req._id !== requestId),
            );
          }
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchPendingRequests();
        fetchNotifications(1, false);
      }
    }, [token]),
  );

  // Render section
  const renderSection = ({ section }: { section: SectionData }) => (
    <>
      <DateSectionHeader title={section.title} />
      {section.data.map((item) => (
        <NotificationItem
          key={item._id}
          notification={item}
          onMarkAsRead={handleMarkAsRead}
          onMarkAsUnread={handleMarkAsUnread}
          onDelete={handleDeleteNotification}
        />
      ))}
    </>
  );

  // Render empty state
  const renderEmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="notifications-outline" size={64} color="#d1d5db" />
        <Text style={styles.emptyStateText}>No notifications</Text>
        <Text style={styles.emptyStateSubtext}>
          When someone interacts with you, you'll see it here
        </Text>
      </View>
    );
  };

  if (loading && notifications.length === 0 && pendingRequests.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      </SafeAreaView>
    );
  }

  // Prepare data for FlatList
  const flatListData = [];

  // Add pending requests section
  if (pendingRequests.length > 0) {
    flatListData.push({
      id: "pending-header",
      type: "header",
      title: "Connection Requests",
    });
    flatListData.push({
      id: "pending-requests",
      type: "pending",
      data: pendingRequests,
    });
  }

  // Add notification sections
  groupedNotifications.forEach((group) => {
    flatListData.push({
      id: `header-${group.title}`,
      type: "header",
      title: group.title,
    });
    flatListData.push({
      id: `notifications-${group.title}`,
      type: "notifications",
      data: group.data,
    });
  });

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === "header") {
      return <DateSectionHeader title={item.title} />;
    }
    if (item.type === "pending") {
      return (
        <>
          {item.data.map((request: any) => (
            <PendingRequestItem
              key={request._id}
              request={request}
              onAccept={handleAcceptRequest}
              onReject={handleRejectRequest}
            />
          ))}
        </>
      );
    }
    if (item.type === "notifications") {
      return (
        <>
          {item.data.map((notification: Notification) => (
            <NotificationItem
              key={notification._id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              onMarkAsUnread={handleMarkAsUnread}
              onDelete={handleDeleteNotification}
            />
          ))}
        </>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            style={styles.markAllButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderButton} />
        )}
      </View>

      <FlatList
        data={flatListData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading && notifications.length > 0 ? (
            <ActivityIndicator style={styles.footerLoader} color="#8b5cf6" />
          ) : null
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  markAllButton: {
    width: 70,
    alignItems: "flex-end",
  },
  markAllText: {
    fontSize: 14,
    color: "#8b5cf6",
    fontWeight: "500",
  },
  placeholderButton: {
    width: 70,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoader: {
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
