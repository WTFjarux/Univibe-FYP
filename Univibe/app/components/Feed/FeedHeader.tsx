// app/components/Feed/FeedHeader.tsx

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
  Platform,
} from "react-native";
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

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.actions}>
        {/* Search Button - Using Pressable for clean Android support */}
        <Pressable
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
          onPress={handleSearchPress}
          android_ripple={{ color: "rgba(0,0,0,0.1)", borderless: true }}
        >
          <Ionicons name="search-outline" size={28} color="#111827" />
        </Pressable>
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
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "transparent",
  },
  iconButtonPressed: {
    opacity: 0.7,
  },
});

export default FeedHeader;
