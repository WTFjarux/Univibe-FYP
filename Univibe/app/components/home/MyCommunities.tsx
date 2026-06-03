import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { useAuth } from "../../../lib/contexts/AuthContext";
import { communityService } from "../../../lib/services/communityService";
import socketService from "../../../lib/services/socketService";
import { API_BASE_URL } from "../../../constants/ipConstants";

interface MyCommunitiesProps {
  limit?: number;
}

export default function MyCommunities({ limit = 5 }: MyCommunitiesProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommunities = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await communityService.getMyCommunities();
      if (response.success && response.data) {
        setCommunities(response.data.slice(0, limit));
      }
    } catch (err) {
      console.error("Error fetching communities:", err);
    } finally {
      setLoading(false);
    }
  }, [token, limit]);

  // Initial fetch
  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCommunities();
    }, [fetchCommunities]),
  );

  // Listen for real-time community events via socket
  useEffect(() => {
    if (!token) return;

    // Handle community joined event
    const handleCommunityJoined = (data: any) => {
      fetchCommunities();
    };

    // Handle community left event
    const handleCommunityLeft = (data: any) => {
      fetchCommunities();
    };

    // Handle member added event (when added by someone else)
    const handleMemberAdded = (data: any) => {
      fetchCommunities();
    };

    // Handle member removed event
    const handleMemberRemoved = (data: any) => {
      fetchCommunities();
    };

    // Register socket event listeners
    socketService.on("community:joined", handleCommunityJoined);
    socketService.on("community:left", handleCommunityLeft);
    socketService.on("community:member_added", handleMemberAdded);
    socketService.on("community:member_removed", handleMemberRemoved);

    // Cleanup
    return () => {
      socketService.off("community:joined", handleCommunityJoined);
      socketService.off("community:left", handleCommunityLeft);
      socketService.off("community:member_added", handleMemberAdded);
      socketService.off("community:member_removed", handleMemberRemoved);
    };
  }, [token, fetchCommunities]);

  const getFullImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            My Communities
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (communities.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            My Communities
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/screens/CommunitiesListScreen" as any)}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              Discover
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No communities yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Join or create a community to connect with others
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/screens/CommunitiesListScreen" as any)}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.createButtonText}>Discover Communities</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          My Communities
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/screens/CommunitiesListScreen" as any)}
        >
          <Text style={[styles.seeAllText, { color: colors.primary }]}>
            See All
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.communitiesScroll}
      >
        {communities.map((community) => (
          <TouchableOpacity
            key={community._id}
            style={[
              styles.communityCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
            activeOpacity={0.7}
            onPress={() =>
              router.push(
                `/screens/CommunityScreen?communityId=${community._id}` as any,
              )
            }
          >
            {community.coverImage ? (
              <Image
                source={{ uri: getFullImageUrl(community.coverImage) }}
                style={styles.communityCover}
              />
            ) : (
              <View
                style={[
                  styles.communityCover,
                  styles.communityCoverPlaceholder,
                ]}
              >
                <Ionicons name="people" size={28} color={colors.primary} />
              </View>
            )}
            <View style={styles.communityInfo}>
              <Text
                style={[styles.communityName, { color: colors.text }]}
                numberOfLines={1}
              >
                {community.name}
              </Text>
              <Text
                style={[
                  styles.communityMembers,
                  { color: colors.textSecondary },
                ]}
              >
                {community.memberCount || 0} members
              </Text>
              {community.privacy === "private" && (
                <View style={styles.privacyBadge}>
                  <Ionicons name="lock-closed" size={10} color="#ef4444" />
                  <Text style={styles.privacyText}>Private</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8, marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "SofiaSans-Bold",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  loadingContainer: { paddingVertical: 30, alignItems: "center" },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  communitiesScroll: { paddingHorizontal: 16, gap: 12 },
  communityCard: {
    width: 140,
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  communityCover: { width: 140, height: 80, backgroundColor: "#f3f4f6" },
  communityCoverPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
  },
  communityInfo: { padding: 10 },
  communityName: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
    marginBottom: 2,
  },
  communityMembers: { fontSize: 11, fontFamily: "SofiaSans-Regular" },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  privacyText: {
    fontSize: 10,
    color: "#ef4444",
    fontFamily: "SofiaSans-Regular",
  },
});
