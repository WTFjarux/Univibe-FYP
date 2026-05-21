// app/components/chat/ChatList/ChatItem.tsx

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import { getAvatarUrl, formatTime } from "../../../../lib/utils/chatUtils";
import type { ChatRoom } from "../../../../lib/types/chat.types";
import { API_BASE_URL } from "../../../../constants/ipConstants";

const DEFAULT_AVATAR = require("../../../../assets/images/default-avatar.png");

export interface ChatItemProps {
  item: ChatRoom;
  isSelected: boolean;
  highlightAnim: Animated.Value | null;
  isHighlighted: boolean;
  itemScaleAnim: Animated.Value;
  itemTranslateYAnim: Animated.Value;
  onPress: () => void;
  onLongPress: (
    item: ChatRoom,
    layout: { y: number; height: number; pageX: number; pageY: number },
  ) => void;
  isUnread?: boolean;
  currentUserId?: string;
  disableSelectedStyle?: boolean;
}

const ChatItem: React.FC<ChatItemProps> = ({
  item,
  isSelected,
  highlightAnim,
  isHighlighted,
  onPress,
  onLongPress,
  isUnread: isUnreadProp,
  currentUserId,
  disableSelectedStyle = false,
}) => {
  const rowRef = useRef<View>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { colors, isDark } = useTheme();

  const isGroup = item.type === "group";
  const isMuted = item.isMuted === true;

  const isUnread =
    isUnreadProp !== undefined
      ? isUnreadProp
      : !!item.lastMessage &&
        item.lastMessage.senderId !== currentUserId &&
        !item.lastMessage.readBy.includes(currentUserId || "");

  const isLastMessageFromMe = !!(
    item.lastMessage?.senderId &&
    currentUserId &&
    item.lastMessage.senderId.toString() === currentUserId.toString()
  );

  const buildImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const base = API_BASE_URL.replace("/api", "");
    if (url.startsWith("/uploads")) return `${base}${url}`;
    return `${base}/uploads/${url}`;
  };

  const getGroupAvatarSource = () => {
    if (avatarError) return null;
    const url = buildImageUrl(item.groupPhoto) || buildImageUrl(item.groupIcon);
    return url ? { uri: url } : null;
  };

  const getDirectAvatarSource = () => {
    if (avatarError) return DEFAULT_AVATAR;
    const avatarUrl = getAvatarUrl(item.otherUserAvatar);
    if (avatarUrl) return { uri: avatarUrl };
    return DEFAULT_AVATAR;
  };

  const groupAvatarSource = isGroup ? getGroupAvatarSource() : null;
  const showGroupImage = isGroup && groupAvatarSource !== null;

  const getLastMessageText = (): string => {
    if (!item.lastMessage) return isGroup ? "Group created" : "No messages yet";
    const { type, message, senderName } = item.lastMessage;
    let displayMessage = message;
    switch (type) {
      case "audio":
        displayMessage = "🎤 Voice message";
        break;
      case "image":
        displayMessage = "📷 Photo";
        break;
      case "video":
        displayMessage = "🎬 Video";
        break;
      case "file":
        displayMessage = "📎 File";
        break;
      case "location":
        displayMessage = "📍 Location";
        break;
      case "post":
        displayMessage = message || "Shared a post";
        break;
    }
    if (isGroup && senderName && !isLastMessageFromMe)
      return `${senderName.split(" ")[0]}: ${displayMessage}`;
    if (isLastMessageFromMe) return `You: ${displayMessage}`;
    return displayMessage || "";
  };

  const highlightBackground =
    isHighlighted && highlightAnim
      ? highlightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [
            "transparent",
            isDark ? "rgba(167, 139, 250, 0.15)" : "rgba(139, 92, 246, 0.12)",
          ],
        })
      : "transparent";

  const handleLongPress = () => {
    setIsPressed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      if (rowRef.current) {
        rowRef.current.measure((_x, _y, _w, height, pageX, pageY) => {
          if (pageY > 0 && height > 0) {
            onLongPress(item, { y: pageY, height, pageX, pageY });
          }
        });
      }
    }, 50);
  };

  return (
    <Animated.View style={{ backgroundColor: highlightBackground }}>
      <Animated.View
        ref={rowRef}
        style={[
          styles.wrapper,
          isSelected && !disableSelectedStyle && styles.wrapperSelected,
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: colors.border },
            pressed &&
              !isPressed && {
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.08)"
                  : "rgba(139, 92, 246, 0.04)",
              },
          ]}
          onPress={onPress}
          onPressIn={() => setIsPressed(false)}
          onLongPress={handleLongPress}
          delayLongPress={300}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {isGroup ? (
              showGroupImage ? (
                <Image
                  source={groupAvatarSource!}
                  style={[
                    styles.avatar,
                    { backgroundColor: colors.skeleton },
                    item.isPinned && {
                      borderWidth: 2,
                      borderColor: colors.primary,
                    },
                  ]}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.groupAvatar,
                    {
                      backgroundColor: isDark
                        ? "rgba(167, 139, 250, 0.15)"
                        : "#F5F3FF",
                      borderColor: isDark
                        ? "rgba(167, 139, 250, 0.3)"
                        : "#EDE9FE",
                    },
                  ]}
                >
                  <Ionicons name="people" size={24} color={colors.primary} />
                </View>
              )
            ) : (
              <Image
                source={getDirectAvatarSource()}
                style={[
                  styles.avatar,
                  { backgroundColor: colors.skeleton },
                  item.isPinned && {
                    borderWidth: 2,
                    borderColor: colors.primary,
                  },
                ]}
                onError={() => setAvatarError(true)}
              />
            )}

            {isMuted && (
              <View style={[styles.mutedBadge, { borderColor: colors.card }]}>
                <Ionicons name="volume-mute" size={12} color="#fff" />
              </View>
            )}

            {isUnread && (
              <View
                style={[
                  styles.unreadDot,
                  { backgroundColor: colors.primary, borderColor: colors.card },
                ]}
              />
            )}
          </View>

          {/* Content */}
          <View style={styles.info}>
            <View style={styles.headerRow}>
              <View style={styles.nameRow}>
                {isGroup && (
                  <Ionicons
                    name="people-outline"
                    size={14}
                    color={colors.textSecondary}
                    style={styles.groupIcon}
                  />
                )}
                {item.isPinned && !isGroup && (
                  <Ionicons
                    name="pin"
                    size={14}
                    color={colors.primary}
                    style={styles.pinIcon}
                  />
                )}
                <Text
                  style={[
                    styles.name,
                    { color: colors.text },
                    isUnread && styles.nameUnread,
                    isGroup && styles.groupName,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>
            </View>

            <View style={styles.messageRow}>
              {isMuted && (
                <Ionicons
                  name="volume-mute"
                  size={14}
                  color={colors.textMuted}
                  style={styles.muteIcon}
                />
              )}
              <Text
                style={[
                  styles.lastMessage,
                  { color: colors.textSecondary },
                  isUnread && {
                    color: colors.text,
                    fontWeight: "500",
                    fontFamily: "SofiaSans-Medium",
                  },
                  isMuted && { color: colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {getLastMessageText()}
              </Text>
              {item.lastMessage && (
                <Text
                  style={[
                    styles.time,
                    { color: colors.textSecondary },
                    isUnread && {
                      color: colors.primary,
                      fontWeight: "600",
                      fontFamily: "SofiaSans-SemiBold",
                    },
                  ]}
                >
                  {formatTime(item.lastMessage.sentAt)}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

const MemoizedChatItem = React.memo(ChatItem, (prev, next) => {
  return (
    prev.item.roomId === next.item.roomId &&
    prev.item.lastMessage?.message === next.item.lastMessage?.message &&
    prev.item.lastMessage?.sentAt === next.item.lastMessage?.sentAt &&
    prev.item.lastMessage?.senderName === next.item.lastMessage?.senderName &&
    prev.isUnread === next.isUnread &&
    prev.isSelected === next.isSelected &&
    prev.isHighlighted === next.isHighlighted &&
    prev.item.isPinned === next.item.isPinned &&
    prev.item.isMuted === next.item.isMuted &&
    prev.item.participantCount === next.item.participantCount &&
    prev.item.groupPhoto === next.item.groupPhoto
  );
});

export { ChatItem, MemoizedChatItem };
export default MemoizedChatItem;

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 0, width: "100%" },
  wrapperSelected: { backgroundColor: "transparent" },
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    width: "100%",
  },
  avatarContainer: { marginRight: 14, position: "relative" },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  groupAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  mutedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#8E8E93",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  info: { flex: 1, justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  groupIcon: { marginRight: 2 },
  pinIcon: { marginRight: 2 },
  name: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
    flex: 1,
  },
  groupName: { fontSize: 15 },
  nameUnread: { fontWeight: "700", fontFamily: "SofiaSans-Bold" },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  muteIcon: { marginRight: 2 },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  time: {
    fontSize: 12,
    marginLeft: 8,
    fontFamily: "SofiaSans-Regular",
  },
});
