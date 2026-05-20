// ============================================
// IN-APP NOTIFICATION SOCKET LISTENERS
// ============================================

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
import type { Notification } from "../lib/services/notificationService";
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
  if (msgType === "text") {
    return (message as any).message?.substring(0, 100) || "";
  }
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
  if (url) {
    Image.prefetch(url);
  }
};

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

      // Suppress: own message
      if (senderId === currentUserId) return;
      // Suppress: already in this conversation
      if (currentActiveRoom === message.roomId) return;

      // Extract sender information
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

      // Detect if this is a group message
      const isGroupMessage = !!(
        (message as any).isGroup === true ||
        (message as any).roomType === "group" ||
        (message.roomId && !message.roomId.startsWith("direct_"))
      );

      // Extract group information from server payload
      const groupName = isGroupMessage
        ? (message as any).groupName ||
          (message as any).roomName ||
          (message as any).name ||
          "Group Chat"
        : undefined;

      const groupPhoto = isGroupMessage
        ? (message as any).groupPhoto ||
          (message as any).groupIcon ||
          (message as any).roomPhoto ||
          (message as any).roomIcon ||
          undefined
        : undefined;

      const participantCount = isGroupMessage
        ? (message as any).participantCount || 0
        : 0;

      // Build navigation params
      const navParams: Record<string, string> = {
        roomId: message.roomId,
      };

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

      // Determine toast title and body
      const toastTitle = isGroupMessage
        ? groupName || "Group Chat"
        : senderName;

      const toastBody = isGroupMessage
        ? `${senderName}: ${getMessagePreview(message)}`
        : getMessagePreview(message);

      // Determine avatar for toast
      const toastAvatar = isGroupMessage
        ? getFullImageUrl(groupPhoto) || getFullImageUrl(senderAvatar)
        : getFullImageUrl(senderAvatar);

      const toast: InAppNotification = {
        id: `msg_${message.roomId}`,
        type: ToastType.MESSAGE,
        title: toastTitle,
        body: toastBody,
        senderName,
        senderAvatar: toastAvatar,
        isGroupMessage,
        navigationTarget: {
          screen: "/screens/ChatScreen",
          params: navParams,
        },
        suppressIf: {
          activeRoomId: message.roomId,
          senderId,
        },
        timestamp: Date.now(),
      };

      prefetchImage(toast.senderAvatar);
      showToastRef.current(toast);
    };

    // ── 2. BACKEND NOTIFICATIONS ────────────────────────
    const handleNewNotification = (data: { notification: Notification }) => {
      const notif = data.notification;
      const currentUserId = userIdRef.current;

      if (notif.sender?._id === currentUserId) return;

      const toastType = mapBackendTypeToToastType(notif.type);
      if (!toastType) return;

      let body = notif.message;
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

      const toast: InAppNotification = {
        id: toastId,
        type: toastType,
        title: notif.title,
        body,
        senderName: notif.sender?.name,
        senderAvatar: getFullImageUrl(notif.sender?.profilePicture),
        navigationTarget: getNavigationTarget(notif),
        suppressIf: { senderId: notif.sender?._id },
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

    // ── REGISTER ────────────────────────────────────────
    socketService.on("receive_message", handleNewMessage);
    socketService.on("notification:new", handleNewNotification);
    socketService.on("connection_request", handleConnectionRequest);
    socketService.on("event:updated", handleEventNotification);

    // ── CLEANUP ─────────────────────────────────────────
    return () => {
      socketService.off("receive_message", handleNewMessage);
      socketService.off("notification:new", handleNewNotification);
      socketService.off("connection_request", handleConnectionRequest);
      socketService.off("event:updated", handleEventNotification);
    };
  }, [user?.id]);
};

// ============================================
// NAVIGATION TARGET HELPER
// ============================================

function getNavigationTarget(
  notification: Notification,
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
    case "connection_accepted":
      return {
        screen: "/profile/[id]",
        params: { id: notification.sender._id },
      };

    case "event_interest":
    case "event_rsvp":
    case "event_approved":
    case "event_rejected":
      if (notification.targetId) {
        return {
          screen: "/events/[id]",
          params: { id: notification.targetId },
        };
      }
      return { screen: "/(tabs)/events" };

    default:
      return { screen: "/screens/notifications" };
  }
}

export default useInAppNotifications;
