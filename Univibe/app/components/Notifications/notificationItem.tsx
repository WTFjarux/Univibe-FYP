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

// ============================================
// TYPES
// ============================================

interface NotificationSender {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
  fullName?: string;
}

interface NotificationMetadata {
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
  communityId?: string;
  communityName?: string;
  communityImage?: string | null;
  isCommunityPost?: boolean; // ✅ Added for community post likes
}

interface NotificationData {
  _id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  sender: NotificationSender;
  targetId?: string;
  targetModel?: string;
  metadata?: NotificationMetadata;
}

interface NotificationItemProps {
  notification: NotificationData;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onDelete: (id: string) => void;
}

// ============================================
// NOTIFICATION TYPE CATEGORIES
// ============================================

/** System/admin notifications (non-community) */
const ADMIN_NOTIFICATION_TYPES = [
  "post_removed",
  "event_approved",
  "event_rejected",
];

/** All community-related notification types */
const COMMUNITY_NOTIFICATION_TYPES = [
  "community_approved",
  "community_rejected",
  "join_request",
  "join_approved",
  "join_rejected",
  "community_invite",
  "invitation_pending",
  "invitation_accepted",
  "invitation_approved",
  "invitation_rejected",
  "member_joined",
  "member_removed",
  "role_updated",
  "like", // ✅ Added for community post likes
];

/** Show COMMUNITY IMAGE for these types */
const COMMUNITY_IMAGE_TYPES = [
  "community_approved",
  "community_rejected",
  "member_removed",
  "role_updated",
  "join_approved",
  "join_rejected",
  "invitation_pending",
  "invitation_accepted",
  "invitation_approved",
  "invitation_rejected",
];

/** Show USER AVATAR for these types */
const USER_AVATAR_TYPES = ["member_joined", "join_request", "like"];

// ============================================
// HELPER FUNCTIONS
// ============================================

const isAdminNotification = (type: string): boolean =>
  ADMIN_NOTIFICATION_TYPES.includes(type);

const isCommunityNotification = (type: string): boolean =>
  COMMUNITY_NOTIFICATION_TYPES.includes(type);

const isAnonymousNotification = (notification: NotificationData): boolean =>
  notification.type === "comment" &&
  notification.message.includes("anonymously");

// ============================================
// COMPONENT
// ============================================

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

  // ── Computed flags ────────────────────────────────
  const adminNotif = isAdminNotification(notification.type);
  const isCommunity = isCommunityNotification(notification.type);
  const isAnon = isAnonymousNotification(notification);
  const isGroupedLike =
    notification.type === "like" && notification.metadata?.isGrouped;
  const isGroupedComment =
    notification.type === "comment" && notification.metadata?.isGrouped;
  const isGrouped = isGroupedLike || isGroupedComment;

  // ── Community metadata ─────────────────────────────
  const communityName = notification.metadata?.communityName || "";
  const communityImage = notification.metadata?.communityImage || null;
  const isCommunityPost = notification.metadata?.isCommunityPost || false;

  // ── Avatar display logic ───────────────────────────
  const showCommunityImage = COMMUNITY_IMAGE_TYPES.includes(notification.type);
  const showUserAvatar = USER_AVATAR_TYPES.includes(notification.type);

  // community_invite: admin/mod → community image, member → user avatar
  const isCommunityInvite = notification.type === "community_invite";
  const isInviteFromCommunity =
    isCommunityInvite &&
    (notification.sender?.name === communityName ||
      notification.message?.includes("has invited you to join") ||
      notification.message?.includes("invited and added"));

  // ============================================
  // NAVIGATION
  // ============================================

  const handlePress = () => {
    if (!notification.read) onMarkAsRead(notification._id);

    // Grouped → post
    if (notification.metadata?.isGrouped && notification.targetId) {
      router.push({
        pathname: "/post/[id]",
        params: { id: notification.targetId, showLikes: "true" },
      });
      return;
    }

    // Events
    if (
      notification.type === "event_interest" ||
      notification.type === "event_rsvp" ||
      notification.type === "event_approved" ||
      notification.type === "event_rejected"
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

    // Post removed → no navigation
    if (notification.type === "post_removed") return;

    // Community → community screen
    if (isCommunity && notification.targetId) {
      router.push({
        pathname: "/screens/CommunityScreen",
        params: { communityId: notification.targetId },
      });
      return;
    }

    // Connections → profile
    if (
      notification.type === "connection_request" ||
      notification.type === "connection_accepted"
    ) {
      router.push(`/profile/${notification.sender._id}`);
      return;
    }

    // Comment/Like → post
    if (notification.type === "comment" || notification.type === "like") {
      if (notification.targetId) {
        router.push({
          pathname: "/post/[id]",
          params: { id: notification.targetId, openComments: "true" },
        });
      } else {
        router.push("/(tabs)/feed");
      }
      return;
    }

    // Fallback
    if (notification.targetId) {
      router.push("/(tabs)/feed");
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

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const getFullImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d`;
    return date.toLocaleDateString();
  };

  const extractCommentContent = (message: string): string => {
    const match = message.match(/: "(.+)"$/);
    return match?.[1] || message;
  };

  // ============================================
  // ICON CONFIGURATION
  // ============================================

  const getSmallIconConfig = () => {
    if (isAnon) {
      return { name: "eye-off-outline" as const, color: "#fff", bg: "#6b7280" };
    }

    const iconMap: Record<string, { name: string; color: string; bg: string }> =
      {
        connection_request: {
          name: "person-add",
          color: "#fff",
          bg: "#f59e0b",
        },
        connection_accepted: {
          name: "checkmark",
          color: "#fff",
          bg: "#10b981",
        },
        comment: { name: "chatbubble", color: "#fff", bg: "#8b5cf6" },
        like: { name: "heart", color: "#fff", bg: "#ef4444" },
        event_interest: { name: "heart", color: "#fff", bg: "#ef4444" },
        event_rsvp: { name: "calendar", color: "#fff", bg: "#8b5cf6" },
        post_removed: { name: "warning", color: "#fff", bg: "#ef4444" },
        event_approved: {
          name: "checkmark-circle",
          color: "#fff",
          bg: "#10b981",
        },
        event_rejected: {
          name: "close-circle",
          color: "#fff",
          bg: "#ef4444",
        },
        community_approved: {
          name: "checkmark-circle",
          color: "#fff",
          bg: "#10b981",
        },
        community_rejected: {
          name: "close-circle",
          color: "#fff",
          bg: "#ef4444",
        },
        join_request: { name: "person-add", color: "#fff", bg: "#3b82f6" },
        join_approved: { name: "checkmark", color: "#fff", bg: "#10b981" },
        join_rejected: { name: "close", color: "#fff", bg: "#ef4444" },
        community_invite: { name: "mail", color: "#fff", bg: "#10b981" },
        invitation_pending: { name: "time", color: "#fff", bg: "#f59e0b" },
        invitation_accepted: {
          name: "checkmark",
          color: "#fff",
          bg: "#10b981",
        },
        invitation_approved: {
          name: "checkmark-circle",
          color: "#fff",
          bg: "#10b981",
        },
        invitation_rejected: {
          name: "close-circle",
          color: "#fff",
          bg: "#ef4444",
        },
        member_joined: { name: "people", color: "#fff", bg: "#8b5cf6" },
        member_removed: { name: "person-remove", color: "#fff", bg: "#ef4444" },
        role_updated: { name: "star", color: "#fff", bg: "#f59e0b" },
      };

    const config = iconMap[notification.type];
    if (config) return config as { name: any; color: string; bg: string };
    return { name: "notifications" as const, color: "#fff", bg: "#6b7280" };
  };

  // ============================================
  // STACKED AVATARS (for grouped notifications)
  // ============================================

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

  // ============================================
  // FORMATTED MESSAGE
  // ============================================

  const getFormattedMessage = () => {
    const senderName =
      notification.sender.name || notification.sender.fullName || "Unknown";
    const isReply = notification.message.includes("replied to your comment");

    switch (notification.type) {
      // ── Like ──────────────────────────────────────
      case "like": {
        // ✅ Get community context for community post likes
        const communityContext =
          isCommunityPost && communityName ? ` in "${communityName}"` : "";

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
                      <Text style={styles.boldName}>{likers[0].name}</Text>
                      <Text> liked your post{communityContext}</Text>
                    </>
                  ) : likers.length === 2 ? (
                    <>
                      <Text style={styles.boldName}>{likers[0].name}</Text>
                      <Text> and </Text>
                      <Text style={styles.boldName}>{likers[1].name}</Text>
                      <Text> liked your post{communityContext}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.boldName}>{likers[0].name}</Text>
                      <Text>, </Text>
                      <Text style={styles.boldName}>{likers[1].name}</Text>
                      <Text>
                        {" "}
                        and {likers.length - 2} others liked your post
                        {communityContext}
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
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> liked your post{communityContext}</Text>
          </Text>
        );
      }

      // ── Comment ───────────────────────────────────
      case "comment": {
        const communityContext =
          isCommunityPost && communityName ? ` in "${communityName}"` : "";

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
                      <Text style={styles.boldName}>{commenters[0].name}</Text>
                      <Text> commented on your post{communityContext}</Text>
                    </>
                  ) : commenters.length === 2 ? (
                    <>
                      <Text style={styles.boldName}>{commenters[0].name}</Text>
                      <Text> and </Text>
                      <Text style={styles.boldName}>{commenters[1].name}</Text>
                      <Text> commented on your post{communityContext}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.boldName}>{commenters[0].name}</Text>
                      <Text>, </Text>
                      <Text style={styles.boldName}>{commenters[1].name}</Text>
                      <Text>
                        {" "}
                        and {commenters.length - 2} others commented on your
                        post
                        {communityContext}
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
        const content = extractCommentContent(notification.message);
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>
              {isAnon ? "Someone" : senderName}
            </Text>
            <Text>
              {isReply
                ? " replied to your comment: "
                : isAnon
                  ? " commented anonymously on your post"
                  : ` commented on your post${communityContext}: `}
            </Text>
            {!isAnon && (
              <Text
                style={[styles.commentContent, { color: colors.textSecondary }]}
              >
                "{content}"
              </Text>
            )}
          </Text>
        );
      }

      // ── Connections ───────────────────────────────
      case "connection_request":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> sent you a connection request</Text>
          </Text>
        );
      case "connection_accepted":
        if (notification.message.includes("You are now connected with")) {
          return (
            <Text style={[styles.messageText, { color: colors.text }]}>
              <Text>You are now connected with </Text>
              <Text style={styles.boldName}>{senderName}</Text>
            </Text>
          );
        }
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> accepted your connection request</Text>
          </Text>
        );

      // ── Events ─────────────────────────────────────
      case "event_interest":
      case "event_rsvp":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> {notification.message}</Text>
          </Text>
        );

      // ── Admin (non-community) ──────────────────────
      case "post_removed":
      case "event_approved":
      case "event_rejected": {
        const isPositive = notification.type === "event_approved";
        return (
          <View>
            <Text
              style={[
                styles.removedTitle,
                { color: isPositive ? "#10b981" : "#ef4444" },
              ]}
            >
              {notification.title}
            </Text>
            <Text style={[styles.messageText, { color: colors.text }]}>
              {notification.message}
            </Text>
          </View>
        );
      }

      // ── Community: Approved / Rejected ─────────────
      case "community_approved":
      case "community_rejected": {
        const isPositive = notification.type === "community_approved";
        return (
          <View>
            <Text
              style={[
                styles.removedTitle,
                { color: isPositive ? "#10b981" : "#ef4444" },
              ]}
            >
              {notification.title}
            </Text>
            <Text style={[styles.messageText, { color: colors.text }]}>
              {notification.message}
            </Text>
          </View>
        );
      }

      // ── Community: Member events ───────────────────
      case "member_joined":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> joined </Text>
            <Text style={styles.boldName}>
              {communityName || notification.message}
            </Text>
          </Text>
        );

      case "member_removed":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text>You have been removed from </Text>
            <Text style={styles.boldName}>
              {communityName || notification.message}
            </Text>
          </Text>
        );

      case "role_updated":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            {notification.message}
          </Text>
        );

      // ── Community: Join requests ───────────────────
      case "join_request":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> wants to join </Text>
            <Text style={styles.boldName}>
              {communityName || notification.message}
            </Text>
          </Text>
        );

      case "join_approved":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text>Your request to join </Text>
            <Text style={styles.boldName}>
              {communityName || notification.message}
            </Text>
            <Text> has been approved!</Text>
          </Text>
        );

      case "join_rejected": {
        const reason = notification.message.includes("Reason:")
          ? notification.message.split("Reason:")[1].trim()
          : "";
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text>Your request to join </Text>
            <Text style={styles.boldName}>
              {communityName ||
                notification.message.split("was rejected")[0].trim()}
            </Text>
            <Text>was rejected{reason ? `. Reason: ${reason}` : ""}</Text>
          </Text>
        );
      }

      // ── Community: Invitations ─────────────────────
      case "community_invite":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> invited you to join </Text>
            <Text style={styles.boldName}>
              {communityName || notification.message}
            </Text>
          </Text>
        );

      case "invitation_pending":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            {notification.message}
          </Text>
        );

      case "invitation_accepted":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text>A user accepted the invitation to </Text>
            <Text style={styles.boldName}>
              {communityName ||
                notification.message.split('to "')[1]?.replace('"', "") ||
                notification.message}
            </Text>
          </Text>
        );

      case "invitation_approved":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text>Your invitation to </Text>
            <Text style={styles.boldName}>
              {communityName ||
                notification.message
                  .split('to "')[1]
                  ?.replace('" has been', "") ||
                notification.message}
            </Text>
            <Text> has been approved!</Text>
          </Text>
        );

      case "invitation_rejected":
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text>Your invitation to </Text>
            <Text style={styles.boldName}>
              {communityName ||
                notification.message
                  .split('to "')[1]
                  ?.replace('" was rejected', "") ||
                notification.message}
            </Text>
            <Text> was rejected</Text>
          </Text>
        );

      // ── Default ────────────────────────────────────
      default:
        return (
          <Text style={[styles.messageText, { color: colors.text }]}>
            <Text style={styles.boldName}>{senderName}</Text>
            <Text> {notification.message}</Text>
          </Text>
        );
    }
  };

  // ============================================
  // AVATAR RENDERING
  // ============================================

  const renderCommunityImageAvatar = () => {
    if (communityImage) {
      return (
        <BlurhashImage
          uri={getFullImageUrl(communityImage) || ""}
          style={[styles.avatar, { backgroundColor: colors.skeleton }]}
          transition={200}
          contentFit="cover"
        />
      );
    }
    if (communityName) {
      return (
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: "#8b5cf620",
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#8b5cf6" }}>
            {communityName.charAt(0).toUpperCase()}
          </Text>
        </View>
      );
    }
    return (
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: "#8b5cf620",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Ionicons name="people" size={26} color="#8b5cf6" />
      </View>
    );
  };

  const renderUserAvatar = () => {
    if (notification.sender.profilePicture && !imageError) {
      return (
        <BlurhashImage
          uri={getFullImageUrl(notification.sender.profilePicture) || ""}
          style={[styles.avatar, { backgroundColor: colors.skeleton }]}
          transition={200}
          onError={() => setImageError(true)}
        />
      );
    }
    return (
      <Image
        source={DEFAULT_AVATAR}
        style={[styles.avatar, { backgroundColor: colors.skeleton }]}
        contentFit="cover"
      />
    );
  };

  const renderAdminIcon = (
    iconName: keyof typeof Ionicons.glyphMap,
    bgColor: string,
    iconColor: string,
  ) => (
    <View
      style={[styles.avatar, styles.adminAvatar, { backgroundColor: bgColor }]}
    >
      <Ionicons name={iconName} size={26} color={iconColor} />
    </View>
  );

  const renderAvatar = () => {
    // 1. Community invite from admin/mod → Community image
    if (isCommunityInvite && isInviteFromCommunity) {
      return renderCommunityImageAvatar();
    }

    // 2. Community image types
    if (showCommunityImage) {
      return renderCommunityImageAvatar();
    }

    // 3. User avatar types (member_joined, join_request, community_invite from member, like)
    if (showUserAvatar || isCommunityInvite) {
      return renderUserAvatar();
    }

    // 4. Admin notifications
    if (notification.type === "post_removed") {
      return renderAdminIcon("warning", "#fef2f2", "#ef4444");
    }
    if (notification.type === "event_approved") {
      return renderAdminIcon("checkmark-circle", "#ecfdf5", "#10b981");
    }
    if (notification.type === "event_rejected") {
      return renderAdminIcon("close-circle", "#fef2f2", "#ef4444");
    }

    // 5. Anonymous
    if (isAnon) {
      return (
        <View
          style={[
            styles.avatar,
            styles.anonymousAvatar,
            { backgroundColor: colors.skeleton, borderColor: colors.border },
          ]}
        >
          <Ionicons name="eye-off-outline" size={26} color="#9ca3af" />
        </View>
      );
    }

    // 6. Default: sender avatar
    return renderUserAvatar();
  };

  // ============================================
  // CONTAINER STYLE
  // ============================================

  const smallIcon = getSmallIconConfig();
  const formattedMessage = getFormattedMessage();

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

  // ============================================
  // RENDER
  // ============================================

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        <View style={containerStyle}>
          {/* Grouped layout (no avatar) */}
          {isGrouped ? (
            <View style={styles.contentContainer}>{formattedMessage}</View>
          ) : (
            <>
              {/* Avatar */}
              <View style={styles.avatarWrapper}>
                <TouchableOpacity
                  onPress={() => {
                    if (showCommunityImage && notification.targetId) {
                      router.push({
                        pathname: "/screens/CommunityScreen",
                        params: { communityId: notification.targetId },
                      });
                    } else if (!adminNotif && !isAnon) {
                      router.push(`/profile/${notification.sender._id}`);
                    }
                  }}
                  disabled={adminNotif || isAnon}
                >
                  {renderAvatar()}
                </TouchableOpacity>
                {/* Small icon overlay */}
                {!adminNotif &&
                  !showCommunityImage &&
                  !isInviteFromCommunity && (
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

              {/* Content */}
              <View style={styles.contentContainer}>
                {formattedMessage}
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {getTimeAgo(notification.createdAt)}
                </Text>
              </View>

              {/* Unread indicator */}
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

          {/* Options button */}
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

        {/* Options menu */}
        {showOptions && (
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
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================
// STYLES
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
  avatar: { width: 52, height: 52, borderRadius: 26 },
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
    color: "inherit",
  },
  commentContent: { fontFamily: "SofiaSans-Regular", fontStyle: "italic" },
  removedTitle: { fontSize: 15, fontFamily: "SofiaSans-Bold", marginBottom: 2 },
  time: { fontSize: 11, fontFamily: "SofiaSans-Regular", marginTop: 2 },
  unreadIndicator: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
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
  optionText: { fontSize: 13, fontFamily: "SofiaSans-Regular" },
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
  stackedAvatar: { width: 36, height: 36, borderRadius: 18 },
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
