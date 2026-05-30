// app/components/Community/CreateModal.tsx

import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
  onCreatePost: () => void;
  onCreateEvent: () => void;
}

export default function CreateModal({
  visible,
  onClose,
  onCreatePost,
  onCreateEvent,
}: CreateModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.content, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Create</Text>

          <TouchableOpacity
            style={[styles.option, { borderBottomColor: colors.border }]}
            onPress={onCreatePost}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Create Post
              </Text>
              <Text
                style={[styles.optionDesc, { color: colors.textSecondary }]}
              >
                Share an update with the community
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onCreateEvent}>
            <View style={[styles.iconBox, { backgroundColor: "#10b98120" }]}>
              <Ionicons name="calendar-outline" size={22} color="#10b981" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Create Event
              </Text>
              <Text
                style={[styles.optionDesc, { color: colors.textSecondary }]}
              >
                Organize an event for the community
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  title: { fontSize: 18, fontFamily: "SofiaSans-Bold", marginBottom: 16 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 15, fontFamily: "SofiaSans-SemiBold" },
  optionDesc: { fontSize: 12, fontFamily: "SofiaSans-Regular", marginTop: 2 },
});
