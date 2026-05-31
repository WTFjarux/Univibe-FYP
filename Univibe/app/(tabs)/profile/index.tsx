// app/(tabs)/profile/index.tsx

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  RefreshControl,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useAuth } from "../../../lib/contexts/AuthContext";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { useImageUpload } from "../../../hooks/useImageUpload";
import { useCoverPhotoUpload } from "../../../hooks/useCoverPhotoUpload";
import { connectionService } from "../../../lib/services/connectionService";
import {
  getProfilePosts,
  toggleLike,
  deletePost,
  Post,
} from "../../../lib/services/postService";
import { API_BASE_URL } from "../../../constants/ipConstants";
import { profileCache } from "../../../lib/cache/profileCache";

import ProfileHeader from "@/app/components/Profile/ProfileHeader";
import ProfileInfo from "@/app/components/Profile/ProfileInfo";
import ProfileStats from "@/app/components/Profile/ProfileStats";
import ProfileTabs from "@/app/components/Profile/ProfileTabs";
import ProfilePosts from "@/app/components/Profile/ProfilePosts";
import UploadModal from "@/app/components/Profile/UploadModal";
import ImageViewModal from "@/app/components/Profile/ImageViewModal";
import SettingsScreen from "@/app/settings";
import { styles } from "@/app/components/Profile/profileStyles";
import OwnProfilePageSkeleton, {
  OwnPostsLoadingSkeleton,
  OwnLoadingMorePostsSkeleton,
} from "@/app/components/Profile/OwnProfileSkeleton";

type TabType = "posts" | "about";

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch (error) {
    return null;
  }
};

const MemoizedProfilePosts = React.memo(ProfilePosts);

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProfileScreen() {
  const {
    user,
    profile,
    isLoading: authLoading,
    logout,
    loadProfile,
    refreshUserProfile,
    token,
  } = useAuth();
  const { colors } = useTheme();
  const [postCount, setPostCount] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [showSettings, setShowSettings] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  const [postsInitialLoading, setPostsInitialLoading] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  const [isCached, setIsCached] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const isMounted = useRef(true);
  const refreshInProgress = useRef(false);
  const initialLoadDone = useRef(false);
  const mainScrollViewRef = useRef<ScrollView>(null);

  const {
    uploadModal,
    viewPhotoModal,
    uploading,
    openUploadModal,
    closeUploadModal,
    openImageViewer,
    closeImageViewer,
    uploadProfileImage,
    deleteProfileImage,
  } = useImageUpload();

  const {
    coverModal,
    coverViewModal,
    coverUploading,
    openCoverModal,
    closeCoverModal,
    openCoverImageViewer,
    closeCoverImageViewer,
    uploadCoverPhoto,
    deleteCoverPhoto,
  } = useCoverPhotoUpload();

  const pickerActiveRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab === activeTab) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveTab(tab);
      if (tab === "posts" && !postsLoaded && user?.id && !postsLoading) {
        fetchUserPosts(1, false);
      }
    },
    [activeTab, postsLoaded, user?.id, postsLoading],
  );

  const fetchPostCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cacheKey = `post_count_${user.id}`;
      const cached = profileCache.getFromMemory(cacheKey);
      if (cached && isMounted.current) setPostCount(cached);
      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/posts/user/${user.id}/count`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (data.success && isMounted.current) {
        setPostCount(data.count);
        profileCache.saveToMemory(cacheKey, data.count);
      }
    } catch (error) {}
  }, [user?.id]);

  const fetchConnectionCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cacheKey = `connection_count_${user.id}`;
      const cached = profileCache.getFromMemory(cacheKey);
      if (cached && isMounted.current) setConnectionCount(cached);
      const response = await connectionService.getConnectionCount(user.id);
      if (response.success && response.data && isMounted.current) {
        setConnectionCount(response.data.connectionCount);
        profileCache.saveToMemory(cacheKey, response.data.connectionCount);
      }
    } catch (error) {}
  }, [user?.id]);

  const fetchUserPosts = useCallback(
    async (page = 1, shouldAppend = false, forceRefresh = false) => {
      if (!user?.id) return;
      if (postsLoading && !forceRefresh) return;
      const cacheKey = `user_posts_${user.id}_page_${page}`;
      if (shouldAppend) setLoadingMorePosts(true);
      else if (!forceRefresh) setPostsInitialLoading(true);
      setPostsLoading(true);
      if (
        !forceRefresh &&
        page === 1 &&
        !shouldAppend &&
        posts.length === 0 &&
        !postsLoading
      ) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (
          cached &&
          cached.posts &&
          cached.posts.length > 0 &&
          isMounted.current
        ) {
          setPosts(cached.posts);
          setHasMorePosts(cached.hasMore);
          setPostsPage(page);
          setPostsLoaded(true);
          setIsCached(true);
          setPostsInitialLoading(false);
          setPostsLoading(false);
          return;
        }
      }
      try {
        const response = await getProfilePosts(user.id, page, 10);
        if (response.success && response.data && isMounted.current) {
          const newPosts = response.data.posts;
          if (shouldAppend) setPosts((prev) => [...prev, ...newPosts]);
          else {
            setPosts(newPosts);
            if (page === 1)
              profileCache.saveToMemory(cacheKey, {
                posts: newPosts,
                hasMore: response.data.pagination.pages > page,
              });
          }
          setHasMorePosts(response.data.pagination.pages > page);
          setPostsPage(page);
          setPostsLoaded(true);
          setIsCached(false);
        }
      } catch (error) {
        console.error("Error fetching user posts:", error);
      } finally {
        if (isMounted.current) {
          setPostsLoading(false);
          setPostsRefreshing(false);
          setPostsInitialLoading(false);
          setLoadingMorePosts(false);
        }
      }
    },
    [user?.id, postsLoading, posts.length],
  );

  const loadMorePosts = () => {
    if (!postsLoading && hasMorePosts && postsLoaded && !postsRefreshing) {
      fetchUserPosts(postsPage + 1, true);
    }
  };

  const refreshPosts = () => {
    if (postsRefreshing) return;
    setPostsRefreshing(true);
    if (user?.id) profileCache.clear(`user_posts_${user.id}_page_1`);
    fetchUserPosts(1, false, true);
  };

  const handleLike = async (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to like posts");
      return;
    }
    try {
      const response = await toggleLike(postId);
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId
            ? { ...post, isLiked: response.isLiked, likeCount: response.likes }
            : post,
        ),
      );
      if (user?.id) profileCache.clear(`user_posts_${user.id}_page_1`);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to like post");
    }
  };

  const handleComment = (postId: string) =>
    router.push({
      pathname: "/components/Feed/Comment/CommentsScreen",
      params: { postId },
    });
  const handleShare = () => Alert.alert("Share", "Share feature coming soon!");
  const handleEditPost = (postId: string) =>
    router.push({
      pathname: "/components/Feed/Post/EditPost",
      params: { postId },
    });
  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((post) => post._id !== postId));
      setPostCount((prev) => Math.max(0, prev - 1));
      if (user?.id) profileCache.clear(`user_posts_${user.id}_page_1`);
      Alert.alert("Success", "Post deleted successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to delete post");
    }
  };
  const handleSavePost = () =>
    Alert.alert("Saved", "Post saved to your bookmarks");

  const handleReportPost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === postId ? { ...p, isReported: true } : p)),
    );
    Alert.alert("Report Submitted", "Thank you for reporting this post.");
  };

  const handleHidePost = (postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
    Alert.alert("Post Hidden", "You won't see this post anymore");
  };

  const handleCopyLink = () =>
    Alert.alert("Link Copied", "Post link copied to clipboard");

  const handleMuteUser = () =>
    Alert.alert("User Muted", "You won't see posts from this user anymore");

  const handleBlockUser = () =>
    Alert.alert("User Blocked", "You won't see posts from this user anymore");

  const loadInitialData = useCallback(async () => {
    if (refreshInProgress.current || initialLoadDone.current) return;
    refreshInProgress.current = true;
    setInitialLoading(true);
    try {
      await loadProfile();
      await Promise.all([fetchPostCount(), fetchConnectionCount()]);
      initialLoadDone.current = true;
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      if (isMounted.current) {
        setInitialLoading(false);
        refreshInProgress.current = false;
      }
    }
  }, [loadProfile, fetchPostCount, fetchConnectionCount]);

  const onRefresh = async () => {
    if (refreshing || refreshInProgress.current) return;
    setRefreshing(true);
    setIsCached(false);
    try {
      await profileCache.clear("my_profile");
      if (user?.id) {
        await profileCache.clear(`post_count_${user.id}`);
        await profileCache.clear(`connection_count_${user.id}`);
        await profileCache.clear(`user_posts_${user.id}_page_1`);
      }
      await loadProfile();
      await refreshUserProfile();
      await Promise.all([fetchPostCount(), fetchConnectionCount()]);
      if (activeTab === "posts") await fetchUserPosts(1, false, true);
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id && !initialLoadDone.current && !authLoading) loadInitialData();
  }, [user?.id, authLoading, loadInitialData]);
  useEffect(() => {
    if (profile && initialLoadDone.current) {
      fetchPostCount();
      fetchConnectionCount();
    }
  }, [profile, fetchPostCount, fetchConnectionCount]);
  useEffect(() => {
    if (
      activeTab === "posts" &&
      !postsLoaded &&
      user?.id &&
      !postsLoading &&
      initialLoadDone.current
    )
      fetchUserPosts(1, false);
  }, [
    activeTab,
    postsLoaded,
    user?.id,
    postsLoading,
    initialLoadDone.current,
    fetchUserPosts,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id && initialLoadDone.current && !refreshInProgress.current) {
        fetchPostCount();
        fetchConnectionCount();
      }
    }, [
      user?.id,
      fetchPostCount,
      fetchConnectionCount,
      initialLoadDone.current,
    ]),
  );

  const handleLogoutConfirm = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setShowSettings(false);
          await profileCache.clearAll();
          await logout();
          router.push("/(auth)/login");
        },
      },
    ]);
  };

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  const handleGalleryPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo access to upload profile pictures.",
          );
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      closeUploadModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadProfileImage(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select image");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleCameraPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take photos.",
          );
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      closeUploadModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadProfileImage(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleDeleteProfileImage = async () => {
    const success = await deleteProfileImage();
    if (success) {
      closeUploadModal();
      await profileCache.clear("my_profile");
      await loadProfile();
      await refreshUserProfile();
      await fetchPostCount();
      await fetchConnectionCount();
    }
  };

  const handleImagePress = () => openUploadModal();

  const handleCoverGalleryPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo access to upload cover photos.",
          );
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      closeCoverModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadCoverPhoto(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select image");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleCoverCameraPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take photos.",
          );
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      closeCoverModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadCoverPhoto(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleDeleteCoverPhoto = async () => {
    const success = await deleteCoverPhoto();
    if (success) {
      closeCoverModal();
      await profileCache.clear("my_profile");
      await loadProfile();
      await refreshUserProfile();
      await fetchPostCount();
      await fetchConnectionCount();
    }
  };

  const handleCoverPhotoPress = () => openCoverModal();

  const formattedUser = {
    _id: user?.id,
    name: user?.name || profile?.fullName,
    email: user?.email,
    username: user?.username || profile?.username,
    profileComplete: user?.profileComplete,
  };

  const profileHeader = useMemo(
    () => (
      <ProfileHeader
        user={formattedUser}
        profile={profile}
        uploading={uploading || pickerActiveRef.current}
        coverUploading={coverUploading}
        onImagePress={handleImagePress}
        onCoverPhotoPress={handleCoverPhotoPress}
      />
    ),
    [
      formattedUser,
      profile,
      uploading,
      pickerActiveRef.current,
      coverUploading,
    ],
  );

  const profileTabs = useMemo(
    () => (
      <ProfileTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        postCount={postCount}
      />
    ),
    [activeTab, postCount],
  );

  const postsProps = useMemo(
    () => ({
      posts,
      loading: postsInitialLoading,
      refreshing: postsRefreshing,
      onRefresh: refreshPosts,
      onLoadMore: loadMorePosts,
      hasMore: hasMorePosts,
      onLikePress: handleLike,
      onCommentPress: handleComment,
      onSharePress: handleShare,
      onEdit: handleEditPost,
      onDelete: handleDeletePost,
      onSave: handleSavePost,
      onReport: handleReportPost,
      onHide: handleHidePost,
      onCopyLink: handleCopyLink,
      onMuteUser: handleMuteUser,
      onBlockUser: handleBlockUser,
    }),
    [posts, postsInitialLoading, postsRefreshing, hasMorePosts],
  );

  const aboutContentOnly = useMemo(
    () => (
      <View style={styles.aboutContent}>
        {isCached && (
          <View style={cacheStyles.cacheIndicator}>
            <Ionicons name="cloud-outline" size={12} color={colors.textMuted} />
            <Text style={[cacheStyles.cacheText, { color: colors.textMuted }]}>
              Loaded from cache
            </Text>
          </View>
        )}
        <ProfileInfo profile={profile} user={user} />
        <ProfileStats
          stats={{
            posts: postCount,
            connections: connectionCount,
            communities: profile?.stats?.communities || 0,
          }}
          userId={user?.id || profile?.user?._id}
        />
        <View
          style={[
            menuStyles.menuSection,
            { backgroundColor: colors.card, shadowColor: colors.shadow },
          ]}
        >
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() => router.push("/profile/edit")}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="create-outline" size={22} color={colors.icon} />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Edit Profile
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() => router.push("/screens/CommunitiesListScreen" as any)}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="people-outline" size={22} color={colors.icon} />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Communities
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="settings-outline" size={22} color={colors.icon} />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Settings
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() =>
              Alert.alert("Coming Soon", "Help & Support coming soon!")
            }
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons
                name="help-circle-outline"
                size={22}
                color={colors.icon}
              />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Help & Support
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={handleLogoutConfirm}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              <Text style={[menuStyles.menuText, { color: "#ef4444" }]}>
                Logout
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [profile, user, postCount, connectionCount, isCached, colors],
  );

  // ============ RENDER ============

  if ((authLoading || initialLoading) && !profile) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <OwnProfilePageSkeleton />
      </SafeAreaView>
    );
  }

  if (!profile && !authLoading && !initialLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.noProfileContainer}>
          <Ionicons
            name="person-circle-outline"
            size={100}
            color={colors.textMuted}
          />
          <Text style={[styles.noProfileTitle, { color: colors.text }]}>
            Complete Your Profile
          </Text>
          <Text
            style={[
              styles.noProfileDescription,
              { color: colors.textSecondary },
            ]}
          >
            Setup your profile to connect with other students
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/setup-profile")}
          >
            <Ionicons name="person-add-outline" size={20} color="white" />
            <Text style={styles.setupButtonText}>Setup Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ SINGLE RETURN - modals rendered ONCE outside tab conditions
  return (
    <>
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        {activeTab === "about" ? (
          <ScrollView
            ref={mainScrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={scrollStyles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.card}
              />
            }
          >
            {profileHeader}
            {profileTabs}
            {aboutContentOnly}
          </ScrollView>
        ) : (
          <>
            {isCached && (
              <View
                style={[
                  cacheStyles.cacheHeader,
                  {
                    backgroundColor: colors.background,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="cloud-outline"
                  size={12}
                  color={colors.textMuted}
                />
                <Text
                  style={[
                    cacheStyles.cacheHeaderText,
                    { color: colors.textMuted },
                  ]}
                >
                  Loaded from cache
                </Text>
              </View>
            )}
            <MemoizedProfilePosts
              {...postsProps}
              listHeaderComponent={
                <>
                  {profileHeader}
                  {profileTabs}
                  {postsInitialLoading && <OwnPostsLoadingSkeleton />}
                </>
              }
              listFooterComponent={
                loadingMorePosts ? <OwnLoadingMorePostsSkeleton /> : null
              }
            />
          </>
        )}
      </SafeAreaView>

      {/* Modals - rendered ONCE */}
      <UploadModal
        visible={uploadModal}
        onClose={closeUploadModal}
        onViewImage={openImageViewer}
        onPickImage={handleGalleryPick}
        onTakePhoto={handleCameraPick}
        onDeletePhoto={handleDeleteProfileImage}
        hasExistingImage={
          !!profile?.profilePicture &&
          !profile.profilePicture.includes("dicebear.com")
        }
        title="Profile Picture"
        viewLabel="View Profile Picture"
        deleteLabel="Remove Profile Picture"
      />
      <UploadModal
        visible={coverModal}
        onClose={closeCoverModal}
        onViewImage={openCoverImageViewer}
        onPickImage={handleCoverGalleryPick}
        onTakePhoto={handleCoverCameraPick}
        onDeletePhoto={handleDeleteCoverPhoto}
        hasExistingImage={!!profile?.coverPhoto}
        title="Cover Photo"
        viewLabel="View Cover Photo"
      />
      <ImageViewModal
        visible={viewPhotoModal}
        imageUri={profile?.profilePicture}
        onClose={closeImageViewer}
        title="Profile Picture"
        isCoverPhoto={false}
      />
      <ImageViewModal
        visible={coverViewModal}
        imageUri={profile?.coverPhoto}
        onClose={closeCoverImageViewer}
        title="Cover Photo"
        isCoverPhoto={true}
      />

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseSettings}
      >
        <SettingsScreen
          onLogout={() => {
            handleCloseSettings();
            handleLogoutConfirm();
          }}
          userId={user?.id || ""}
          onClose={handleCloseSettings}
        />
      </Modal>
    </>
  );
}

const menuStyles = StyleSheet.create({
  menuSection: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  menuItemContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  menuText: {
    fontSize: 18,
    color: "#374151",
    fontWeight: "500",
    marginLeft: 12,
    fontFamily: "SofiaSans-Regular",
  },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginLeft: 52 },
});

const scrollStyles = StyleSheet.create({
  scrollContent: { paddingBottom: Platform.OS === "ios" ? 90 : 80 },
});

const cacheStyles = StyleSheet.create({
  cacheIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
    marginBottom: 8,
  },
  cacheText: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
  cacheHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cacheHeaderText: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
});
