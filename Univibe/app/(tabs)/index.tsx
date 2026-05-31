// app/(tabs)/index.tsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { useTheme } from "../../lib/contexts/ThemeContext";
import chatApi from "../../lib/services/chatApi";
import storyApi from "../../lib/services/storyApi";
import {
  notificationService,
  listenForNotifications,
} from "../../lib/services/notificationService";
import socketService from "../../lib/services/socketService";
import CampusMoments from "../components/home/CampusMoments";
import QuickActions from "../components/home/QuickActions";
import MyCommunities from "../components/home/MyCommunities";
import UpcomingEvents from "../components/home/UpcomingEvents";

import type { StoryGroup } from "../../lib/services/storyApi";

const { width } = Dimensions.get("window");

const HomeScreenSkeleton = () => {
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[styles.skeletonContainer, { backgroundColor: colors.background }]}
    >
      <View style={styles.skeletonHeader}>
        <Animated.View
          style={[
            styles.skeletonIcon,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLogo,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonIcon,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
      </View>
      <View style={styles.skeletonSection}>
        <View style={styles.skeletonQuickActions}>
          {[...Array(4)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.skeletonActionBtn,
                { opacity, backgroundColor: colors.skeleton },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.skeletonSection}>
        <Animated.View
          style={[
            styles.skeletonTitle,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.skeletonStoriesContainer}
        >
          {[...Array(6)].map((_, i) => (
            <View key={i} style={styles.skeletonStoryCard}>
              <Animated.View
                style={[
                  styles.skeletonStoryRing,
                  {
                    opacity,
                    backgroundColor: colors.skeleton,
                    borderColor: colors.skeletonHighlight,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.skeletonStoryAvatar,
                    { opacity, backgroundColor: colors.skeletonHighlight },
                  ]}
                />
              </Animated.View>
              <Animated.View
                style={[
                  styles.skeletonStoryName,
                  { opacity, backgroundColor: colors.skeleton },
                ]}
              />
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.skeletonSection}>
        <Animated.View
          style={[
            styles.skeletonTitle,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[...Array(4)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.skeletonCommunityCard,
                { opacity, backgroundColor: colors.skeleton },
              ]}
            />
          ))}
        </ScrollView>
      </View>
      <View style={styles.skeletonSection}>
        <Animated.View
          style={[
            styles.skeletonTitle,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        {[...Array(3)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.skeletonEventCard,
              { opacity, backgroundColor: colors.card },
            ]}
          >
            <Animated.View
              style={[
                styles.skeletonEventDate,
                { opacity, backgroundColor: colors.skeleton },
              ]}
            />
            <View style={styles.skeletonEventDetails}>
              <Animated.View
                style={[
                  styles.skeletonEventName,
                  { opacity, backgroundColor: colors.skeleton },
                ]}
              />
              <Animated.View
                style={[
                  styles.skeletonEventMeta,
                  { opacity, backgroundColor: colors.skeleton },
                ]}
              />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const initialLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    initialLoadTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setIsInitialLoading(false);
    }, 1500);
    return () => {
      isMountedRef.current = false;
      if (initialLoadTimerRef.current)
        clearTimeout(initialLoadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const cleanup = listenForNotifications(
      () => {},
      (count: number) => {
        if (isMountedRef.current) setUnreadCount(count);
      },
    );
    return () => cleanup();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const fetchUnreadChatCount = async () => {
      if (fetchInProgressRef.current || !isMountedRef.current) return;
      fetchInProgressRef.current = true;
      try {
        const data = await chatApi.getUnreadChatCount();
        if (isMountedRef.current && data.success && data.count !== undefined)
          setUnreadChatCount(data.count);
      } catch (error) {
      } finally {
        fetchInProgressRef.current = false;
      }
    };
    fetchUnreadChatCount();
    const handleChatUnread = (data: { count: number }) => {
      if (isMountedRef.current && data.count !== undefined)
        setUnreadChatCount(data.count);
    };
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchUnreadChatCount(), 800);
    };
    socketService.on("chat:unreadCount", handleChatUnread);
    socketService.on("receive_message", debouncedFetch);
    socketService.on("messages_read", debouncedFetch);
    socketService.on("message_read", debouncedFetch);
    socketService.on("chat_cleared", debouncedFetch);
    socketService.on("message_deleted", debouncedFetch);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socketService.off("chat:unreadCount", handleChatUnread);
      socketService.off("receive_message", debouncedFetch);
      socketService.off("messages_read", debouncedFetch);
      socketService.off("message_read", debouncedFetch);
      socketService.off("chat_cleared", debouncedFetch);
      socketService.off("message_deleted", debouncedFetch);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const unsubscribe = storyApi.onNewStoryReceived(() => {
      if (isMountedRef.current) setRefreshTrigger((prev) => prev + 1);
    });
    return () => {
      unsubscribe();
    };
  }, [token]);

  const refreshAll = useCallback(async (showIndicator = true) => {
    if (showIndicator) setRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    try {
      const r = await notificationService.getUnreadCount();
      if (isMountedRef.current && r.success && r.count !== undefined)
        setUnreadCount(r.count);
    } catch (error) {}
    try {
      const c = await chatApi.getUnreadChatCount();
      if (isMountedRef.current && c.success && c.count !== undefined)
        setUnreadChatCount(c.count);
    } catch (error) {}
    if (showIndicator)
      setTimeout(() => {
        if (isMountedRef.current) setRefreshing(false);
      }, 800);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isInitialLoading && isMountedRef.current) refreshAll(false);
    }, [refreshAll, isInitialLoading]),
  );

  const prevUnreadChatCount = useRef(0);
  const handleChatPress = () => {
    prevUnreadChatCount.current = unreadChatCount;
    setUnreadChatCount(0);
    router.push("/screens/ChatListScreen");
  };
  const handleStoryPress = (storyGroup: StoryGroup) => {
    router.push({
      pathname: "/screens/StoryViewerScreen",
      params: {
        userId: storyGroup.userId,
        userName: storyGroup.userName,
        hasUnseen: String(storyGroup.hasUnseen),
      },
    });
  };

  if (isInitialLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <HomeScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.headerBorder,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleChatPress}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={28} color={colors.icon} />
            {unreadChatCount > 0 && (
              <View style={[styles.badge, { borderColor: colors.background }]}>
                <Text style={styles.badgeText}>
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.logoText, { color: colors.logoText }]}>
            UNIVIBE
          </Text>
          <Link href="/screens/notifications" asChild>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons
                name="notifications-outline"
                size={28}
                color={colors.icon}
              />
              {unreadCount > 0 && (
                <View
                  style={[styles.badge, { borderColor: colors.background }]}
                >
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Link>
        </View>
        {/* Campus Moments */}
        <CampusMoments
          key={`campus-moments-${refreshTrigger}`}
          onStoryPress={handleStoryPress}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* My Communities */}
        <MyCommunities limit={5} />

        {/* Upcoming Events */}
        <UpcomingEvents key={`upcoming-events-${refreshTrigger}`} limit={3} />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#f8fafc",
  },
  logoText: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Sofia-Regular",
    color: "#111827",
    letterSpacing: 1,
  },
  iconButton: { position: "relative", padding: 8, borderRadius: 12 },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "700" },
  bottomSpacer: { height: 40 },
  // Skeleton
  skeletonContainer: { flex: 1, backgroundColor: "#f8fafc" },
  skeletonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  skeletonLogo: {
    width: 120,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  skeletonSection: { paddingHorizontal: 20, marginTop: 24 },
  skeletonQuickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonActionBtn: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  skeletonTitle: {
    width: 150,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    marginBottom: 16,
  },
  skeletonStoriesContainer: { flexDirection: "row" },
  skeletonStoryCard: { alignItems: "center", marginRight: 16, width: 90 },
  skeletonStoryRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#f3f4f6",
    marginBottom: 8,
    borderWidth: 3,
    borderColor: "#e5e7eb",
  },
  skeletonStoryAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e5e7eb",
    margin: 2,
  },
  skeletonStoryName: {
    width: 70,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  skeletonCommunityCard: {
    width: 140,
    height: 130,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    marginRight: 12,
  },
  skeletonEventCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
  },
  skeletonEventDate: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    marginRight: 14,
  },
  skeletonEventDetails: { flex: 1, gap: 8 },
  skeletonEventName: {
    width: "70%",
    height: 16,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  skeletonEventMeta: {
    width: "90%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
});
