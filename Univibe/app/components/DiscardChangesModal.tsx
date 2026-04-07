// app/components/DiscardChangesModal.tsx
import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DiscardChangesModalProps {
  visible: boolean;
  onClose: () => void;
  onDiscard: () => void;
  title?: string;
  message?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  keepEditingText?: string;
  discardText?: string;
}

export default function DiscardChangesModal({
  visible,
  onClose,
  onDiscard,
  title = "Discard Changes?",
  message = "You have unsaved changes. Are you sure you want to leave?",
  iconName = "warning-outline",
  iconColor = "#f59e0b",
  keepEditingText = "Keep Editing",
  discardText = "Discard",
}: DiscardChangesModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconName} size={48} color={iconColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>{keepEditingText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.discardButton]}
              onPress={onDiscard}
            >
              <Text style={styles.discardButtonText}>{discardText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    fontFamily: "SofiaSans-Bold",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    fontFamily: "SofiaSans-Bold",
  },
  discardButton: {
    backgroundColor: "#ef4444",
  },
  discardButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "SofiaSans-Bold",
  },
});
