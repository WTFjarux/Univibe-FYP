// app/screens/CommunitiesListScreen.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../lib/contexts/ThemeContext";
import { communityService } from "../../lib/services/communityService";
import { Community } from "../../lib/types/community";
import CommunityCard from "../components/community/CommunityCard";

type FilterCategory = "all" | "my";
type FilterType = "all" | "community" | "department";
type FilterPrivacy = "all" | "public" | "private";

export default function CommunitiesListScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [activeType, setActiveType] = useState<FilterType>("all");
  const [activePrivacy, setActivePrivacy] = useState<FilterPrivacy>("all");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params: any = {};
      if (activeType !== "all") params.type = activeType;
      if (activePrivacy !== "all") params.privacy = activePrivacy;

      const [allResult, myResult] = await Promise.all([
        communityService.getCommunities(params),
        communityService.getMyCommunities(),
      ]);

      if (allResult.success && allResult.data) setCommunities(allResult.data);
      if (myResult.success && myResult.data) setMyCommunities(myResult.data);
    } catch (error) {
      console.error("Load communities error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeType, activePrivacy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleJoin = async (community: Community) => {
    setJoiningId(community._id);
    try {
      const result = await communityService.joinCommunity(community._id);
      if (result.success) {
        loadData();
      } else {
        Alert.alert("Error", result.message || "Failed to join");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to join community");
    } finally {
      setJoiningId(null);
    }
  };

  const handleRequestToJoin = async (community: Community) => {
    setJoiningId(community._id);
    try {
      const result = await communityService.requestToJoin(community._id);
      if (result.success) {
        Alert.alert("Request Sent", result.message);
        loadData();
      } else {
        Alert.alert("Error", result.message || "Failed to send request");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send join request");
    } finally {
      setJoiningId(null);
    }
  };

  const navigateToCreate = () =>
    router.push("/screens/CreateCommunityScreen" as any);

  const filteredCommunities =
    activeCategory === "my" ? myCommunities : communities;

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Communities
          </Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Communities
        </Text>
        <TouchableOpacity onPress={navigateToCreate} style={styles.headerBtn}>
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      <View
        style={[
          styles.categoryBar,
          { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
        ]}
      >
        {(["all", "my"] as FilterCategory[]).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryTab,
              activeCategory === cat && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Ionicons
              name={cat === "all" ? "compass-outline" : "people-outline"}
              size={16}
              color={
                activeCategory === cat ? colors.primary : colors.textSecondary
              }
            />
            <Text
              style={[
                styles.categoryText,
                {
                  color:
                    activeCategory === cat
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              {cat === "all" ? "Browse" : "My Communities"}
            </Text>
            {cat === "my" && (
              <View
                style={[
                  styles.categoryCount,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text
                  style={[styles.categoryCountText, { color: colors.primary }]}
                >
                  {myCommunities.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter Chips */}
      {activeCategory === "all" && (
        <View
          style={[
            styles.filterContainer,
            { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterChipsScroll}
            contentContainerStyle={styles.filterChipsContent}
          >
            {(["all", "community", "department"] as FilterType[]).map(
              (type) => (
                <TouchableOpacity
                  key={`type-${type}`}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        activeType === type
                          ? colors.primary
                          : isDark
                            ? "#334155"
                            : "#e2e8f0",
                    },
                  ]}
                  onPress={() => setActiveType(type)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color:
                          activeType === type
                            ? "#ffffff"
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {type === "all"
                      ? "All Types"
                      : type === "community"
                        ? "Communities"
                        : "Departments"}
                  </Text>
                </TouchableOpacity>
              ),
            )}
            <View
              style={[styles.filterDivider, { backgroundColor: colors.border }]}
            />
            {(["all", "public", "private"] as FilterPrivacy[]).map(
              (privacy) => (
                <TouchableOpacity
                  key={`privacy-${privacy}`}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        activePrivacy === privacy
                          ? colors.primary
                          : isDark
                            ? "#334155"
                            : "#e2e8f0",
                    },
                  ]}
                  onPress={() => setActivePrivacy(privacy)}
                >
                  {privacy !== "all" && (
                    <Ionicons
                      name={
                        privacy === "public"
                          ? "globe-outline"
                          : "lock-closed-outline"
                      }
                      size={12}
                      color={
                        activePrivacy === privacy
                          ? "#ffffff"
                          : colors.textSecondary
                      }
                    />
                  )}
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color:
                          activePrivacy === privacy
                            ? "#ffffff"
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {privacy === "all"
                      ? "All"
                      : privacy === "public"
                        ? "Public"
                        : "Private"}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>
        </View>
      )}

      {/* Community List */}
      <FlatList
        data={filteredCommunities}
        renderItem={({ item }) => (
          <CommunityCard
            community={item}
            joiningId={joiningId}
            onJoin={handleJoin}
            onRequestToJoin={handleRequestToJoin}
          />
        )}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={
          filteredCommunities.length === 0
            ? styles.emptyList
            : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="people-outline"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeCategory === "my"
                ? "No Communities Joined"
                : "No Communities"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeCategory === "my"
                ? "Join or create communities to see them here"
                : "No communities match your filters"}
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={navigateToCreate}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.createButtonText}>Create Community</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "SofiaSans-Bold" },
  categoryBar: { flexDirection: "row", borderBottomWidth: 1 },
  categoryTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
  },
  categoryText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  categoryCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  categoryCountText: { fontSize: 11, fontFamily: "SofiaSans-Bold" },
  filterContainer: {
    borderBottomWidth: 1,
    paddingBottom: 8, // ✅ Added padding below filter chips
  },
  filterChipsScroll: { maxHeight: 44 },
  filterChipsContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  filterChipText: { fontSize: 12, fontFamily: "SofiaSans-SemiBold" },
  filterDivider: { width: 1, height: 20 },
  listContent: {
    paddingBottom: 40, // ✅ Already had bottom padding
    paddingTop: 8, // ✅ Added padding at top of list after tabs
  },
  emptyList: { flexGrow: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80, // ✅ Added extra bottom padding for empty state
  },
  emptyTitle: { fontSize: 20, fontFamily: "SofiaSans-Bold", marginTop: 16 },
  emptyText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    marginTop: 8,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
});
