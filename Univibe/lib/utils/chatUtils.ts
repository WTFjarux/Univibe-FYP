import { profileService } from "../services/profileService";

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

export const getInitials = (name: string): string => {
  return name?.charAt(0)?.toUpperCase() || "?";
};

export const getAvatarUrl = (avatar: string | undefined): string => {
  if (!avatar) return "";
  return profileService.getFullImageUrl(avatar);
};