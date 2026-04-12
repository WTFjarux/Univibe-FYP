// app/components/chat/ChatHeader.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

interface ChatHeaderProps {
  userName: string;
  userAvatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  onCallPress?: () => void;
  onVideoCallPress?: () => void;
  onBackPress?: () => void;
}

const formatLastSeen = (lastSeen?: Date, isOnline?: boolean): string => {
  if (isOnline) return "Active now";
  if (!lastSeen) return "Offline";

  const now = new Date();
  const diff = now.getTime() - lastSeen.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Active just now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days < 7) return `Active ${days}d ago`;
  return `Last seen ${lastSeen.toLocaleDateString()}`;
};

const getInitials = (name: string): string => {
  return name.charAt(0).toUpperCase();
};

export default function ChatHeader({
  userName,
  userAvatar,
  isOnline,
  lastSeen,
  onCallPress,
  onVideoCallPress,
  onBackPress,
}: ChatHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <LinearGradient colors={["#fff", "#f8f9fa"]} style={styles.header}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/profile/${userName}`)}
        >
          <View style={styles.avatarContainer}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getInitials(userName)}</Text>
              </View>
            )}
            {isOnline && <View style={styles.onlineDot} />}
          </View>

          <View style={styles.userTextInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={styles.userStatus}>
              {formatLastSeen(lastSeen, isOnline)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={onCallPress}>
            <Ionicons name="call-outline" size={22} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onVideoCallPress}
          >
            <Ionicons name="videocam-outline" size={22} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    paddingTop: Platform.OS === "ios" ? 8 : 12,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    padding: 4,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  userStatus: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
});
