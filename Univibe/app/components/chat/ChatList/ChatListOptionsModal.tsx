/**
 * ChatListOptionsModal.tsx
 *
 * Context-menu modal triggered by a long-press on a chat row.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import type { ChatRoom, ItemLayout } from "../../../../lib/types/chat.types";
import { ChatItem } from "./ChatItem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const PANEL_WIDTH = 260;
const PANEL_GAP = 8;

interface Action {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  handler: () => void;
  destructive?: boolean;
}

interface ChatListOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onPin: () => void;
  onToggleRead: () => void;
  onMute: () => void;
  onDelete: () => void;
  isPinned?: boolean;
  isMuted?: boolean;
  isRead?: boolean;
  item: ChatRoom | null;
  itemLayout?: ItemLayout;
  currentUserId?: string;
}

export default function ChatListOptionsModal({
  visible,
  onClose,
  onPin,
  onToggleRead,
  onMute,
  onDelete,
  isPinned = false,
  isMuted = false,
  isRead = true,
  item,
  itemLayout,
  currentUserId,
}: ChatListOptionsModalProps) {
  const [panelHeight, setPanelHeight] = useState(0);
  const { colors, isDark } = useTheme();

  const getPositions = () => {
    let previewTop = SCREEN_HEIGHT / 2 - 50;
    let panelTop = SCREEN_HEIGHT / 2 + 50;
    let panelLeft = SCREEN_WIDTH - PANEL_WIDTH - 16;

    if (itemLayout && itemLayout.pageY) {
      const rowY = itemLayout.pageY;
      const rowHeight = itemLayout.height || 82;

      previewTop = rowY;
      panelTop = rowY + rowHeight + PANEL_GAP;

      if (panelTop + panelHeight > SCREEN_HEIGHT - 20 && panelHeight > 0) {
        panelTop = rowY - panelHeight - PANEL_GAP;
      }

      panelTop = Math.max(
        10,
        Math.min(panelTop, SCREEN_HEIGHT - panelHeight - 10),
      );

      panelLeft = SCREEN_WIDTH - PANEL_WIDTH - 16;
    }

    return { previewTop, panelTop, panelLeft };
  };

  const { previewTop, panelTop, panelLeft } = getPositions();

  const actions: Action[] = [
    {
      icon: isPinned ? "pin" : "pin-outline",
      label: isPinned ? "Unpin" : "Pin",
      handler: onPin,
    },
    {
      icon: isRead ? "mail-unread-outline" : "mail-open-outline",
      label: isRead ? "Mark as Unread" : "Mark as Read",
      handler: onToggleRead,
    },
    {
      icon: isMuted ? "volume-high-outline" : "volume-mute",
      label: isMuted ? "Unmute" : "Mute",
      handler: onMute,
    },
    {
      icon: "trash-outline",
      label: "Delete",
      handler: onDelete,
      destructive: true,
    },
  ];

  const handleAction = (action: Action) => {
    if (action.destructive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    action.handler();
    onClose();
  };

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onClose();
        }}
      >
        <BlurView
          intensity={20}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.dimOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.2)" },
          ]}
        />
      </TouchableOpacity>

      {/* Preview Strip */}
      <View
        style={[
          styles.previewStrip,
          {
            top: previewTop,
            backgroundColor: colors.card,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <View pointerEvents="none">
          <ChatItem
            item={item}
            isSelected={false}
            disableSelectedStyle={true}
            highlightAnim={null}
            isHighlighted={false}
            itemScaleAnim={{ current: 1 } as any}
            itemTranslateYAnim={{ current: 0 } as any}
            onPress={() => {}}
            onLongPress={() => {}}
            currentUserId={currentUserId}
            isUnread={!isRead}
          />
        </View>
      </View>

      {/* Actions Panel */}
      <View
        style={[
          styles.panel,
          {
            top: panelTop,
            left: panelLeft,
            backgroundColor: colors.card,
            shadowColor: colors.shadow,
          },
        ]}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          if (height !== panelHeight) {
            setPanelHeight(height);
          }
        }}
      >
        <View style={[styles.panelContent, { backgroundColor: colors.card }]}>
          {actions.map((action, index) => (
            <React.Fragment key={action.label}>
              {index > 0 && (
                <View
                  style={[styles.separator, { backgroundColor: colors.border }]}
                />
              )}
              <TouchableOpacity
                style={styles.actionItem}
                activeOpacity={0.65}
                onPress={() => handleAction(action)}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? "#FF3B30" : colors.primary}
                />
                <Text
                  style={[
                    styles.actionLabel,
                    { color: colors.text },
                    action.destructive && styles.actionLabelDestructive,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  previewStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  panel: {
    position: "absolute",
    width: PANEL_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 11,
  },
  panelContent: {
    paddingVertical: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SofiaSans-Regular",
  },
  actionLabelDestructive: {
    color: "#FF3B30",
  },
});
