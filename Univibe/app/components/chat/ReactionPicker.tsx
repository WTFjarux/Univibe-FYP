// app/components/chat/ReactionPicker.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

interface ReactionPickerProps {
  visible: boolean;
  onSelectReaction: (reaction: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

export default function ReactionPicker({
  visible,
  onSelectReaction,
  onClose,
  position,
}: ReactionPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.reactionContainer,
            position && { top: position.y, left: position.x },
          ]}
        >
          {REACTIONS.map((reaction) => (
            <TouchableOpacity
              key={reaction}
              style={styles.reactionButton}
              onPress={() => {
                onSelectReaction(reaction);
                onClose();
              }}
            >
              <Text style={styles.reactionText}>{reaction}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  reactionContainer: {
    position: "absolute",
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
  reactionText: {
    fontSize: 24,
  },
});
