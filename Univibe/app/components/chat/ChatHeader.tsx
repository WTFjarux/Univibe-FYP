// app/components/chat/ChatHeader.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface ChatHeaderProps {
  otherUserName: string;
  otherUserId: string;
  otherUserAvatar?: string;
  isOnline: boolean;
  DEFAULT_AVATAR: any;
  getFullImageUrl: (url: string) => string;
}

export default function ChatHeader({
  otherUserName,
  otherUserId,
  otherUserAvatar,
  isOnline,
  DEFAULT_AVATAR,
  getFullImageUrl,
}: ChatHeaderProps) {
  const router = useRouter();

  // Use the passed avatar directly
  const avatarUrl = otherUserAvatar ? getFullImageUrl(otherUserAvatar) : "";

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#007AFF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerUserInfo}
        onPress={() => router.push(`/profile/${otherUserId}`)}
      >
        <View style={styles.headerAvatar}>
          <Image
            source={avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR}
            style={styles.headerAvatarImage}
          />
          {isOnline && <View style={styles.headerOnlineDot} />}
        </View>
        <View>
          <Text style={styles.headerName}>{otherUserName}</Text>
          <Text style={styles.headerStatus}>
            {isOnline ? "Active now" : "Offline"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => Alert.alert("Call", "Coming soon")}
        >
          <Ionicons name="call-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => Alert.alert("Video Call", "Coming soon")}
        >
          <Ionicons name="videocam-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  backButton: { padding: 4 },
  headerUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  headerAvatar: { position: "relative", marginRight: 12 },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  headerStatus: {
    fontSize: 12,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  headerActions: { flexDirection: "row", gap: 12 },
  headerAction: { padding: 4 },
});
