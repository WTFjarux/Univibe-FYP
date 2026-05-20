// app/notifications.tsx
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { connectionService } from "../../lib/services/connectionService";
import {
  notificationService,
  Notification,
  listenForNotifications,
} from "../../lib/services/notificationService";
import socketService from "../../lib/services/socketService";
import NotificationItem from "../components/Notifications/notificationItem";
import PendingRequestItem from "../components/Notifications/pendingRequestItem";
import DateSectionHeader from "../components/Notifications/dateSectionHeader";
import NotificationsSkeleton from "../components/Notifications/NotificationsSkeleton";

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
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );

  // Info bar state
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [deletedNotification, setDeletedNotification] = useState<{
    id: string;
    data: Notification;
  } | null>(null);
  const slideAnim = useRef(new Animated.Value(100)).current;

  // ===== REAL-TIME SOCKET LISTENER =====
  useEffect(() => {
    if (!token) {
      return;
    }

    const cleanup = listenForNotifications(
      (newNotification: Notification) => {
        setNotifications((prev) => {
          if (newNotification.metadata?.isGrouped) {
            const filtered = prev.filter(
              (n) =>
                !(
                  n.metadata?.isGrouped &&
                  n.targetId === newNotification.targetId
                ),
            );
            return [newNotification, ...filtered];
          }
          return [newNotification, ...prev];
        });
      },
      (count: number) => {
        setUnreadCount(count);
      },
    );

    return () => {
      cleanup();
    };
  }, [token]);

  // Show info bar message from bottom
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

  // Hide info bar manually
  const hideInfoBar = () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setInfoMessage(null);
      setDeletedNotification(null);
      slideAnim.setValue(100);
    });
  };

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

  // Delete notification with undo
  const handleDeleteNotification = async (notificationId: string) => {
    const notificationToDelete = notifications.find(
      (n) => n._id === notificationId,
    );
    if (!notificationToDelete) return;

    // Store the deleted notification for potential undo
    setDeletedNotification({
      id: notificationId,
      data: notificationToDelete,
    });

    // Remove from UI immediately
    setNotifications((prev) => prev.filter((n) => n._id !== notificationId));

    // Update unread count if needed
    const wasUnread = !notificationToDelete.read;
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    // Show undo info bar
    showInfoBar("Notification deleted", "info", false);

    // Perform actual deletion after a delay
    const timeoutId = setTimeout(async () => {
      const response =
        await notificationService.deleteNotification(notificationId);
      if (!response.success) {
        // If deletion failed, restore the notification
        setNotifications((prev) => [...prev, notificationToDelete]);
        if (wasUnread) {
          setUnreadCount((prev) => prev + 1);
        }
        showInfoBar("Failed to delete notification", "error");
      }
      setDeletedNotification(null);
      hideInfoBar();
    }, 5000);

    // Store timeout ID for undo
    (window as any).deleteTimeoutId = timeoutId;
  };

  // Undo delete
  const handleUndoDelete = () => {
    if (deletedNotification) {
      // Clear the timeout
      if ((window as any).deleteTimeoutId) {
        clearTimeout((window as any).deleteTimeoutId);
      }

      // Restore the notification
      setNotifications((prev) => [...prev, deletedNotification.data]);
      setNotifications((prev) =>
        prev.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );

      // Restore unread count
      if (!deletedNotification.data.read) {
        setUnreadCount((prev) => prev + 1);
      }

      // Hide info bar
      hideInfoBar();
      setDeletedNotification(null);
      showInfoBar("Notification restored", "success");
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      showInfoBar("No unread notifications", "info");
      return;
    }

    try {
      setRefreshing(true);

      const response = await notificationService.markAllAsRead();

      if (response.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        showInfoBar(`Marked ${unreadCount} notification(s) as read`, "success");
      } else {
        showInfoBar(response.message || "Failed to mark all as read", "error");
      }
    } catch (error) {
      console.error("Mark all as read error:", error);
      showInfoBar("Failed to mark all as read", "error");
    } finally {
      setRefreshing(false);
    }
  };

  // Accept connection request
  const handleAcceptRequest = async (requestId: string, userName: string) => {
    if (processingRequestId) return;

    setProcessingRequestId(requestId);
    try {
      const response =
        await connectionService.acceptConnectionRequest(requestId);
      if (response.success) {
        setPendingRequests((prev) =>
          prev.filter((req) => req._id !== requestId),
        );
        await fetchNotifications(1, false);
        showInfoBar(`Connected with ${userName}`, "success");
      } else {
        showInfoBar("Failed to accept connection request", "error");
      }
    } catch (error) {
      showInfoBar("Failed to accept connection request", "error");
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Reject connection request
  const handleRejectRequest = async (requestId: string, userName: string) => {
    if (processingRequestId) return;

    setProcessingRequestId(requestId);
    try {
      const response =
        await connectionService.rejectConnectionRequest(requestId);
      if (response.success) {
        setPendingRequests((prev) =>
          prev.filter((req) => req._id !== requestId),
        );
        await fetchNotifications(1, false);
        showInfoBar(`Rejected ${userName}'s connection request`, "info");
      } else {
        showInfoBar("Failed to reject connection request", "error");
      }
    } catch (error) {
      showInfoBar("Failed to reject connection request", "error");
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Render info bar
  const renderInfoBar = () => {
    if (!infoMessage) return null;

    const backgroundColor =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : "#8b5cf6";

    const iconName =
      infoType === "success"
        ? "checkmark-circle"
        : infoType === "error"
          ? "alert-circle"
          : "information-circle";

    return (
      <Animated.View
        style={[
          styles.infoBar,
          {
            backgroundColor,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Ionicons name={iconName} size={20} color="#fff" />
        <Text style={styles.infoBarText}>{infoMessage}</Text>
        {deletedNotification && (
          <TouchableOpacity
            onPress={handleUndoDelete}
            style={styles.undoButton}
          >
            <Text style={styles.undoButtonText}>UNDO</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchPendingRequests();
        fetchNotifications(1, false);
      }
    }, [token]),
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
    return <NotificationsSkeleton />;
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
              isProcessing={processingRequestId === request._id}
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

      {/* Info bar rendered at the bottom */}
      {renderInfoBar()}
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
    fontFamily: "SofiaSans-Bold",
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
    fontFamily: "SofiaSans-Regular",
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
    fontFamily: "SofiaSans-Bold",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  infoBar: {
    position: "absolute",
    bottom: 50,
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
    elevation: 3,
    zIndex: 1000,
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
  undoButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 6,
  },
  undoButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    letterSpacing: 0.5,
  },
});
