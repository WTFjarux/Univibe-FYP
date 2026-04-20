// app/components/chat/ChatAttachmentMenu.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AttachmentOption {
  id: string;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  action: string;
}

interface ChatAttachmentMenuProps {
  visible: boolean;
  slideAnim: Animated.Value;
  attachmentOptions: AttachmentOption[];
  onSelectAction: (action: string) => void;
  onClose: () => void;
}

export default function ChatAttachmentMenu({
  visible,
  slideAnim,
  attachmentOptions,
  onSelectAction,
  onClose,
}: ChatAttachmentMenuProps) {
  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.attachmentMenuContainer,
        { transform: [{ translateX: slideAnim }] },
      ]}
    >
      <View style={styles.attachmentMenuHeader}>
        <Text style={styles.attachmentMenuTitle}>Attachments</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </View>
      <View style={styles.attachmentMenuGrid}>
        {attachmentOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.attachmentMenuItem}
            onPress={() => onSelectAction(option.action)}
          >
            <View
              style={[
                styles.attachmentMenuIcon,
                { backgroundColor: option.bgColor },
              ]}
            >
              <Ionicons
                name={option.icon as any}
                size={28}
                color={option.color}
              />
            </View>
            <Text style={styles.attachmentMenuItemTitle}>{option.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  attachmentMenuContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 300,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  attachmentMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  attachmentMenuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  attachmentMenuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  attachmentMenuItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 24,
  },
  attachmentMenuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  attachmentMenuItemTitle: {
    fontSize: 12,
    color: "#666",
    fontFamily: "SofiaSans-Regular",
  },
});
