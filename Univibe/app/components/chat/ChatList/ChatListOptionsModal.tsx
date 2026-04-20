/**
 * ChatListOptionsModal.tsx
 *
 * Context-menu modal triggered by a long-press on a chat row.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { usePopAnimation } from "../../../../hooks/usePopAnimation";
import { ChatItem, ChatRoom } from "./ChatItem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const PANEL_WIDTH = 260;
const PANEL_GAP = 8;

export interface ItemLayout {
  y: number;
  height: number;
  pageX?: number;
  pageY?: number;
}

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
}: ChatListOptionsModalProps) {
  const [panelHeight, setPanelHeight] = useState(0);
  const previewScale = useRef(new Animated.Value(1)).current;
  const previewTranslateY = useRef(new Animated.Value(0)).current;

  const {
    scaleAnim,
    opacityAnim,
    translateYAnim,
    animateIn,
    animateOut,
    reset,
  } = usePopAnimation({
    scaleFrom: 0.94,
    scaleTo: 1,
    opacityFrom: 0,
    opacityTo: 1,
    translateYFrom: 6,
    translateYTo: 0,
    damping: 15,
    stiffness: 130,
  });

  useEffect(() => {
    if (visible) {
      reset();
      animateIn();
    } else {
      animateOut();
    }
  }, [visible]);

  const getPositions = () => {
    // Default position (centered, but we'll use this as fallback)
    let previewTop = SCREEN_HEIGHT / 2 - 50;
    let panelTop = SCREEN_HEIGHT / 2 + 50;
    let panelLeft = SCREEN_WIDTH - PANEL_WIDTH - 16;

    // If we have layout info from the long-pressed item
    if (itemLayout && itemLayout.pageY) {
      const rowY = itemLayout.pageY;
      const rowHeight = itemLayout.height || 82;

      console.log("Modal positioning:", { rowY, rowHeight, panelHeight }); // Debug log

      // Position preview exactly where the row was
      previewTop = rowY;

      // Position panel directly below the row
      panelTop = rowY + rowHeight + PANEL_GAP;

      // Check if panel goes off screen
      if (panelTop + panelHeight > SCREEN_HEIGHT - 20 && panelHeight > 0) {
        // Position above instead
        panelTop = rowY - panelHeight - PANEL_GAP;
      }

      // Keep panel within screen bounds
      panelTop = Math.max(
        10,
        Math.min(panelTop, SCREEN_HEIGHT - panelHeight - 10),
      );

      // Right-align the panel
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
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop - lighter blur */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onClose();
        }}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}
        >
          <BlurView
            intensity={30}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.dimOverlay} />
        </Animated.View>
      </TouchableOpacity>

      {/* Preview Strip - exactly where the original row was */}
      <Animated.View
        style={[
          styles.previewStrip,
          {
            top: previewTop,
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
          },
        ]}
      >
        <View pointerEvents="none">
          <ChatItem
            item={item}
            isSelected={false}
            highlightAnim={null}
            isHighlighted={false}
            itemScaleAnim={previewScale}
            itemTranslateYAnim={previewTranslateY}
            onPress={() => {}}
            onLongPress={() => {}}
          />
        </View>
      </Animated.View>

      {/* Actions Panel - Light theme */}
      <Animated.View
        style={[
          styles.panel,
          {
            top: panelTop,
            left: panelLeft,
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
          },
        ]}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          if (height !== panelHeight) {
            setPanelHeight(height);
          }
        }}
      >
        <View style={styles.panelContent}>
          {actions.map((action, index) => (
            <React.Fragment key={action.label}>
              {index > 0 && <View style={styles.separator} />}
              <TouchableOpacity
                style={styles.actionItem}
                activeOpacity={0.65}
                onPress={() => handleAction(action)}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? "#FF3B30" : "#8B5CF6"}
                />
                <Text
                  style={[
                    styles.actionLabel,
                    action.destructive && styles.actionLabelDestructive,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dimOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  previewStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  panel: {
    position: "absolute",
    width: PANEL_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 11,
  },
  panelContent: {
    backgroundColor: "#ffffff",
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
    backgroundColor: "#E5E5EA",
    marginHorizontal: 16,
  },
  actionLabel: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "400",
    fontFamily: "SofiaSans-Regular",
  },
  actionLabelDestructive: {
    color: "#FF3B30",
  },
});
