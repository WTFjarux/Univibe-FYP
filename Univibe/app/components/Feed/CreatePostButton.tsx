// app/components/Feed/CreatePostButton.tsx
import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../lib/AuthContext"; // Import AuthContext

interface CreatePostButtonProps {
  onPress?: () => void;
  placeholder?: string;
}

const CreatePostButton: React.FC<CreatePostButtonProps> = ({
  onPress,
  placeholder = "What's happening on campus?",
}) => {
  const { profile } = useAuth(); // Get profile from auth context

  // Get user's profile picture or use default
  const userAvatar =
    profile?.profilePicture ||
    "https://api.dicebear.com/7.x/avataaars/svg?seed=User";

  return (
    <TouchableOpacity style={styles.createPostButton} onPress={onPress}>
      <Image
        source={{ uri: userAvatar }}
        style={styles.userAvatar}
        defaultSource={{
          uri: "https://api.dicebear.com/7.x/avataaars/svg?seed=User",
        }}
      />
      <Text style={styles.createPostText}>{placeholder}</Text>
      <Ionicons name="image-outline" size={20} color="#8b5cf6" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  createPostButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6", // Fallback background
  },
  createPostText: {
    flex: 1,
    fontSize: 15,
    color: "#9ca3af",
  },
});

export default CreatePostButton;
