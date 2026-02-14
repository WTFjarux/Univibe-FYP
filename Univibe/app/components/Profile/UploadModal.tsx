//app/components/Profile/UploadModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onViewImage: () => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onDeletePhoto: () => void;
  hasExistingImage: boolean;
  title?: string;
  viewLabel?: string; 
  deleteLabel?: string; 
}

export default function UploadModal({
  visible,
  onClose,
  onViewImage,
  onPickImage,
  onTakePhoto,
  onDeletePhoto,
  hasExistingImage = true,
  title = "Photo Options", 
  viewLabel = "View Photo", 
  deleteLabel = "Remove Photo", 
}: UploadModalProps) {
  const handleDeletePhoto = () => {
    const modalTitle =
      title === "Cover Photo" ? "Cover Photo" : "Profile Picture";

    Alert.alert(
      `Remove ${modalTitle}`,
      `Are you sure you want to remove your ${modalTitle.toLowerCase()}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onDeletePhoto },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* BACKDROP */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* BOTTOM SHEET */}
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.option}
            onPress={() => {
              onClose();
              onViewImage();
            }}
          >
            <Ionicons name="eye-outline" size={18} color="#6366f1" />
            <Text style={styles.optionText}>{viewLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onPickImage}>
            <Ionicons name="images-outline" size={18} color="#6366f1" />
            <Text style={styles.optionText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onTakePhoto}>
            <Ionicons name="camera-outline" size={18} color="#6366f1" />
            <Text style={styles.optionText}>Take Photo</Text>
          </TouchableOpacity>

          {hasExistingImage && (
            <TouchableOpacity
              style={[styles.option, styles.deleteOption]}
              onPress={handleDeletePhoto}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[styles.optionText, styles.deleteText]}>
                {deleteLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },

  container: {
    backgroundColor: "#ffffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000000ff",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 24,
      },
    }),
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 8,
  },

  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },

  /* OPTIONS */
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },

  optionText: {
    fontSize: 16,
    color: "#374151",
    marginLeft: 14,
  },

  deleteOption: {
    marginTop: 8,
  },

  deleteText: {
    color: "#ef4444",
    fontWeight: "500",
  },
});
