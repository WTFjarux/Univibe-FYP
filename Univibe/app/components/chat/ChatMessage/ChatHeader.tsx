// app/components/chat/ChatMessage/ChatHeader.tsx

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
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
  groupPhoto?: string | null;
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
  groupPhoto,
}: ChatHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

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
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color={colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerUserInfo} onPress={handleInfoPress}>
        <View style={styles.headerAvatar}>
          {isGroup ? (
            groupImageSource ? (
              <Image
                source={groupImageSource}
                style={[
                  styles.headerAvatarImage,
                  { backgroundColor: colors.skeleton },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.headerAvatarImage,
                  styles.groupAvatar,
                  { backgroundColor: colors.skeleton },
                ]}
              >
                <Ionicons name="people" size={22} color={colors.primary} />
              </View>
            )
          ) : (
            <Image
              source={getAvatarSource()}
              style={[
                styles.headerAvatarImage,
                { backgroundColor: colors.skeleton },
              ]}
            />
          )}
          {!isGroup && isOnline && (
            <View
              style={[styles.headerOnlineDot, { borderColor: colors.card }]}
            />
          )}
        </View>
        <View>
          <Text style={[styles.headerName, { color: colors.text }]}>
            {otherUserName}
          </Text>
          <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>
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
            onPress={handleInfoPress}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        ) : (
          <>
           
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
    borderBottomWidth: 1,
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
  },
  groupAvatar: {
    justifyContent: "center",
    alignItems: "center",
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
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
  },
  headerActions: { flexDirection: "row", gap: 12 },

});
