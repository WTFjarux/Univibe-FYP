/**
 * ChatItem.tsx
 *
 * A single row in the chat list.
 */

import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getAvatarUrl,
  formatTime,
  getInitials,
} from "../../../../lib/utils/chatUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  roomId: string;
  type: string;
  name: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  lastMessage?: {
    message: string;
    sentAt: string;
  };
  updatedAt: string;
  isPinned?: boolean;
  isMuted?: boolean;
  isRead?: boolean;
}

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
}

// ─── Component ────────────────────────────────────────────────────────────────

const ChatItem: React.FC<ChatItemProps> = ({
  item,
  isSelected,
  highlightAnim,
  isHighlighted,
  itemScaleAnim,
  itemTranslateYAnim,
  onPress,
  onLongPress,
}) => {
  const rowRef = useRef<View>(null);

  const avatarUrl = getAvatarUrl(item.otherUserAvatar);
  const isUnread = item.isRead === false && !!item.lastMessage;
  const isMuted = item.isMuted === true;

  // ── Highlight tint interpolation ──────────────────────────────────────────
  const highlightBackground =
    isHighlighted && highlightAnim
      ? highlightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["transparent", "rgba(0, 122, 255, 0.12)"],
        })
      : "transparent";

  // ── Long-press handler ────────────────────────────────────────────────────
  const handleLongPress = () => {
    // Use setTimeout to ensure measurement happens after layout is complete
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
            console.log("Measured layout:", {
              x,
              y,
              width,
              height,
              pageX,
              pageY,
            });

            // Only call if we have valid measurements
            if (pageY > 0 && height > 0) {
              onLongPress(item, { y: pageY, height, pageX, pageY });
            }
          },
        );
      }
    }, 50); // Small delay to ensure layout is ready
  };

  return (
    <Animated.View style={{ backgroundColor: highlightBackground }}>
      <Animated.View
        ref={rowRef}
        style={[
          styles.wrapper,
          isSelected && {
            transform: [
              { scale: itemScaleAnim },
              { translateY: itemTranslateYAnim },
            ],
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 10,
            backgroundColor: "rgba(0, 122, 255, 0.04)",
            borderRadius: 14,
            marginHorizontal: 8,
            width: SCREEN_WIDTH - 16,
            alignSelf: "center",
          },
        ]}
      >
        <TouchableOpacity
          style={styles.row}
          onPress={onPress}
          onLongPress={handleLongPress}
          delayLongPress={300}
          activeOpacity={0.7}
        >
          {/* ── Avatar ── */}
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View
                style={[styles.avatar, item.isPinned && styles.pinnedAvatar]}
              >
                <Text style={styles.avatarInitials}>
                  {getInitials(item.name)}
                </Text>
              </View>
            )}

            {/* Muted badge */}
            {isMuted && (
              <View style={styles.mutedBadge}>
                <Ionicons name="volume-mute" size={12} color="#fff" />
              </View>
            )}

            {/* Unread dot */}
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          {/* ── Text info ── */}
          <View style={styles.info}>
            {/* Name row */}
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

            {/* Last message row with time inline */}
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
                {item.lastMessage?.message ?? "No messages yet"}
              </Text>
              {item.lastMessage && (
                <Text style={[styles.time, isUnread && styles.timeUnread]}>
                  {formatTime(item.lastMessage.sentAt)}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// Export both named and default
export { ChatItem };
export default ChatItem;

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Avatar
  avatarContainer: {
    marginRight: 15,
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  pinnedAvatar: {
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
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

  // Info section
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
  },
  nameUnread: {
    fontWeight: "700",
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
  },
  lastMessageUnread: {
    color: "#000",
    fontWeight: "500",
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
    fontFamily: "SofiaSans-Regular",
  },
});
