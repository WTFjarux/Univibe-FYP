// app/components/Feed/FeedHeader.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../../lib/contexts/AuthContext";

interface FeedHeaderProps {
  title?: string;
  subtitle?: string;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

const FeedHeader: React.FC<FeedHeaderProps> = ({
  title = "Feed",
  subtitle = "Latest from your campus",
  onNotificationPress,
  onProfilePress,
}) => {
  const router = useRouter();
  const { user } = useAuth();

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      router.push("/(tabs)/profile");
    }
  };

  const handleSearchPress = () => {
    router.push("/(tabs)/search");
  };

  // Get user's initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return "U";
    const names = user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.actions}>
        {/* Search Button */}
        <TouchableOpacity style={styles.iconButton} onPress={handleSearchPress}>
          <Ionicons name="search-outline" size={30} color="#111827" />
        </TouchableOpacity>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    fontFamily:"SofiaSans-Bold",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    fontFamily:"SofiaSans-Regular",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  profileFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileFallbackText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "#fff",
  },
});

export default FeedHeader;
