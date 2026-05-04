// app/lib/utils/chatUtils.ts

import { profileService } from "../services/profileService";
import { API_BASE_URL } from "../../constants/ipConstants";

// ============================================
// ROOM ID GENERATION
// ============================================

/**
 * Generate a deterministic direct message room ID from two user IDs.
 * Format: direct_<smaller_id>_<larger_id>
 * Always produces the same ID for the same pair of users.
 */
export const getDirectRoomId = (id1: string, id2: string): string => {
  const ids = [id1.toString(), id2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

/**
 * Generate a unique group room ID.
 * Format: group_<timestamp>_<random_string>
 */
export const generateGroupRoomId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `group_${timestamp}_${random}`;
};

/**
 * Check if a room ID belongs to a direct chat.
 */
export const isDirectRoom = (roomId: string): boolean => {
  return roomId?.startsWith("direct_") ?? false;
};

/**
 * Check if a room ID belongs to a group chat.
 */
export const isGroupRoom = (roomId: string): boolean => {
  return roomId?.startsWith("group_") ?? false;
};

/**
 * Get the room type from a room ID.
 * Returns "direct", "group", or "unknown".
 */
export const getRoomTypeFromId = (
  roomId: string,
): "direct" | "group" | "unknown" => {
  if (!roomId) return "unknown";
  if (roomId.startsWith("direct_")) return "direct";
  if (roomId.startsWith("group_")) return "group";
  return "unknown";
};

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Format time for chat list preview (Today: HH:MM, Yesterday, or Date)
 */
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 24) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (hours < 48) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Full message timestamp used inside chat bubbles
 * Today: HH:MM | Yesterday HH:MM | Date HH:MM
 */
export const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/**
 * Date separator label between message groups
 * Today | Yesterday | Day, Month Day, Year
 */
export const formatDateSeparator = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// ============================================
// DATE/TIME HELPERS
// ============================================

/**
 * Check if two ISO date strings fall on different calendar days
 */
export const isNewDay = (date1: string, date2: string): boolean => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getDate() !== d2.getDate() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getFullYear() !== d2.getFullYear()
  );
};

/**
 * Calculate absolute time difference between two dates in minutes
 */
export const getTimeDifferenceInMinutes = (
  date1: string,
  date2: string,
): number => {
  return (
    Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) /
    (1000 * 60)
  );
};

/**
 * Check if a date is today
 */
export const isToday = (dateString: string): boolean => {
  const date = new Date(dateString);
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

/**
 * Check if a date is yesterday
 */
export const isYesterday = (dateString: string): boolean => {
  const date = new Date(dateString);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
};

// ============================================
// IMAGE/AVATAR HELPERS
// ============================================

/**
 * Build full image URL from relative or partial URL
 */
export const getFullImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads")) return `${API_BASE_URL}${url}`;
  if (url.startsWith("uploads")) return `${API_BASE_URL}/${url}`;
  return `${API_BASE_URL}/uploads/${url}`;
};

/**
 * Get user initials from name (first character, uppercase)
 */
export const getInitials = (name: string): string => {
  return name?.charAt(0)?.toUpperCase() || "?";
};

/**
 * Get avatar URL from avatar string (null-safe)
 */
export const getAvatarUrl = (avatar: string | null | undefined): string => {
  if (!avatar) return "";
  return profileService.getFullImageUrl(avatar);
};

/**
 * Get group display icon - returns group icon URL or empty string
 */
export const getGroupIcon = (icon: string | null | undefined): string => {
  if (!icon) return "";
  return getFullImageUrl(icon);
};

/**
 * Get display avatar for a chat room (group or direct)
 */
export const getChatRoomAvatar = (room: {
  type: string;
  groupIcon?: string | null;
  otherUserAvatar?: string | null;
}): string => {
  if (room.type === "group") {
    return room.groupIcon || "";
  }
  return room.otherUserAvatar || "";
};

// ============================================
// ROOM / MESSAGE HELPERS
// ============================================

/**
 * Extract the other user's ID from a direct-message room ID.
 * ONLY works for direct chat room IDs (format: direct_user1_user2).
 * Returns empty string for group room IDs to prevent invalid ObjectId errors.
 *
 * @param roomId - Room identifier (e.g., "direct_abc123_def456")
 * @param currentUserId - Current user's MongoDB ObjectId
 * @returns The other user's ID, or empty string if not a direct room
 */
export const extractOtherUserIdFromRoomId = (
  roomId: string,
  currentUserId: string,
): string => {
  if (!roomId || !currentUserId) return "";

  // ✅ Only extract from direct chat room IDs
  if (!roomId.startsWith("direct_")) return "";

  const parts = roomId.split("_");
  if (parts.length >= 3) {
    const user1 = parts[1];
    const user2 = parts[2];
    return user1 === currentUserId ? user2 : user1;
  }

  return "";
};

/**
 * Get sender ID from a message object (handles both string and object sender)
 */
export const getSenderId = (message: {
  sender: string | { _id: string };
}): string => {
  return typeof message.sender === "string"
    ? message.sender
    : message.sender?._id || "";
};

/**
 * Get sender name from a message object (handles both string and object sender)
 */
export const getSenderName = (message: {
  sender: string | { _id: string; name?: string };
  senderName?: string;
}): string => {
  if (message.senderName) return message.senderName;
  if (typeof message.sender === "object" && message.sender?.name) {
    return message.sender.name;
  }
  return "Unknown";
};

// ============================================
// REPLY / TYPE DETECTION
// ============================================

/**
 * Detect the type of a replied message for display purposes
 */
export const detectReplyType = (replyTo: {
  type?: string;
  message?: string;
  mediaUrl?: string;
}): string => {
  if (replyTo.type) return replyTo.type;
  if (
    replyTo.message === "Voice message" ||
    replyTo.mediaUrl?.includes("audio")
  )
    return "audio";
  if (replyTo.message === "Photo" || replyTo.mediaUrl?.includes("image"))
    return "image";
  if (replyTo.message?.startsWith("Location")) return "location";
  if (replyTo.message === "Video" || replyTo.mediaUrl?.includes("video"))
    return "video";
  return "text";
};

// ============================================
// MESSAGE CONTENT HELPERS
// ============================================

/**
 * Get display text for a message based on its type
 */
export const getMessageDisplayText = (
  type: string,
  message: string,
): string => {
  switch (type) {
    case "audio":
      return "Sent a Voice message";
    case "image":
      return "Sent a Photo";
    case "video":
      return "Sent a Video Video";
    case "file":
      return "Sent a File";
    case "location":
      return "Sent Location";
    case "post":
      return message || "Shared a post";
    default:
      return message || "";
  }
};

/**
 * Check if a message type is a media type
 */
export const isMediaMessage = (type: string): boolean => {
  return ["image", "video", "audio", "file"].includes(type);
};

/**
 * Truncate message for preview (used in reply indicators and chat list)
 */
export const truncateMessage = (
  message: string,
  maxLength: number = 100,
): string => {
  if (!message) return "";
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + "...";
};

/**
 * Format group member count for display.
 * Shows "99+" for large groups.
 */
export const formatMemberCount = (count: number): string => {
  if (count === 0) return "No members";
  if (count === 1) return "1 member";
  if (count > 99) return "99+ members";
  return `${count} members`;
};

/**
 * Get role display label with proper capitalization.
 */
export const getRoleLabel = (role: string): string => {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "member":
      return "Member";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

/**
 * Get role badge color based on role.
 */
export const getRoleColor = (role: string): string => {
  switch (role) {
    case "owner":
      return "#F59E0B"; // Amber
    case "admin":
      return "#8b5cf6"; // Purple
    case "member":
    default:
      return "#8E8E93"; // Gray
  }
};

/**
 * Format last seen time for user online status display.
 */
export const formatLastSeen = (dateString: string): string => {
  if (!dateString) return "Offline";

  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60),
  );

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};
