// app/components/Notifications/pendingRequestItem.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { API_BASE_URL } from "@/constants/ipConstants";

// Default avatar from assets
const DEFAULT_AVATAR = require("../../../assets/images/default-avatar.png");

interface PendingRequestItemProps {
  request: {
    _id: string;
    name: string;
    username: string;
    fullName?: string;
    profilePicture?: string;
  };
  onAccept: (id: string, name: string) => void;
  onReject: (id: string, name: string) => void;
  isProcessing?: boolean;
}

export default function PendingRequestItem({
  request,
  onAccept,
  onReject,
  isProcessing = false,
}: PendingRequestItemProps) {
  const displayName = request.fullName || request.name;
  const displayUsername = request.username.startsWith("@")
    ? request.username
    : `@${request.username}`;

  /**
   * Get full image URL for profile picture
   */
  const getFullImageUrl = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
    return `${API_BASE_URL}/${url}`;
  };

  /**
   * Get avatar source
   */
  const getAvatarSource = () => {
    if (request.profilePicture && request.profilePicture.trim() !== "") {
      return { uri: getFullImageUrl(request.profilePicture) };
    }
    return DEFAULT_AVATAR;
  };

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={() => router.push(`/profile/${request._id}`)}
        disabled={isProcessing}
      >
        <Image source={getAvatarSource()} style={styles.avatar} />
      </TouchableOpacity>

      {/* Info */}
      <TouchableOpacity
        style={styles.infoContainer}
        onPress={() => router.push(`/profile/${request._id}`)}
        disabled={isProcessing}
      >
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.username}>{displayUsername}</Text>
        <Text style={styles.requestText}>wants to connect with you</Text>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => onAccept(request._id, displayName)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="checkmark" size={20} color="white" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => onReject(request._id, displayName)}
          disabled={isProcessing}
        >
          <Ionicons name="close" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f3f4f6",
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  username: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 2,
  },
  requestText: {
    fontSize: 12,
    color: "#8b5cf6",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: "#10b981",
  },
  rejectButton: {
    backgroundColor: "#fee2e2",
  },
});
