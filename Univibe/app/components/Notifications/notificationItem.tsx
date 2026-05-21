// app/components/Notifications/notificationItem.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { API_BASE_URL } from "../../../constants/ipConstants";
import BlurhashImage from "@/app/components/BlurhashImage";

const DEFAULT_AVATAR = require("../../../assets/images/default-avatar.png");

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
      commenters?: Array<{
        userId: string;
        name: string;
        profilePicture?: string;
        preview?: string;
      }>;
    };
  };
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onDelete: (id: string) => void;
}

const isAdminNotification = (type: string) =>
  ["post_removed", "event_approved", "event_rejected"].includes(type);

const isAnonymousNotification = (
  notification: NotificationItemProps["notification"],
) =>
  notification.type === "comment" &&
  notification.message.includes("anonymously");

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
}: NotificationItemProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [imageError, setImageError] = useState(false);
  const { colors, isDark } = useTheme();
  const adminNotif = isAdminNotification(notification.type);
  const isAnon = isAnonymousNotification(notification);

  const isGroupedLike =
    notification.type === "like" && notification.metadata?.isGrouped;
  const isGroupedComment =
    notification.type === "comment" && notification.metadata?.isGrouped;
  const isGrouped = isGroupedLike || isGroupedComment;

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
    if (isAnon)
      return { name: "eye-off-outline" as const, color: "#fff", bg: "#6b7280" };
    switch (notification.type) {
      case "connection_request":
        return { name: "person-add" as const, color: "#fff", bg: "#f59e0b" };
      case "connection_accepted":
        return { name: "checkmark" as const, color: "#fff", bg: "#10b981" };
      case "comment":
        return { name: "chatbubble" as const, color: "#fff", bg: "#8b5cf6" };
      case "like":
        return { name: "heart" as const, color: "#fff", bg: "#ef4444" };
      case "event_interest":
        return { name: "heart" as const, color: "#fff", bg: "#ef4444" };
      case "event_rsvp":
        return { name: "calendar" as const, color: "#fff", bg: "#8b5cf6" };
      case "post_removed":
        return { name: "warning" as const, color: "#fff", bg: "#ef4444" };
      case "event_approved":
        return {
          name: "checkmark-circle" as const,
          color: "#fff",
          bg: "#10b981",
        };
      case "event_rejected":
        return { name: "close-circle" as const, color: "#fff", bg: "#ef4444" };
      default:
        return { name: "notifications" as const, color: "#fff", bg: "#6b7280" };
    }
  };

  const extractCommentContent = (message: string): string => {
    const match = message.match(/: "(.+)"$/);
    return match?.[1] || message;
  };

  const renderStackedAvatars = (
    people: Array<{ userId: string; name: string; profilePicture?: string }>,
    count: number,
    overlayIcon: string,
    overlayBg: string,
    moreBg: string,
    isAnonList = false,
  ) => (
    <View style={styles.stackedAvatarsContainer}>
      <View style={styles.stackedAvatars}>
        {people.slice(0, 2).map((person, index) => (
          <View
            key={person.userId}
            style={[
              styles.stackedAvatarWrapper,
              index === 0 && styles.firstAvatar,
              index === 1 && styles.secondAvatar,
            ]}
          >
            {isAnonList || !person.profilePicture ? (
              isAnonList ? (
                <View
                  style={[
                    styles.stackedAvatar,
                    styles.avatarBorder,
                    styles.anonymousMiniAvatar,
                    {
                      borderColor: colors.card,
                      backgroundColor: colors.skeleton,
                    },
                  ]}
                >
                  <Ionicons name="eye-off-outline" size={14} color="#9ca3af" />
                </View>
              ) : (
                <Image
                  source={DEFAULT_AVATAR}
                  style={[
                    styles.stackedAvatar,
                    styles.avatarBorder,
                    {
                      borderColor: colors.card,
                      backgroundColor: colors.skeleton,
                    },
                  ]}
                  contentFit="cover"
                />
              )
            ) : (
              <BlurhashImage
                uri={getFullImageUrl(person.profilePicture) || ""}
                style={[
                  styles.stackedAvatar,
                  styles.avatarBorder,
                  { borderColor: colors.card },
                ]}
                transition={150}
              />
            )}
          </View>
        ))}
        {count > 2 && (
          <View style={[styles.stackedAvatarWrapper, styles.thirdAvatar]}>
            <View
              style={[
                styles.moreAvatarGeneric,
                { backgroundColor: moreBg, borderColor: colors.card },
              ]}
            >
              <Ionicons name={overlayIcon as any} size={10} color="#fff" />
            </View>
          </View>
        )}
      </View>
      <View
        style={[
          styles.iconOverlay,
          { backgroundColor: overlayBg, borderColor: colors.card },
        ]}
      >
        <Ionicons name={overlayIcon as any} size={10} color="#fff" />
      </View>
    </View>
  );

  const getFormattedMessage = () => {
    const senderName = notification.sender.name;
    const isReply = notification.message.includes("replied to your comment");
    switch (notification.type) {
      case "like": {
        if (notification.metadata?.isGrouped) {
          const likers = notification.metadata?.likers || [];
          return (
            <View style={styles.groupedContent}>
              {renderStackedAvatars(
                likers,
                likers.length,
                "heart",
                "#ef4444",
                "#fee2e2",
              )}
              <View style={styles.groupedTextContainer}>
                <Text style={[styles.messageText, { color: colors.text }]}>
                  {likers.length === 1 ? (
                    <>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {likers[0].name}
                      </Text>
                      <Text> liked your post</Text>
                    </>
                  ) : likers.length === 2 ? (
                    <>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {likers[0].name}
                      </Text>
                      <Text> and </Text>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {likers[1].name}
                      </Text>
                      <Text> liked your post</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {likers[0].name}
                      </Text>
                      <Text>, </Text>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {likers[1].name}
                      </Text>
                      <Text>
                        {" "}
                        and {likers.length - 2} others liked your post
                      </Text>
                    </>
                  )}
                </Text>
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {getTimeAgo(notification.createdAt)}
                </Text>
              </View>
              {!notification.read && (
                <View
                  style={[
                    styles.unreadIndicator,
                    { backgroundColor: colors.primary },
                  ]}
                />
              )}
            </View>
          );
        }
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={[styles.boldName, { color: colors.text }]}>
              {senderName}
            </Text>
            <Text> liked your post</Text>
          </Text>
        );
      }
      case "comment": {
        if (notification.metadata?.isGrouped) {
          const commenters = notification.metadata?.commenters || [];
          return (
            <View style={styles.groupedContent}>
              {renderStackedAvatars(
                commenters,
                commenters.length,
                "chatbubble",
                "#8b5cf6",
                "#ede9fe",
              )}
              <View style={styles.groupedTextContainer}>
                <Text style={[styles.messageText, { color: colors.text }]}>
                  {commenters.length === 1 ? (
                    <>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {commenters[0].name}
                      </Text>
                      <Text> commented on your post</Text>
                    </>
                  ) : commenters.length === 2 ? (
                    <>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {commenters[0].name}
                      </Text>
                      <Text> and </Text>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {commenters[1].name}
                      </Text>
                      <Text> commented on your post</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {commenters[0].name}
                      </Text>
                      <Text>, </Text>
                      <Text style={[styles.boldName, { color: colors.text }]}>
                        {commenters[1].name}
                      </Text>
                      <Text>
                        {" "}
                        and {commenters.length - 2} others commented on your
                        post
                      </Text>
                    </>
                  )}
                </Text>
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {getTimeAgo(notification.createdAt)}
                </Text>
              </View>
              {!notification.read && (
                <View
                  style={[
                    styles.unreadIndicator,
                    { backgroundColor: colors.primary },
                  ]}
                />
              )}
            </View>
          );
        }
        const c = extractCommentContent(notification.message);
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={[styles.boldName, { color: colors.text }]}>
              {isAnon ? "Someone" : senderName}
            </Text>
            <Text>
              {isReply
                ? " replied to your comment: "
                : isAnon
                  ? " commented anonymously on your post"
                  : " commented on your post: "}
            </Text>
            {!isAnon && (
              <Text
                style={[styles.commentContent, { color: colors.textSecondary }]}
              >
                "{c}"
              </Text>
            )}
          </Text>
        );
      }
      case "connection_request":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={[styles.boldName, { color: colors.text }]}>
              {senderName}
            </Text>
            <Text> sent you a connection request</Text>
          </Text>
        );
      case "connection_accepted":
        if (notification.message.includes("You are now connected with")) {
          return (
            <Text style={[styles.messageText, { color: colors.text }]}>
              <Text>You are now connected with </Text>
              <Text style={[styles.boldName, { color: colors.text }]}>
                {notification.sender.name}
              </Text>
            </Text>
          );
        }
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={[styles.boldName, { color: colors.text }]}>
              {senderName}
            </Text>
            <Text> accepted your connection request</Text>
          </Text>
        );
      case "event_interest":
      case "event_rsvp":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={[styles.boldName, { color: colors.text }]}>
              {senderName}
            </Text>
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
            <Text style={[styles.messageText, { color: colors.text }]}>
              <Text>{notification.message}</Text>
            </Text>
          </View>
        );
      default:
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={[styles.boldName, { color: colors.text }]}>
              {senderName}
            </Text>
            <Text> {notification.message}</Text>
          </Text>
        );
    }
  };

  const smallIcon = getSmallIconConfig();
  const formattedMessage = getFormattedMessage();

  const OptionsMenu = () => (
    <View
      style={[
        styles.optionsMenu,
        { backgroundColor: colors.card, shadowColor: colors.shadow },
      ]}
    >
      {!notification.read ? (
        <TouchableOpacity
          style={styles.optionItem}
          onPress={() => {
            onMarkAsRead(notification._id);
            setShowOptions(false);
          }}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={[styles.optionText, { color: colors.text }]}>
            Mark as read
          </Text>
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
          <Text style={[styles.optionText, { color: colors.text }]}>
            Mark as unread
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[
          styles.optionItem,
          styles.deleteOption,
          { borderTopColor: colors.border },
        ]}
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

  // Build container style dynamically
  const baseContainerStyle = {
    ...styles.container,
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
  };

  let containerStyle;
  if (adminNotif && !notification.read) {
    containerStyle = [
      baseContainerStyle,
      {
        backgroundColor: isDark ? "#451a1a" : "#fef2f2",
        borderWidth: 1,
        borderColor: "#fecaca",
      },
    ];
  } else if (!notification.read) {
    containerStyle = [
      baseContainerStyle,
      { backgroundColor: isDark ? "rgba(139, 92, 246, 0.1)" : "#faf5ff" },
    ];
  } else {
    containerStyle = [baseContainerStyle];
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        <View style={containerStyle}>
          {isGrouped ? (
            <View style={styles.contentContainer}>{formattedMessage}</View>
          ) : (
            <>
              <View style={styles.avatarWrapper}>
                <TouchableOpacity
                  onPress={() => {
                    if (!adminNotif)
                      router.push(`/profile/${notification.sender._id}`);
                  }}
                  disabled={adminNotif || isAnon}
                >
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
                  ) : isAnon ? (
                    <View
                      style={[
                        styles.avatar,
                        styles.anonymousAvatar,
                        {
                          backgroundColor: colors.skeleton,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="eye-off-outline"
                        size={26}
                        color="#9ca3af"
                      />
                    </View>
                  ) : notification.sender.profilePicture && !imageError ? (
                    <BlurhashImage
                      uri={
                        getFullImageUrl(notification.sender.profilePicture) ||
                        ""
                      }
                      style={[
                        styles.avatar,
                        { backgroundColor: colors.skeleton },
                      ]}
                      transition={200}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <Image
                      source={DEFAULT_AVATAR}
                      style={[
                        styles.avatar,
                        { backgroundColor: colors.skeleton },
                      ]}
                      contentFit="cover"
                    />
                  )}
                </TouchableOpacity>
                {!adminNotif && (
                  <View
                    style={[
                      styles.smallIconContainer,
                      {
                        backgroundColor: smallIcon.bg,
                        borderColor: colors.card,
                      },
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
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {getTimeAgo(notification.createdAt)}
                </Text>
              </View>
              {!notification.read && (
                <View
                  style={[
                    styles.unreadIndicator,
                    { backgroundColor: colors.primary },
                  ]}
                />
              )}
            </>
          )}
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => setShowOptions(!showOptions)}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        {showOptions && <OptionsMenu />}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================
// STYLES - No hardcoded background/foreground colors
// ============================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarWrapper: { position: "relative", marginRight: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  adminAvatar: { justifyContent: "center", alignItems: "center" },
  anonymousAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  anonymousMiniAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
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
  },
  contentContainer: { flex: 1 },
  messageText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
    marginBottom: 4,
  },
  boldName: {
    fontWeight: "700",
    fontSize: 15,
    fontFamily: "SofiaSans-Bold",
  },
  commentContent: {
    fontFamily: "SofiaSans-Regular",
    fontStyle: "italic",
  },
  removedTitle: { fontSize: 15, fontFamily: "SofiaSans-Bold", marginBottom: 2 },
  time: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  optionsButton: { padding: 6, marginLeft: 4 },
  optionsMenu: {
    borderRadius: 12,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 60,
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
  },
  deleteOption: { borderTopWidth: 1 },
  deleteOptionText: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    color: "#ef4444",
  },
  groupedContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  stackedAvatarsContainer: { position: "relative", marginRight: 12 },
  stackedAvatars: { width: 52, height: 52, position: "relative" },
  stackedAvatarWrapper: { position: "absolute" },
  stackedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarBorder: { borderWidth: 2 },
  firstAvatar: { top: 0, left: 0, zIndex: 2 },
  secondAvatar: { top: 16, left: 16, zIndex: 1 },
  thirdAvatar: { top: 16, left: 16, zIndex: 0 },
  moreAvatarGeneric: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  iconOverlay: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    zIndex: 10,
  },
  groupedTextContainer: { flex: 1 },
});
