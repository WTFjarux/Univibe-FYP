// app/hooks/useInAppNotifications.ts

import { useEffect, useRef } from "react";
import { Image } from "expo-image";
import socketService from "../lib/services/socketService";
import { useInAppNotification } from "../lib/contexts/InAppNotificationContext";
import { useActiveRoom } from "../lib/contexts/ActiveRoomContext";
import { useAuth } from "../lib/contexts/AuthContext";
import {
  InAppNotification,
  ToastType,
  mapBackendTypeToToastType,
} from "../lib/types/inAppNotification";
import type { Message } from "../lib/types/chat.types";
import { API_BASE_URL } from "../constants/ipConstants";

// ============================================
// HELPERS
// ============================================

const getFullImageUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
};

const generateToastId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getSenderId = (message: Message): string => {
  if (typeof message.sender === "string") return message.sender;
  return (message.sender as any)?._id || "";
};

const getMessagePreview = (message: Message): string => {
  const msgType = message.type;
  if (msgType === "text")
    return (message as any).message?.substring(0, 100) || "";
  switch (msgType) {
    case "image":
      return "Sent an image";
    case "audio":
      return "Sent a voice message";
    case "video":
      return "Sent a video";
    case "file":
      return "Sent a file";
    case "location":
      return "Shared a location";
    case "post":
      return "Shared a post";
    default:
      return "New message";
  }
};

const prefetchImage = (url?: string) => {
  if (url) Image.prefetch(url);
};

// ============================================
// NOTIFICATION TYPE CATEGORIES
// ============================================

/** Show COMMUNITY IMAGE in toaster for these types */
const TOAST_COMMUNITY_IMAGE_TYPES = [
  "community_approved",
  "community_rejected",
  "join_approved",
  "join_rejected",
  "member_removed",
  "role_updated",
  "invitation_pending",
  "invitation_accepted",
  "invitation_approved",
  "invitation_rejected",
];

/** Show SENDER AVATAR in toaster for these types */
const TOAST_USER_AVATAR_TYPES = ["member_joined", "join_request"];

// ============================================
// HOOK
// ============================================

export const useInAppNotifications = () => {
  const { showToast } = useInAppNotification();
  const { activeRoomId } = useActiveRoom();
  const { user } = useAuth();

  const activeRoomIdRef = useRef(activeRoomId);
  const userIdRef = useRef(user?.id);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    if (!user?.id) return;

    // ── 1. NEW MESSAGE ──────────────────────────────────
    const handleNewMessage = (message: Message) => {
      const currentUserId = userIdRef.current;
      const currentActiveRoom = activeRoomIdRef.current;
      const senderId = getSenderId(message);

      if (senderId === currentUserId) return;
      if (currentActiveRoom === message.roomId) return;

      const senderName =
        (message as any).senderName ||
        (typeof message.sender === "object"
          ? (message.sender as any)?.name
          : undefined) ||
        "Someone";

      const senderAvatar =
        (message as any).senderAvatar ||
        (typeof message.sender === "object"
          ? (message.sender as any)?.avatar
          : undefined);

      const isGroupMessage = !!(
        (message as any).isGroup === true ||
        (message as any).roomType === "group" ||
        (message.roomId && !message.roomId.startsWith("direct_"))
      );

      const groupName = isGroupMessage
        ? (message as any).groupName ||
          (message as any).roomName ||
          "Group Chat"
        : undefined;

      const groupPhoto = isGroupMessage
        ? (message as any).groupPhoto || (message as any).roomPhoto || undefined
        : undefined;

      const participantCount = isGroupMessage
        ? (message as any).participantCount || 0
        : 0;

      const navParams: Record<string, string> = { roomId: message.roomId };
      if (isGroupMessage) {
        navParams.isGroup = "true";
        navParams.otherUserId = "";
        navParams.otherUserName = groupName || senderName;
        navParams.participantCount = participantCount.toString();
        if (groupPhoto) navParams.groupPhoto = groupPhoto;
      } else {
        navParams.otherUserId = senderId;
        navParams.otherUserName = senderName;
      }

      const toast: InAppNotification = {
        id: `msg_${message.roomId}`,
        type: ToastType.MESSAGE,
        title: isGroupMessage ? groupName || "Group Chat" : senderName,
        body: isGroupMessage
          ? `${senderName}: ${getMessagePreview(message)}`
          : getMessagePreview(message),
        senderName,
        senderAvatar: isGroupMessage
          ? getFullImageUrl(groupPhoto) || getFullImageUrl(senderAvatar)
          : getFullImageUrl(senderAvatar),
        isGroupMessage,
        navigationTarget: { screen: "/screens/ChatScreen", params: navParams },
        suppressIf: { activeRoomId: message.roomId, senderId },
        timestamp: Date.now(),
      };

      prefetchImage(toast.senderAvatar);
      showToastRef.current(toast);
    };

    // ── 2. BACKEND NOTIFICATIONS ────────────────────────
    const handleNewNotification = (data: any) => {
      // Extract notification object
      let notif;
      if (data?.notification) {
        notif = data.notification;
      } else if (data?.type) {
        notif = data;
      } else {
        return;
      }

      // Extract sender ID
      const senderId =
        typeof notif.sender === "object" ? notif.sender?._id : notif.sender;
      const currentUserId = userIdRef.current;

      // Skip own notifications
      if (senderId && senderId.toString() === currentUserId?.toString()) {
        return;
      }

      const toastType = mapBackendTypeToToastType(notif.type);
      if (!toastType) {
        return;
      }

      let body = notif.message || "";

      // Handle grouped like notifications
      if (
        notif.type === "like" &&
        notif.metadata?.isGrouped &&
        notif.metadata?.likers?.length
      ) {
        body = `${notif.metadata.likers[0].name} liked your post`;
      }

      const toastId = notif.targetId
        ? `${notif.type}_${notif.targetId}`
        : generateToastId(notif.type);

      // Extract sender info
      const senderName =
        typeof notif.sender === "object"
          ? notif.sender?.fullName || notif.sender?.name || "Someone"
          : "Someone";

      const senderProfilePic =
        typeof notif.sender === "object"
          ? notif.sender?.profilePicture
          : undefined;

      // ✅ Determine avatar and title based on notification type
      const isToastCommunityImage = TOAST_COMMUNITY_IMAGE_TYPES.includes(
        notif.type,
      );
      const isToastUserAvatar = TOAST_USER_AVATAR_TYPES.includes(notif.type);
      const isCommunityInvite = notif.type === "community_invite";

      // For community_invite: check if it's from admin/mod (community image) or member (user avatar)
      const isInviteFromCommunity =
        isCommunityInvite &&
        (notif.message?.includes("has invited you to join") ||
          notif.message?.includes("invited and added"));

      let avatar: string | undefined;
      let title: string;
      let displayName: string;

      if (
        isToastCommunityImage ||
        (isCommunityInvite && isInviteFromCommunity)
      ) {
        // Show community image
        avatar = getFullImageUrl(notif.metadata?.communityImage || undefined);
        title = notif.metadata?.communityName || notif.title || "";
        displayName = notif.metadata?.communityName || senderName;
      } else if (isToastUserAvatar || isCommunityInvite) {
        // Show user avatar (member_joined, join_request, community_invite from member)
        avatar = getFullImageUrl(senderProfilePic);
        title = notif.title || "";
        displayName = senderName;
      } else {
        // Default: show user avatar
        avatar = getFullImageUrl(senderProfilePic);
        title = notif.title || "";
        displayName = senderName;
      }

      const toast: InAppNotification = {
        id: toastId,
        type: toastType,
        title,
        body,
        senderName: displayName,
        senderAvatar: avatar,
        metadata: isToastCommunityImage
          ? {
              communityId: notif.metadata?.communityId,
              communityName: notif.metadata?.communityName,
              communityImage: notif.metadata?.communityImage,
            }
          : undefined,
        navigationTarget: getNavigationTarget(notif),
        suppressIf: { senderId },
        timestamp: Date.now(),
      };

      prefetchImage(toast.senderAvatar);
      showToastRef.current(toast);
    };

    // ── 3. CONNECTION REQUEST ───────────────────────────
    const handleConnectionRequest = (data: any) => {
      const currentUserId = userIdRef.current;
      if (data.sender?._id === currentUserId) return;

      const toast: InAppNotification = {
        id: generateToastId("connection"),
        type: ToastType.CONNECTION,
        title: "Connection Request",
        body: `${data.sender?.name || "Someone"} sent you a connection request`,
        senderName: data.sender?.name,
        senderAvatar: getFullImageUrl(data.sender?.profilePicture),
        navigationTarget: {
          screen: "/profile/[id]",
          params: { id: data.sender?._id },
        },
        suppressIf: { senderId: data.sender?._id },
        timestamp: Date.now(),
      };

      prefetchImage(toast.senderAvatar);
      showToastRef.current(toast);
    };

    // ── 4. EVENT NOTIFICATIONS ──────────────────────────
    const handleEventNotification = (data: any) => {
      const toast: InAppNotification = {
        id: generateToastId("event"),
        type: ToastType.EVENT,
        title: data.title || "Event Update",
        body: data.message || "An event has been updated",
        senderName: data.organizerName,
        navigationTarget: {
          screen: "/events/[id]",
          params: { id: data.eventId },
        },
        timestamp: Date.now(),
      };
      showToastRef.current(toast);
    };

    // ── 5. COMMUNITY UPDATES ────────────────────────────
    const handleCommunityUpdate = (data: any) => {};

    // ── REGISTER ────────────────────────────────────────
    socketService.on("receive_message", handleNewMessage);
    socketService.on("notification:new", handleNewNotification);
    socketService.on("connection_request", handleConnectionRequest);
    socketService.on("event:updated", handleEventNotification);
    socketService.on("community:updated", handleCommunityUpdate);

    return () => {
      socketService.off("receive_message", handleNewMessage);
      socketService.off("notification:new", handleNewNotification);
      socketService.off("connection_request", handleConnectionRequest);
      socketService.off("event:updated", handleEventNotification);
      socketService.off("community:updated", handleCommunityUpdate);
    };
  }, [user?.id]);
};

// ============================================
// NAVIGATION TARGET HELPER
// ============================================

function getNavigationTarget(
  notification: any,
): InAppNotification["navigationTarget"] {
  switch (notification.type) {
    case "like":
    case "comment":
    case "mention":
      if (notification.targetId) {
        return {
          screen: "/post/[id]",
          params: {
            id: notification.targetId,
            openComments: notification.type === "comment" ? "true" : undefined,
          },
        };
      }
      return { screen: "/(tabs)/feed" };

    case "connection_request":
    case "connection_accepted": {
      const senderId =
        typeof notification.sender === "object"
          ? notification.sender?._id
          : notification.sender;
      return { screen: "/profile/[id]", params: { id: senderId } };
    }

    case "event_interest":
    case "event_rsvp":
    case "event_approved":
    case "event_rejected":
      if (notification.targetId)
        return {
          screen: "/events/[id]",
          params: { id: notification.targetId },
        };
      return { screen: "/(tabs)/events" };

    case "community_approved":
    case "community_rejected":
    case "join_request":
    case "join_approved":
    case "join_rejected":
    case "community_invite":
    case "invitation_pending":
    case "invitation_accepted":
    case "invitation_approved":
    case "invitation_rejected":
    case "member_joined":
    case "member_removed":
    case "role_updated":
      if (notification.targetId) {
        return {
          screen: "/screens/CommunityScreen",
          params: { communityId: notification.targetId },
        };
      }
      return { screen: "/screens/notifications" };

    default:
      return { screen: "/screens/notifications" };
  }
}

export default useInAppNotifications;
