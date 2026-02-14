// app/components/Profile/ProfileCard.tsx
import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileCard({
  user,
  onPress,
}: {
  user: any;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      {/* Cover Photo Section */}
      <View style={styles.coverSection}>
        {user.coverPhoto ? (
          <Image source={{ uri: user.coverPhoto }} style={styles.coverImage} />
        ) : (
          <View style={styles.defaultCover}>
            <Ionicons
              name="image-outline"
              size={48}
              color="rgba(255,255,255,0.7)"
            />
          </View>
        )}
        <Image
          source={{ uri: user.profilePicture }}
          style={styles.profileImage}
        />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{user.fullName}</Text>
              {user.verificationStatus === "verified" && (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color="#10b981"
                  style={styles.verifiedIcon}
                />
              )}
            </View>
            <Text style={styles.username}>@{user.username}</Text>
            <Text style={styles.details}>
              {user.major} • {user.year}
            </Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
            <Text style={styles.statNumber}>{user.stats?.posts || 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={20} color="#3b82f6" />
            <Text style={styles.statNumber}>
              {user.stats?.connections || 0}
            </Text>
            <Text style={styles.statLabel}>Connections</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-circle-outline" size={20} color="#10b981" />
            <Text style={styles.statNumber}>{user.stats?.groups || 0}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  coverSection: {
    height: 100,
    position: "relative",
    backgroundColor: "#f5f3ff",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  defaultCover: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f5f3ff",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#f1f5f9",
    position: "absolute",
    bottom: -40,
    left: 16,
  },
  cardContent: {
    padding: 16,
    paddingTop: 48, 
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardInfo: {
    marginLeft: 0,
    flex: 1,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  username: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  details: {
    fontSize: 14,
    color: "#374151",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
});
