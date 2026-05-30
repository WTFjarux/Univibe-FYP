// lib/types/inAppNotification.ts

// ============================================
// IN-APP TOAST NOTIFICATION SYSTEM TYPES
// Lightweight types for real-time toast banners
// Separate from backend Notification (notificationService.ts)
// ============================================

// Toast categories for icon & color mapping
export enum ToastType {
  MESSAGE = "message",
  LIKE = "like",
  COMMENT = "comment",
  REPLY = "reply",
  EVENT = "event",
  CONNECTION = "connection",
  COMMUNITY = "community",
}

// Community metadata for toast display
export interface ToastCommunityMetadata {
  communityId?: string;
  communityName?: string;
  communityImage?: string | null;
}

// The data that flows through the toast system
export interface InAppNotification {
  id: string;
  type: ToastType;
  title: string;
  body: string;
  senderName?: string;
  senderAvatar?: string;
  isGroupMessage?: boolean;

  // ✅ Community metadata for toast display
  metadata?: ToastCommunityMetadata;

  // Where to navigate on tap
  navigationTarget?: {
    screen: string;
    params?: Record<string, any>;
  };

  // Conditions to suppress this toast
  suppressIf?: {
    activeRoomId?: string; // Don't show if user is viewing this chat room
    senderId?: string; // Don't show if sender is current user
  };

  timestamp: number; // Date.now()
}

// What the context exposes to consumers
export interface InAppNotificationContextType {
  currentToast: InAppNotification | null;
  isVisible: boolean;
  showToast: (notification: InAppNotification) => void;
  hideToast: () => void;
}

// Internal queue item
export interface QueueItem {
  notification: InAppNotification;
  showAfter: number; // timestamp
}

// ============================================
// CONSTANTS
// ============================================

export const TOAST_CONFIG = {
  SLIDE_IN_DURATION: 300,
  SLIDE_OUT_DURATION: 250,
  AUTO_HIDE_DELAY: 3000, // 3 seconds visible
  GAP_BETWEEN_TOASTS: 400, // 0.4s between queued toasts
  MAX_QUEUE_SIZE: 10,
} as const;

// ============================================
// MAPPER: Backend notification type → Toast type
// ============================================

export function mapBackendTypeToToastType(
  backendType: string,
): ToastType | null {
  switch (backendType) {
    case "like":
      return ToastType.LIKE;
    case "comment":
      return ToastType.COMMENT;
    case "mention":
      return ToastType.REPLY;
    case "connection_request":
    case "connection_accepted":
      return ToastType.CONNECTION;
    case "event_interest":
    case "event_rsvp":
    case "event_approved":
    case "event_rejected":
      return ToastType.EVENT;

    // community types
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
      return ToastType.COMMUNITY;
    default:
      return null;
  }
}
