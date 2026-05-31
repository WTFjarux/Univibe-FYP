// app/components/community/ConfirmDeleteModal.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";

interface ConfirmDeleteModalProps {
  visible: boolean;
  communityName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  visible,
  communityName,
  onClose,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setDeleteInput("");
      setDeleting(false);
    }
  }, [visible]);

  const isMatch = deleteInput.trim() === communityName;

  const handleConfirm = () => {
    if (isMatch && !deleting) {
      setDeleting(true);
      onConfirm();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.container,
              { backgroundColor: colors.card || "#ffffff" },
            ]}
          >
            {/* Warning Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={48} color="#ef4444" />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>
              Delete Community
            </Text>

            {/* Description */}
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              This action is permanent and cannot be undone. All posts, events,
              members, and data will be permanently removed.
            </Text>

            {/* Prompt */}
            <Text style={[styles.prompt, { color: colors.textSecondary }]}>
              Type{" "}
              <Text style={{ fontFamily: "SofiaSans-Bold", color: "#ef4444" }}>
                {communityName}
              </Text>{" "}
              to confirm:
            </Text>

            {/* Input */}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: isMatch ? "#ef4444" : colors.border || "#e2e8f0",
                },
              ]}
              placeholder={`Type "${communityName}"`}
              placeholderTextColor={colors.textSecondary}
              value={deleteInput}
              onChangeText={setDeleteInput}
              autoFocus
              autoCapitalize="none"
              editable={!deleting}
            />

            {/* Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  { borderColor: colors.border || "#e2e8f0" },
                ]}
                onPress={onClose}
                disabled={deleting}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: isMatch ? "#ef4444" : "#ef444480",
                  },
                ]}
                onPress={handleConfirm}
                disabled={!isMatch || deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmText}>Delete Community</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "88%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "SofiaSans-Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  prompt: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    borderWidth: 2,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "SofiaSans-SemiBold",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "SofiaSans-Bold",
  },
});

export default React.memo(ConfirmDeleteModal);
