// app/components/Feed/CreatePostButton.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../../lib/AuthContext";
import { API_BASE_URL } from "../../../../constants/ipConstants";

const DEFAULT_AVATAR: ImageSourcePropType = require("../../../../assets/images/default-avatar.png");

interface CreatePostButtonProps {
  onPress?: () => void;
  placeholder?: string;
}

const CreatePostButton: React.FC<CreatePostButtonProps> = ({
  onPress,
  placeholder = "What's happening on campus?",
}) => {
  const { profile } = useAuth();

  const getProfilePictureSource = (): ImageSourcePropType => {
    const hasProfilePicture = profile?.profilePicture?.trim();

    if (hasProfilePicture) {
      let imageUrl = profile.profilePicture;

      if (imageUrl.startsWith("/")) {
        imageUrl = `${API_BASE_URL}${imageUrl}`;
      }

      return { uri: imageUrl };
    }

    return DEFAULT_AVATAR;
  };

  return (
    <TouchableOpacity style={styles.createPostButton} onPress={onPress}>
      <Image source={getProfilePictureSource()} style={styles.userAvatar} />
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
    backgroundColor: "#f3f4f6",
  },
  createPostText: {
    flex: 1,
    fontSize: 15,
    color: "#9ca3af",
  },
});

export default CreatePostButton;
