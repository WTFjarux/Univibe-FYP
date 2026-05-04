// app/components/chat/ChatMessage/ChatHeader.tsx

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../../../../constants/ipConstants";

interface ChatHeaderProps {
  otherUserName: string;
  otherUserId: string;
  otherUserAvatar?: string;
  isOnline: boolean;
  DEFAULT_AVATAR: any;
  getFullImageUrl: (url: string) => string;
  isGroup?: boolean;
  participantCount?: number;
  onGroupInfoPress?: () => void;
  groupPhoto?: string | null; // ✅ Add this
}

export default function ChatHeader({
  otherUserName,
  otherUserId,
  otherUserAvatar,
  isOnline,
  DEFAULT_AVATAR,
  getFullImageUrl,
  isGroup = false,
  participantCount,
  onGroupInfoPress,
  groupPhoto, // ✅ Add this
}: ChatHeaderProps) {
  const router = useRouter();

  // Build group image URL
  const getGroupImageSource = () => {
    if (!groupPhoto) return null;
    const url = groupPhoto.startsWith("http")
      ? groupPhoto
      : groupPhoto.startsWith("/uploads")
        ? `${API_BASE_URL.replace("/api", "")}${groupPhoto}`
        : `${API_BASE_URL.replace("/api", "")}/uploads/${groupPhoto}`;
    return { uri: url };
  };

  const groupImageSource = isGroup ? getGroupImageSource() : null;

  // Avatar source for direct chats
  const getAvatarSource = () => {
    if (otherUserAvatar) {
      const fullUrl = getFullImageUrl(otherUserAvatar);
      if (fullUrl) return { uri: fullUrl };
    }
    return DEFAULT_AVATAR;
  };

  const handleInfoPress = () => {
    if (isGroup && onGroupInfoPress) {
      onGroupInfoPress();
    } else if (!isGroup && otherUserId) {
      router.push(`/profile/${otherUserId}`);
    }
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#007AFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerUserInfo} onPress={handleInfoPress}>
        <View style={styles.headerAvatar}>
          {isGroup ? (
            groupImageSource ? (
              // ✅ Show group photo
              <Image
                source={groupImageSource}
                style={styles.headerAvatarImage}
              />
            ) : (
              // ✅ Fallback to people icon
              <View style={[styles.headerAvatarImage, styles.groupAvatar]}>
                <Ionicons name="people" size={22} color="#007AFF" />
              </View>
            )
          ) : (
            <Image
              source={getAvatarSource()}
              style={styles.headerAvatarImage}
            />
          )}
          {!isGroup && isOnline && <View style={styles.headerOnlineDot} />}
        </View>
        <View>
          <Text style={styles.headerName}>{otherUserName}</Text>
          <Text style={styles.headerStatus}>
            {isGroup
              ? participantCount
                ? `${participantCount} member${participantCount !== 1 ? "s" : ""}`
                : "Group"
              : isOnline
                ? "Active now"
                : "Offline"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        {isGroup ? (
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleInfoPress}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#007AFF"
            />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.headerAction}>
              <Ionicons name="call-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerAction}>
              <Ionicons name="videocam-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </>
        )}
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
    backgroundColor: "#eeeeee",
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
  groupAvatar: {
    justifyContent: "center",
    alignItems: "center",
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
