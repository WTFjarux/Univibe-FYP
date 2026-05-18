// app/components/Notifications/notificationItem.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Image,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { API_BASE_URL } from "../../../constants/ipConstants";

const DEFAULT_AVATAR: ImageSourcePropType = require("../../../assets/images/default-avatar.png");

interface NotificationItemProps {
  notification: {
    _id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    sender: {
      _id: string;
      name: string;
      username: string;
      profilePicture?: string;
    };
    targetId?: string;
    targetModel?: string;
    metadata?: {
      isGrouped?: boolean;
      count?: number;
      likers?: Array<{
        userId: string;
        name: string;
        profilePicture?: string;
      }>;
    };
  };
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onDelete: (id: string) => void;
}

const isAdminNotification = (type: string) =>
  ["post_removed", "event_approved", "event_rejected"].includes(type);

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
}: NotificationItemProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [imageError, setImageError] = useState(false);
  const adminNotif = isAdminNotification(notification.type);

  const handlePress = () => {
    if (!notification.read) onMarkAsRead(notification._id);

    if (notification.metadata?.isGrouped && notification.targetId) {
      router.push({
        pathname: "/post/[id]",
        params: { id: notification.targetId, showLikes: "true" },
      });
      return;
    }

    if (
      notification.type === "event_interest" ||
      notification.type === "event_rsvp"
    ) {
      if (notification.targetId) {
        router.push(`/events/${notification.targetId}`);
        return;
      }
    }

    if (notification.targetModel === "Event" && notification.targetId) {
      router.push(`/events/${notification.targetId}`);
      return;
    }

    if (notification.type === "post_removed") return;

    if (
      notification.type === "event_approved" ||
      notification.type === "event_rejected"
    ) {
      if (notification.targetId) {
        router.push(`/events/${notification.targetId}`);
        return;
      }
    }

    switch (notification.type) {
      case "connection_request":
      case "connection_accepted":
        router.push(`/profile/${notification.sender._id}`);
        break;
      case "comment":
      case "like":
        if (notification.targetId) {
          router.push({
            pathname: "/post/[id]",
            params: { id: notification.targetId, openComments: "true" },
          });
        } else router.push("/(tabs)/feed");
        break;
      default:
        if (notification.targetId) router.push("/(tabs)/feed");
        break;
    }
  };

  const handleLongPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setShowOptions(true);
  };

  const getFullImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d`;
    return date.toLocaleDateString();
  };

  const getSmallIconConfig = () => {
    switch (notification.type) {
      case "connection_request":
        return { name: "person-add", color: "#fff", bg: "#f59e0b" };
      case "connection_accepted":
        return { name: "checkmark", color: "#fff", bg: "#10b981" };
      case "comment":
        return { name: "chatbubble", color: "#fff", bg: "#8b5cf6" };
      case "like":
        return { name: "heart", color: "#fff", bg: "#ef4444" };
      case "event_interest":
        return { name: "heart", color: "#fff", bg: "#ef4444" };
      case "event_rsvp":
        return { name: "calendar", color: "#fff", bg: "#8b5cf6" };
      case "post_removed":
        return { name: "warning", color: "#fff", bg: "#ef4444" };
      case "event_approved":
        return { name: "checkmark-circle", color: "#fff", bg: "#10b981" };
      case "event_rejected":
        return { name: "close-circle", color: "#fff", bg: "#ef4444" };
      default:
        return { name: "notifications", color: "#fff", bg: "#6b7280" };
    }
  };

  const extractCommentContent = (message: string): string => {
    const match = message.match(/: "(.+)"$/);
    return match?.[1] || message;
  };

  const getFormattedMessage = () => {
    const senderName = notification.sender.name;
    const isReply = notification.message.includes("replied to your comment");

    switch (notification.type) {
      case "like":
        if (notification.metadata?.isGrouped) {
          const likers = notification.metadata?.likers || [];
          return (
            <View style={styles.groupedLikeContent}>
              <View style={styles.stackedAvatarsContainer}>
                <View style={styles.stackedAvatars}>
                  {likers.slice(0, 2).map((liker, index) => (
                    <View
                      key={liker.userId}
                      style={[
                        styles.stackedAvatarWrapper,
                        index === 0 && styles.firstAvatar,
                        index === 1 && styles.secondAvatar,
                      ]}
                    >
                      {liker.profilePicture ? (
                        <Image
                          source={{
                            uri: getFullImageUrl(liker.profilePicture),
                          }}
                          style={[styles.stackedAvatar, styles.avatarBorder]}
                        />
                      ) : (
                        <Image
                          source={DEFAULT_AVATAR}
                          style={[styles.stackedAvatar, styles.avatarBorder]}
                        />
                      )}
                    </View>
                  ))}
                  {likers.length > 2 && (
                    <View
                      style={[styles.stackedAvatarWrapper, styles.thirdAvatar]}
                    >
                      <View style={styles.moreAvatar}>
                        <Ionicons name="heart" size={10} color="#ef4444" />
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.likeIconOverlay}>
                  <Ionicons name="heart" size={10} color="#fff" />
                </View>
              </View>
              <View style={styles.groupedLikeTextContainer}>
                <Text style={styles.messageText}>
                  {likers.length === 1 ? (
                    <>
                      <Text style={styles.boldName}>{likers[0].name}</Text>
                      <Text> liked your post</Text>
                    </>
                  ) : likers.length === 2 ? (
                    <>
                      <Text style={styles.boldName}>{likers[0].name}</Text>
                      <Text> and </Text>
                      <Text style={styles.boldName}>{likers[1].name}</Text>
                      <Text> liked your post</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.boldName}>{likers[0].name}</Text>
                      <Text>, </Text>
                      <Text style={styles.boldName}>{likers[1].name}</Text>
                      <Text>
                        {" "}
                        and {likers.length - 2} others liked your post
                      </Text>
                    </>
                  )}
                </Text>
                <Text style={styles.time}>
                  {getTimeAgo(notification.createdAt)}
                </Text>
              </View>
              {!notification.read && <View style={styles.unreadIndicator} />}
            </View>
          );
        }
        return (
          <Text style={styles.messageText}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> liked your post</Text>
          </Text>
        );

      case "comment":
        const c = extractCommentContent(notification.message);
        return (
          <Text style={styles.messageText}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text>
              {isReply
                ? " replied to your comment: "
                : " commented on your post: "}
            </Text>
            <Text style={styles.commentContent}>"{c}"</Text>
          </Text>
        );

      case "connection_request":
        return (
          <Text style={styles.messageText}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> sent you a connection request</Text>
          </Text>
        );

      case "connection_accepted":
        if (notification.message.includes("You are now connected with")) {
          return (
            <Text style={styles.messageText}>
              <Text>You are now connected with </Text>
              <Text style={styles.boldName}>{notification.sender.name}</Text>
            </Text>
          );
        }
        return (
          <Text style={styles.messageText}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> accepted your connection request</Text>
          </Text>
        );

      case "event_interest":
      case "event_rsvp":
        return (
          <Text style={styles.messageText}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> {notification.message}</Text>
          </Text>
        );

      case "post_removed":
      case "event_approved":
      case "event_rejected":
        return (
          <View>
            <Text
              style={[
                styles.removedTitle,
                {
                  color:
                    notification.type === "event_approved"
                      ? "#10b981"
                      : "#ef4444",
                },
              ]}
            >
              {notification.title}
            </Text>
            <Text style={styles.messageText}>
              <Text>{notification.message}</Text>
            </Text>
          </View>
        );

      default:
        return (
          <Text style={styles.messageText}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> {notification.message}</Text>
          </Text>
        );
    }
  };

  const smallIcon = getSmallIconConfig();
  const formattedMessage = getFormattedMessage();
  const isGroupedLike = notification.metadata?.isGrouped;

  const OptionsMenu = () => (
    <View style={styles.optionsMenu}>
      {!notification.read ? (
        <TouchableOpacity
          style={styles.optionItem}
          onPress={() => {
            onMarkAsRead(notification._id);
            setShowOptions(false);
          }}
        >
          <Ionicons name="checkmark-done-outline" size={18} color="#8b5cf6" />
          <Text style={styles.optionText}>Mark as read</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.optionItem}
          onPress={() => {
            onMarkAsUnread(notification._id);
            setShowOptions(false);
          }}
        >
          <Ionicons name="mail-outline" size={18} color="#f59e0b" />
          <Text style={styles.optionText}>Mark as unread</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.optionItem, styles.deleteOption]}
        onPress={() => {
          onDelete(notification._id);
          setShowOptions(false);
        }}
      >
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
        <Text style={styles.deleteOptionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        <View
          style={[
            styles.container,
            !notification.read && styles.unreadContainer,
            adminNotif && !notification.read && styles.removedContainer,
          ]}
        >
          {isGroupedLike ? (
            <View style={styles.contentContainer}>{formattedMessage}</View>
          ) : (
            <>
              <View style={styles.avatarWrapper}>
                <TouchableOpacity
                  onPress={() => {
                    if (!adminNotif)
                      router.push(`/profile/${notification.sender._id}`);
                  }}
                  disabled={adminNotif}
                >
                  {/* Admin notifications - show icon */}
                  {notification.type === "post_removed" ? (
                    <View
                      style={[
                        styles.avatar,
                        styles.adminAvatar,
                        { backgroundColor: "#fef2f2" },
                      ]}
                    >
                      <Ionicons name="warning" size={26} color="#ef4444" />
                    </View>
                  ) : notification.type === "event_approved" ? (
                    <View
                      style={[
                        styles.avatar,
                        styles.adminAvatar,
                        { backgroundColor: "#ecfdf5" },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={26}
                        color="#10b981"
                      />
                    </View>
                  ) : notification.type === "event_rejected" ? (
                    <View
                      style={[
                        styles.avatar,
                        styles.adminAvatar,
                        { backgroundColor: "#fef2f2" },
                      ]}
                    >
                      <Ionicons name="close-circle" size={26} color="#ef4444" />
                    </View>
                  ) : notification.sender.profilePicture && !imageError ? (
                    <Image
                      source={{
                        uri: getFullImageUrl(
                          notification.sender.profilePicture,
                        ),
                      }}
                      style={styles.avatar}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <Image source={DEFAULT_AVATAR} style={styles.avatar} />
                  )}
                </TouchableOpacity>
                {/* Small badge - hidden for admin */}
                {!adminNotif && (
                  <View
                    style={[
                      styles.smallIconContainer,
                      { backgroundColor: smallIcon.bg },
                    ]}
                  >
                    <Ionicons
                      name={smallIcon.name as any}
                      size={12}
                      color={smallIcon.color}
                    />
                  </View>
                )}
              </View>
              <View style={styles.contentContainer}>
                {formattedMessage}
                <Text style={styles.time}>
                  {getTimeAgo(notification.createdAt)}
                </Text>
              </View>
              {!notification.read && <View style={styles.unreadIndicator} />}
            </>
          )}
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => setShowOptions(!showOptions)}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        {showOptions && <OptionsMenu />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadContainer: { backgroundColor: "#faf5ff" },
  removedContainer: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  avatarWrapper: { position: "relative", marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  adminAvatar: { justifyContent: "center", alignItems: "center" },
  smallIconContainer: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  contentContainer: { flex: 1 },
  messageText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
    marginBottom: 4,
    color: "#374151",
  },
  boldName: {
    fontWeight: "700",
    fontSize: 15,
    fontFamily: "SofiaSans-Bold",
    color: "#111827",
  },
  commentContent: {
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    fontStyle: "italic",
  },
  removedTitle: { fontSize: 15, fontFamily: "SofiaSans-Bold", marginBottom: 2 },
  time: {
    fontSize: 11,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8b5cf6",
    marginLeft: 8,
  },
  optionsButton: { padding: 6, marginLeft: 4 },
  optionsMenu: {
    backgroundColor: "white",
    borderRadius: 12,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  optionText: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    color: "#374151",
  },
  deleteOption: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  deleteOptionText: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    color: "#ef4444",
  },
  groupedLikeContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  stackedAvatarsContainer: { position: "relative", marginRight: 12 },
  stackedAvatars: { width: 52, height: 52, position: "relative" },
  stackedAvatarWrapper: { position: "absolute" },
  stackedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
  },
  avatarBorder: { borderWidth: 2, borderColor: "white" },
  firstAvatar: { top: 0, left: 0, zIndex: 2 },
  secondAvatar: { top: 16, left: 16, zIndex: 1 },
  thirdAvatar: { top: 16, left: 16, zIndex: 0 },
  moreAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  likeIconOverlay: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    zIndex: 10,
  },
  groupedLikeTextContainer: { flex: 1 },
});
