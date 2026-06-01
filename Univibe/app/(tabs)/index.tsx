import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
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
import HomeScreenSkeleton from "../components/home/HomeScreenSkeleton";

import type { StoryGroup } from "../../lib/services/storyApi";

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
  const [communityRefreshTrigger, setCommunityRefreshTrigger] = useState(0);

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

    const handleCommunityChange = () => {
      setCommunityRefreshTrigger((prev) => prev + 1);
    };

    socketService.on("community:joined", handleCommunityChange);
    socketService.on("community:left", handleCommunityChange);
    socketService.on("community:member_added", handleCommunityChange);
    socketService.on("community:member_removed", handleCommunityChange);

    return () => {
      socketService.off("community:joined", handleCommunityChange);
      socketService.off("community:left", handleCommunityChange);
      socketService.off("community:member_added", handleCommunityChange);
      socketService.off("community:member_removed", handleCommunityChange);
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
        <MyCommunities
          key={`my-communities-${communityRefreshTrigger}`}
          limit={5}
        />

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
});
