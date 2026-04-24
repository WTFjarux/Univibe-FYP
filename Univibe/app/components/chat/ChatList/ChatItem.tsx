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
import { getAvatarUrl, formatTime } from "../../../../lib/utils/chatUtils";
// ✅ Import centralized type instead of defining local one
import type { ChatRoom } from "../../../../lib/types/chat.types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// DEFAULT AVATAR
// ============================================

const DEFAULT_AVATAR = require("../../../../assets/images/default-avatar.png");

// ──────────────────────────────────────────────────────────────────────────────
// TYPES (no more ChatRoom duplicate!)
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENT (rest stays the same)
// ──────────────────────────────────────────────────────────────────────────────

const ChatItem: React.FC<ChatItemProps> = ({
  item,
  isSelected,
  highlightAnim,
  isHighlighted,
  itemScaleAnim,
  itemTranslateYAnim,
  onPress,
  onLongPress,
  isUnread: isUnreadProp,
  currentUserId,
  disableSelectedStyle = false,
}) => {
  // ... rest of component code stays exactly the same ...
  const rowRef = useRef<View>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isUnread =
    isUnreadProp !== undefined
      ? isUnreadProp
      : !!item.lastMessage &&
        item.lastMessage.senderId !== currentUserId &&
        !item.lastMessage.readBy.includes(currentUserId || "");

  const isMuted = item.isMuted === true;
  const isLastMessageFromMe = item.lastMessage?.senderId === currentUserId;

  const getAvatarSource = () => {
    if (avatarError) {
      return DEFAULT_AVATAR;
    }

    const avatarUrl = getAvatarUrl(item.otherUserAvatar);
    if (avatarUrl && avatarUrl.length > 0) {
      return { uri: avatarUrl };
    }

    return DEFAULT_AVATAR;
  };

  const getLastMessageText = (): string => {
    if (!item.lastMessage) return "No messages yet";

    const { type, message } = item.lastMessage;
    let displayMessage = message;

    switch (type) {
      case "audio":
        displayMessage = "🎤 Voice message";
        break;
      case "image":
        displayMessage = "📷 Photo";
        break;
      case "file":
        displayMessage = "📎 File";
        break;
      default:
        displayMessage = message || "No messages yet";
    }

    if (isLastMessageFromMe) {
      return `You: ${displayMessage}`;
    }

    return displayMessage;
  };

  const highlightBackground =
    isHighlighted && highlightAnim
      ? highlightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["transparent", "rgba(0, 122, 255, 0.12)"],
        })
      : "transparent";

  const handleLongPress = () => {
    setIsPressed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(() => {
      if (rowRef.current) {
        rowRef.current.measure(
          (
            x: number,
            y: number,
            width: number,
            height: number,
            pageX: number,
            pageY: number,
          ) => {
            if (pageY > 0 && height > 0) {
              onLongPress(item, { y: pageY, height, pageX, pageY });
            }
          },
        );
      }
    }, 50);
  };

  return (
    <Animated.View style={{ backgroundColor: highlightBackground }}>
      <Animated.View
        ref={rowRef}
        style={[
          styles.wrapper,
          isSelected &&
            !disableSelectedStyle && {
              backgroundColor: "transparent",
            },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.row,
            pressed && !isPressed ? styles.rowPressed : null,
          ]}
          onPress={onPress}
          onPressIn={() => setIsPressed(false)}
          onLongPress={handleLongPress}
          delayLongPress={300}
        >
          {/* Avatar Section */}
          <View style={styles.avatarContainer}>
            <Image
              source={getAvatarSource()}
              style={[styles.avatar, item.isPinned && styles.pinnedAvatar]}
              onError={() => setAvatarError(true)}
            />

            {isMuted && (
              <View style={styles.mutedBadge}>
                <Ionicons name="volume-mute" size={12} color="#fff" />
              </View>
            )}

            {isUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Content Section */}
          <View style={styles.info}>
            <View style={styles.headerRow}>
              <View style={styles.nameRow}>
                {item.isPinned && (
                  <Ionicons
                    name="pin"
                    size={14}
                    color="#007AFF"
                    style={styles.pinIcon}
                  />
                )}
                <Text
                  style={[styles.name, isUnread && styles.nameUnread]}
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
                  color="#8E8E93"
                  style={styles.muteIcon}
                />
              )}
              <Text
                style={[
                  styles.lastMessage,
                  isUnread && styles.lastMessageUnread,
                  isMuted && styles.lastMessageMuted,
                ]}
                numberOfLines={1}
              >
                {getLastMessageText()}
              </Text>
              {item.lastMessage && (
                <Text style={[styles.time, isUnread && styles.timeUnread]}>
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

export { ChatItem };
export default ChatItem;

// ──────────────────────────────────────────────────────────────────────────────
// STYLES (unchanged)
// ──────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 0,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
    width: "100%",
  },
  rowPressed: {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
  },
  avatarContainer: {
    marginRight: 15,
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
  },
  pinnedAvatar: {
    borderWidth: 2,
    borderColor: "#007AFF",
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
    borderColor: "#fff",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#007AFF",
    borderWidth: 2,
    borderColor: "#fff",
  },
  info: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  pinIcon: { marginRight: 2 },
  name: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    fontFamily: "SofiaSans-Medium",
  },
  nameUnread: {
    fontWeight: "700",
    fontFamily: "SofiaSans-Bold",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  muteIcon: {
    marginRight: 2,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  lastMessageUnread: {
    color: "#000",
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  lastMessageMuted: {
    color: "#C7C7CC",
  },
  time: {
    fontSize: 12,
    color: "#8E8E93",
    marginLeft: 8,
    fontFamily: "SofiaSans-Regular",
  },
  timeUnread: {
    color: "#007AFF",
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
});
