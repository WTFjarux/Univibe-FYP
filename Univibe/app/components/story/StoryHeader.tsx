import React, { memo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { API_BASE_URL } from "../../../constants/ipConstants";

interface StoryHeaderProps {
  user: any;
  currentStory: any;
  onClose: () => void;
}

const StoryHeader = memo(
  ({ user, currentStory, onClose }: StoryHeaderProps) => {
    const { colors } = useTheme();
    const profilePicture = user?.profilePicture?.startsWith("http")
      ? user.profilePicture
      : `${API_BASE_URL}${user?.profilePicture}`;

    return (
      <View style={styles.container}>
        <View style={styles.userInfo}>
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.avatarText}>
                {user?.userName?.[0]?.toUpperCase() || "U"}
              </Text>
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.userName}>{user?.userName}</Text>
            <Text style={styles.timestamp}>
              {currentStory?.createdAt
                ? new Date(currentStory.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Just now"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 90 : 60,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  timestamp: {
    color: "rgba(209, 209, 209, 0.7)",
    fontSize: 12,
    marginTop: 2,
    fontFamily: "SofiaSans-SemiBold",
  },
});

export default StoryHeader;
