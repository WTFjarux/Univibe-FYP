// lib/utils/chatUtils.ts

import { profileService } from "../services/profileService";
import { API_BASE_URL } from "../../constants/ipConstants";

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
export const getTimeDifferenceInMinutes = (date1: string, date2: string): number => {
  return Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) / (1000 * 60);
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

// ============================================
// ROOM / MESSAGE HELPERS
// ============================================

/**
 * Extract the other user's ID from a direct-message room ID
 * Room ID format: dm_user1_user2 or user1_user2
 */
export const extractOtherUserIdFromRoomId = (roomId: string, currentUserId: string): string => {
  if (!roomId || !currentUserId) return "";
  const parts = roomId.split("_");
  if (parts.length >= 3) {
    return parts[1] === currentUserId ? parts[2] : parts[1];
  }
  return "";
};

/**
 * Get sender ID from a message object (handles both string and object sender)
 */
export const getSenderId = (message: { sender: string | { _id: string } }): string => {
  return typeof message.sender === "string" ? message.sender : message.sender?._id || "";
};

// ============================================
// REPLY / TYPE DETECTION
// ============================================

/**
 * Detect the type of a replied message for display purposes
 */
export const detectReplyType = (
  replyTo: { type?: string; message?: string; mediaUrl?: string }
): string => {
  if (replyTo.type) return replyTo.type;
  if (replyTo.message === "🎤 Voice message" || replyTo.mediaUrl?.includes("audio")) return "audio";
  if (replyTo.message === "📷 Photo" || replyTo.mediaUrl?.includes("image")) return "image";
  if (replyTo.message?.startsWith("📍")) return "location";
  if (replyTo.message === "🎥 Video" || replyTo.mediaUrl?.includes("video")) return "video";
  return "text";
};

// ============================================
// MESSAGE CONTENT HELPERS
// ============================================

/**
 * Get display text for a message based on its type
 */
export const getMessageDisplayText = (type: string, message: string): string => {
  switch (type) {
    case "audio":
      return "🎤 Voice message";
    case "image":
      return "📷 Photo";
    case "video":
      return "🎥 Video";
    case "file":
      return "📎 File";
    case "location":
      return "📍 Location";
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
 * Truncate message for preview (used in reply indicators)
 */
export const truncateMessage = (message: string, maxLength: number = 100): string => {
  if (!message) return "";
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + "...";
};