import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../lib/contexts/ThemeContext";
import { useAuth } from "../../lib/contexts/AuthContext";
import { communityService } from "../../lib/services/communityService";
import { eventService, Event } from "../../lib/services/eventService";
import socketService from "../../lib/services/socketService";
import { useCommunity } from "../../hooks/community/useCommunity";
import { useCommunityPosts } from "../../hooks/community/useCommunityPosts";
import { useCommunityJoin } from "../../hooks/community/useCommunityJoin";
import CommunityHeader from "../components/community/CommunityHeader";
import CommunityCover from "../components/community/CommunityCover";
import CommunityBadges from "../components/community/CommunityBadges";
import JoinButton from "../components/community/JoinButton";
import CommunityTabs from "../components/community/CommunityTabs";
import PostList from "../components/community/PostList";
import EventCard from "../components/Events/EventCard";
import CreateModal from "../components/community/CreateModal";
import InviteModal from "../components/community/InviteModal";
import CommunitySettingsModal from "../components/community/CommunitySettingsModal";
import ConfirmDeleteModal from "../components/community/ConfirmDeleteModal";
import ReportModal from "../components/ReportModal";
import { API_BASE_URL } from "../../constants/ipConstants";

type TabType = "posts" | "events";

export default function CommunityScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  // Info Bar State
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const slideAnim = useRef(new Animated.Value(100)).current;

  const {
    community,
    loading,
    refreshing,
    isMember,
    isAdmin,
    isModerator,
    canManage,
    isApproved,
    isPending,
    isRejected,
    refresh,
  } = useCommunity(communityId);

  const {
    posts,
    loading: loadingPosts,
    likePost,
    removePost,
    loadPosts,
  } = useCommunityPosts(isApproved ? communityId : undefined, isMember);

  const { joining, joinRequested, join, leave } = useCommunityJoin(community, {
    onSuccess: (message) => {
      showInfoBar(message, "success");
    },
    onError: (message) => {
      showInfoBar(message, "error");
    },
    onRefresh: () => {
      refresh();
    },
  });

  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ✅ Community Events State
  const [communityEvents, setCommunityEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Info Bar Management
  const showInfoBar = (
    message: string,
    type: "success" | "error" | "info" = "info",
    autoHide = true,
  ) => {
    setInfoMessage(message);
    setInfoType(type);

    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      ...(autoHide
        ? [
            Animated.delay(3000),
            Animated.timing(slideAnim, {
              toValue: 100,
              duration: 300,
              useNativeDriver: true,
            }),
          ]
        : []),
    ]).start(() => {
      if (autoHide) {
        setInfoMessage(null);
        slideAnim.setValue(100);
      }
    });
  };

  const hideInfoBar = () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setInfoMessage(null);
      slideAnim.setValue(100);
    });
  };

  const renderInfoBar = () => {
    if (!infoMessage) return null;

    const bg =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : colors.primary;
    const icon =
      infoType === "success"
        ? "checkmark-circle"
        : infoType === "error"
          ? "alert-circle"
          : "information-circle";

    return (
      <Animated.View
        style={[
          styles.infoBar,
          { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.infoBarText}>{infoMessage}</Text>
      </Animated.View>
    );
  };

  // ✅ Fetch community events - MOVED UP BEFORE useEffect that uses it
  const fetchCommunityEvents = useCallback(async () => {
    if (!communityId || !isApproved) return;
    setLoadingEvents(true);
    try {
      const response = await communityService.getCommunityEvents(communityId);
      if (response.success && response.data) {
        const processedEvents = response.data.map((event: Event) => ({
          ...event,
          coverImage: event.coverImage
            ? event.coverImage.startsWith("http")
              ? event.coverImage
              : `${API_BASE_URL}/${event.coverImage.replace(/^\/+/, "")}`
            : event.coverImage,
          imageUrls: event.imageUrls?.map((url: string) =>
            url.startsWith("http")
              ? url
              : `${API_BASE_URL}/${url.replace(/^\/+/, "")}`,
          ),
        }));
        setCommunityEvents(processedEvents);
      }
    } catch (error) {
      console.error("Error fetching community events:", error);
    } finally {
      setLoadingEvents(false);
    }
  }, [communityId, isApproved]);

  // Join/leave community socket room
  useEffect(() => {
    if (communityId && isApproved && isMember) {
      socketService.emit("community:join", { communityId });
      return () => {
        socketService.emit("community:leave", { communityId });
      };
    }
  }, [communityId, isApproved, isMember]);

  // Listen for community updates
  useEffect(() => {
    if (!communityId || !isApproved) return;

    const handleCommunityUpdate = (data: {
      communityId: string;
      type: string;
      data: any;
    }) => {
      if (data.communityId !== communityId) return;
      refresh();
      loadPosts();
      fetchCommunityEvents();
    };

    socketService.on("community:updated", handleCommunityUpdate);
    return () => {
      socketService.off("community:updated", handleCommunityUpdate);
    };
  }, [communityId, isApproved, refresh, loadPosts, fetchCommunityEvents]);

  // Listen for new posts in this community
  useEffect(() => {
    if (!communityId || !isApproved || !isMember) return;

    const handleNewPost = (data: { communityId: string; post: any }) => {
      if (data.communityId === communityId) {
        loadPosts();
      }
    };

    socketService.on("community:new_post", handleNewPost);
    return () => {
      socketService.off("community:new_post", handleNewPost);
    };
  }, [communityId, isApproved, isMember, loadPosts]);

  // Listen for community leave events
  useEffect(() => {
    if (!communityId || !isApproved) return;

    const handleCommunityLeft = (data: {
      communityId: string;
      userId: string;
    }) => {
      console.log("community:left event received:", data);
      if (data.communityId === communityId && data.userId === user?.id) {
        refresh();
        loadPosts();
        fetchCommunityEvents();
      }
    };

    const handleMemberRemoved = (data: {
      communityId: string;
      userId: string;
    }) => {
      console.log("community:member_removed event received:", data);
      if (data.communityId === communityId && data.userId === user?.id) {
        refresh();
        loadPosts();
        fetchCommunityEvents();
      }
    };

    socketService.on("community:left", handleCommunityLeft);
    socketService.on("community:member_removed", handleMemberRemoved);

    return () => {
      socketService.off("community:left", handleCommunityLeft);
      socketService.off("community:member_removed", handleMemberRemoved);
    };
  }, [
    communityId,
    isApproved,
    user?.id,
    refresh,
    loadPosts,
    fetchCommunityEvents,
  ]);

  // ✅ Fetch events when community loads
  useEffect(() => {
    if (isApproved) {
      fetchCommunityEvents();
    }
  }, [isApproved, fetchCommunityEvents]);

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    refresh();
    loadPosts();
    fetchCommunityEvents();
  }, [refresh, loadPosts, fetchCommunityEvents]);

  // Handle RSVP from EventCard
  const handleRsvp = async (eventId: string) => {
    try {
      const response = await eventService.toggleRsvp(eventId);
      if (response.success) {
        setCommunityEvents((prev) =>
          prev.map((e) => {
            if (e._id !== eventId) return e;
            return {
              ...e,
              isRsvpd: response.isRsvpd ?? !e.isRsvpd,
              rsvpCount: response.rsvpCount ?? e.rsvpCount ?? 0,
            };
          }),
        );
        showInfoBar(
          response.isRsvpd ? "You RSVP'd to the event" : "RSVP cancelled",
          "success",
        );
      }
    } catch (error) {
      console.error("Error toggling RSVP:", error);
      showInfoBar("Failed to update RSVP", "error");
    }
  };

  // Handle Interest from EventCard
  const handleInterest = async (eventId: string) => {
    try {
      const response = await eventService.toggleInterest(eventId);
      if (response.success) {
        setCommunityEvents((prev) =>
          prev.map((e) => {
            if (e._id !== eventId) return e;
            return {
              ...e,
              isInterested: response.isInterested ?? !e.isInterested,
              interestedCount:
                response.interestedCount ?? e.interestedCount ?? 0,
            };
          }),
        );
        showInfoBar(
          response.isInterested
            ? "You marked interest in the event"
            : "Interest removed",
          "success",
        );
      }
    } catch (error) {
      console.error("Error toggling interest:", error);
      showInfoBar("Failed to update interest", "error");
    }
  };

  // Handle join/leave from JoinButton
  const handleJoin = async () => {
    await join();
  };

  const handleLeave = async () => {
    await leave();
  };

  // ✅ Opens the confirmation modal
  const handleDeleteCommunity = () => {
    setDeleteConfirmVisible(true);
  };

  // ✅ Actual delete after confirmation
  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const result = await communityService.deleteCommunity(communityId!);
      if (result.success) {
        setDeleteConfirmVisible(false);
        showInfoBar("Community deleted successfully", "success");
        setTimeout(() => router.back(), 1500);
      } else {
        setDeleteConfirmVisible(false);
        showInfoBar(result.message || "Failed to delete community", "error");
      }
    } catch (error: any) {
      setDeleteConfirmVisible(false);
      showInfoBar(error?.message || "Something went wrong", "error");
    } finally {
      setDeleting(false);
    }
  };

  const navigateToCreatePost = () => {
    setCreateModalVisible(false);
    router.push({
      pathname: "/components/Feed/Post/create",
      params: { communityId },
    });
  };

  const navigateToCreateEvent = () => {
    setCreateModalVisible(false);
    router.push({ pathname: "/events/create", params: { communityId } });
  };

  const navigateToRequests = () => {
    router.push({
      pathname: "/screens/JoinRequestsScreen",
      params: { communityId },
    } as any);
  };

  const navigateToEditDetails = () => {
    router.push({
      pathname: "/screens/EditCommunityScreen",
      params: { communityId },
    } as any);
  };

  const navigateToManageMembers = () => {
    router.push({
      pathname: "/screens/CommunityMembersScreen",
      params: { communityId },
    } as any);
  };

  const handleComment = (postId: string) => {
    router.push({
      pathname: "/components/Feed/Comment/CommentsScreen",
      params: { postId },
    });
  };

  const handleShareCommunity = () => {
    const Share = require("react-native").Share;
    Share.share({
      message: `Join ${community?.name} on Univibe! ${community?.description || ""}`,
    });
  };

  const handleViewRules = () => {
    if (community?.rules?.length) {
      Alert.alert(
        "Community Rules",
        community.rules
          .map((r: any, i: number) => `${i + 1}. ${r.title}\n${r.description}`)
          .join("\n\n"),
      );
    } else {
      Alert.alert(
        "Community Rules",
        "No rules have been set for this community.",
      );
    }
  };

  const handleInviteComplete = () => {
    setInviteModalVisible(false);
    refresh();
    showInfoBar("Invitation sent successfully", "success");
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!community) return null;

  // Pending approval state
  if (isPending) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <CommunityHeader
          community={community}
          onBack={() => router.back()}
          onCreatePress={() => {}}
          onRequestsPress={() => {}}
          onInvitePress={() => {}}
          onSettingsPress={() => {}}
        />
        <ScrollView contentContainerStyle={styles.statusScrollContent}>
          <CommunityCover community={community} onCoverUpdate={refresh} />
          <View style={styles.communityInfo}>
            <Text style={[styles.communityName, { color: colors.text }]}>
              {community.name}
            </Text>
            <CommunityBadges
              type={community.type}
              privacy={community.privacy}
            />
            {community.description ? (
              <Text
                style={[styles.communityDesc, { color: colors.textSecondary }]}
              >
                {community.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.statusContainer}>
            <View
              style={[styles.statusIconLarge, { backgroundColor: "#f59e0b20" }]}
            >
              <Ionicons name="time-outline" size={56} color="#f59e0b" />
            </View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>
              Pending Approval
            </Text>
            <Text
              style={[styles.statusMessage, { color: colors.textSecondary }]}
            >
              Your{" "}
              {community.type === "department" ? "department" : "community"} is
              currently under review.
            </Text>
            {canManage && (
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={navigateToEditDetails}
              >
                <Ionicons name="create-outline" size={18} color="#ffffff" />
                <Text style={styles.editButtonText}>Edit Details</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
        {renderInfoBar()}
      </SafeAreaView>
    );
  }

  // Rejected state (admin only)
  if (isRejected && canManage) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <CommunityHeader
          community={community}
          onBack={() => router.back()}
          onCreatePress={() => {}}
          onRequestsPress={() => {}}
          onInvitePress={() => {}}
          onSettingsPress={() => {}}
        />
        <ScrollView contentContainerStyle={styles.statusScrollContent}>
          <CommunityCover community={community} onCoverUpdate={refresh} />
          <View style={styles.communityInfo}>
            <Text style={[styles.communityName, { color: colors.text }]}>
              {community.name}
            </Text>
            <CommunityBadges
              type={community.type}
              privacy={community.privacy}
            />
            {community.description ? (
              <Text
                style={[styles.communityDesc, { color: colors.textSecondary }]}
              >
                {community.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.statusContainer}>
            <View
              style={[styles.statusIconLarge, { backgroundColor: "#ef444420" }]}
            >
              <Ionicons name="close-circle" size={56} color="#ef4444" />
            </View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>
              Community Rejected
            </Text>
            <Text
              style={[styles.statusMessage, { color: colors.textSecondary }]}
            >
              Your{" "}
              {community.type === "department" ? "department" : "community"} was
              not approved.
            </Text>
            {community.rejectionReason && (
              <View
                style={[
                  styles.rejectionReasonBox,
                  {
                    backgroundColor: isDark ? "#1e293b" : "#fef2f2",
                    borderColor: "#fecaca",
                  },
                ]}
              >
                <Text
                  style={[styles.rejectionReasonLabel, { color: "#ef4444" }]}
                >
                  Reason:
                </Text>
                <Text
                  style={[styles.rejectionReasonText, { color: colors.text }]}
                >
                  {community.rejectionReason}
                </Text>
              </View>
            )}
            <View style={styles.rejectedActions}>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={navigateToEditDetails}
                disabled={deleting}
              >
                <Ionicons name="create-outline" size={18} color="#ffffff" />
                <Text style={styles.editButtonText}>Edit & Resubmit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { borderColor: "#ef4444" }]}
                onPress={handleDeleteCommunity}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        {renderInfoBar()}
      </SafeAreaView>
    );
  }

  // Main approved state
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <CommunityHeader
        community={community}
        onBack={() => router.back()}
        onCreatePress={() => setCreateModalVisible(true)}
        onRequestsPress={navigateToRequests}
        onInvitePress={() => setInviteModalVisible(true)}
        onSettingsPress={() => setSettingsModalVisible(true)}
      />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <CommunityCover community={community} onCoverUpdate={refresh} />

        <View style={styles.communityInfo}>
          <Text style={[styles.communityName, { color: colors.text }]}>
            {community.name}
          </Text>
          <CommunityBadges type={community.type} privacy={community.privacy} />
          {community.description ? (
            <Text
              style={[styles.communityDesc, { color: colors.textSecondary }]}
            >
              {community.description}
            </Text>
          ) : null}
          {community.tags && community.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {community.tags.map((tag: string, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.primary + "15" },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.primary }]}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
            {community.memberCount}{" "}
            {community.memberCount === 1 ? "member" : "members"}
          </Text>
          <JoinButton
            isMember={isMember}
            isAdmin={isAdmin}
            privacy={community.privacy}
            joinRequested={joinRequested}
            joining={joining}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onRequestToJoin={handleJoin}
          />
        </View>

        <CommunityTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <View style={styles.tabContent}>
          {activeTab === "posts" && (
            <PostList
              posts={posts}
              loading={loadingPosts}
              isAdmin={canManage}
              onLike={likePost}
              onComment={handleComment}
              onDelete={removePost}
              onCreatePost={navigateToCreatePost}
            />
          )}
          {activeTab === "events" && (
            <View style={styles.eventsContainer}>
              {loadingEvents ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  style={{ paddingVertical: 40 }}
                />
              ) : communityEvents.length > 0 ? (
                communityEvents.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    currentUserId={user?.id}
                    showActions={true}
                    onInterestPress={handleInterest}
                    onRsvpPress={handleRsvp}
                  />
                ))
              ) : (
                <View style={styles.emptyTab}>
                  <Ionicons
                    name="calendar-outline"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    No events yet
                  </Text>
                  {canManage && (
                    <TouchableOpacity
                      style={[
                        styles.createFirstButton,
                        { backgroundColor: "#10b981" },
                      ]}
                      onPress={navigateToCreateEvent}
                    >
                      <Ionicons name="add" size={18} color="#ffffff" />
                      <Text style={styles.createFirstText}>
                        Create First Event
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <CreateModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreatePost={navigateToCreatePost}
        onCreateEvent={navigateToCreateEvent}
      />
      <InviteModal
        visible={inviteModalVisible}
        communityId={communityId!}
        communityName={community?.name || ""}
        isAdmin={canManage}
        isPrivate={community?.privacy === "private"}
        onClose={() => setInviteModalVisible(false)}
        onInvited={handleInviteComplete}
      />
      <CommunitySettingsModal
        visible={settingsModalVisible}
        community={community}
        isAdmin={isAdmin}
        isModerator={isModerator}
        isMember={isMember}
        onClose={() => setSettingsModalVisible(false)}
        onEditDetails={navigateToEditDetails}
        onManageMembers={navigateToManageMembers}
        onJoinRequests={navigateToRequests}
        onInviteUsers={() => {
          setSettingsModalVisible(false);
          setTimeout(() => setInviteModalVisible(true), 300);
        }}
        onLeaveCommunity={handleLeave}
        onViewRules={handleViewRules}
        onShareCommunity={handleShareCommunity}
        onReportCommunity={() => setReportModalVisible(true)}
        onDeleteCommunity={handleDeleteCommunity}
      />
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetType="Community"
        targetId={communityId!}
        targetName={community?.name}
        onShowInfoBar={(message, type) => {
          showInfoBar(message, type);
        }}
        reportFunction={communityService.reportCommunity}
      />

      <ConfirmDeleteModal
        visible={deleteConfirmVisible}
        communityName={community?.name || ""}
        onClose={() => {
          setDeleteConfirmVisible(false);
          setDeleting(false);
        }}
        onConfirm={handleConfirmDelete}
      />

      {/* Info Bar */}
      {renderInfoBar()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  statusScrollContent: { flexGrow: 1, paddingBottom: 40 },
  communityInfo: { padding: 16 },
  communityName: {
    fontSize: 22,
    fontFamily: "SofiaSans-Bold",
    marginBottom: 8,
  },
  communityDesc: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 8,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, fontFamily: "SofiaSans-SemiBold" },
  memberCount: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 12,
  },
  tabContent: { minHeight: 300 },
  eventsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, fontFamily: "SofiaSans-Regular", marginTop: 12 },
  createFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  createFirstText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  statusContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 40,
  },
  statusIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  statusTitle: { fontSize: 22, fontFamily: "SofiaSans-Bold", marginBottom: 10 },
  statusMessage: {
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  rejectionReasonBox: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontFamily: "SofiaSans-Bold",
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 20,
  },
  rejectedActions: {
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "SofiaSans-Bold",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    gap: 8,
  },
  deleteButtonText: {
    color: "#ef4444",
    fontSize: 15,
    fontFamily: "SofiaSans-Bold",
  },
  // Info Bar Styles
  infoBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 50 : 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 45,
    zIndex: 9999,
  },
  infoBarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
    flex: 1,
    textAlign: "left",
    lineHeight: 20,
  },
});
