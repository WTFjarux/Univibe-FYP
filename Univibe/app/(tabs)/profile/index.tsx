// app/(tabs)/profile/index.tsx - Fixed infinite loading, removed repost

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
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useAuth } from "../../../lib/contexts/AuthContext";
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
import { profileService } from "../../../lib/services/profileService";
import { profileCache } from "../../../lib/cache/profileCache";

import ProfileHeader from "@/app/components/Profile/ProfileHeader";
import ProfileInfo from "@/app/components/Profile/ProfileInfo";
import ProfileStats from "@/app/components/Profile/ProfileStats";
import ProfileTabs from "@/app/components/Profile/ProfileTabs";
import ProfilePosts from "@/app/components/Profile/ProfilePosts";
import UploadModal from "@/app/components/Profile/UploadModal";
import ImageViewModal from "@/app/components/Profile/ImageViewModal";
import { styles } from "@/app/components/Profile/profileStyles";

type TabType = "posts" | "about";

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch (error) {
    return null;
  }
};

const MemoizedProfilePosts = React.memo(ProfilePosts);

// Enable LayoutAnimation for Android
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
  const [postCount, setPostCount] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("about");

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  // Cache state
  const [isCached, setIsCached] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const isMounted = useRef(true);
  const refreshInProgress = useRef(false);
  const initialLoadDone = useRef(false);
  const mainScrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<any>(null);

  // Image upload hooks
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Handle tab change with smooth transition
   */
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab === activeTab) return;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveTab(tab);

      // Load posts when switching to posts tab if not loaded
      if (tab === "posts" && !postsLoaded && user?.id && !postsLoading) {
        fetchUserPosts(1, false);
      }
    },
    [activeTab, postsLoaded, user?.id, postsLoading],
  );

  /**
   * Fetch user's post count (with caching)
   */
  const fetchPostCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const cacheKey = `post_count_${user.id}`;
      const cached = profileCache.getFromMemory(cacheKey);

      if (cached && isMounted.current) {
        setPostCount(cached);
      }

      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/posts/user/${user.id}/count`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (data.success && isMounted.current) {
        setPostCount(data.count);
        profileCache.saveToMemory(cacheKey, data.count);
      }
    } catch (error) {
      // Silent fail - cached value remains
    }
  }, [user?.id]);

  /**
   * Fetch user's connection count (with caching)
   */
  const fetchConnectionCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const cacheKey = `connection_count_${user.id}`;
      const cached = profileCache.getFromMemory(cacheKey);

      if (cached && isMounted.current) {
        setConnectionCount(cached);
      }

      const response = await connectionService.getConnectionCount(user.id);
      if (response.success && response.data && isMounted.current) {
        setConnectionCount(response.data.connectionCount);
        profileCache.saveToMemory(cacheKey, response.data.connectionCount);
      }
    } catch (error) {
      // Silent fail
    }
  }, [user?.id]);

  /**
   * Fetch user's posts (with caching)
   */
  const fetchUserPosts = useCallback(
    async (page = 1, shouldAppend = false, forceRefresh = false) => {
      if (!user?.id) return;
      if (postsLoading && !forceRefresh) return;

      const cacheKey = `user_posts_${user.id}_page_${page}`;

      // Try cache first (for first page only)
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
          return;
        }
      }

      setPostsLoading(true);
      try {
        const response = await getProfilePosts(user.id, page, 10);

        if (response.success && response.data && isMounted.current) {
          const newPosts = response.data.posts;

          if (shouldAppend) {
            setPosts((prev) => [...prev, ...newPosts]);
          } else {
            setPosts(newPosts);
            // Cache first page results
            if (page === 1) {
              profileCache.saveToMemory(cacheKey, {
                posts: newPosts,
                hasMore: response.data.pagination.pages > page,
              });
            }
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
    // Clear cache for first page
    if (user?.id) {
      profileCache.clear(`user_posts_${user.id}_page_1`);
    }
    fetchUserPosts(1, false, true);
  };

  // Handle like action
  const handleLike = async (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to like posts");
      return;
    }

    try {
      const response = await toggleLike(postId);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId
            ? {
                ...post,
                isLiked: response.isLiked,
                likeCount: response.likes,
              }
            : post,
        ),
      );
      // Invalidate posts cache after like
      if (user?.id) {
        profileCache.clear(`user_posts_${user.id}_page_1`);
      }
    } catch (error: any) {
      console.error("Error liking post:", error);
      Alert.alert("Error", error.message || "Failed to like post");
    }
  };

  const handleComment = (postId: string) => {
    router.push({
      pathname: "/components/Feed/Comment/CommentsScreen",
      params: { postId },
    });
  };

  const handleShare = (postId: string) => {
    Alert.alert("Share", "Share feature coming soon!");
  };

  const handleEditPost = (postId: string) => {
    router.push({
      pathname: "/components/Feed/Post/EditPost",
      params: { postId },
    });
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((post) => post._id !== postId));
      setPostCount((prev) => Math.max(0, prev - 1));
      // Invalidate cache
      if (user?.id) {
        profileCache.clear(`user_posts_${user.id}_page_1`);
      }
      Alert.alert("Success", "Post deleted successfully");
    } catch (error: any) {
      console.error("Error deleting post:", error);
      Alert.alert("Error", error.message || "Failed to delete post");
    }
  };

  const handleSavePost = (postId: string) => {
    Alert.alert("Saved", "Post saved to your bookmarks");
  };

  const handleReportPost = (postId: string) => {
    Alert.alert("Report Submitted", "Thank you for reporting this post.");
  };

  const handleHidePost = (postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
    Alert.alert("Post Hidden", "You won't see this post anymore");
  };

  const handleCopyLink = (postId: string) => {
    Alert.alert("Link Copied", "Post link copied to clipboard");
  };

  const handleMuteUser = (userId: string) => {
    Alert.alert("User Muted", "You won't see posts from this user anymore");
  };

  const handleBlockUser = (userId: string) => {
    Alert.alert("User Blocked", "You won't see posts from this user anymore");
  };

  /**
   * Load initial data with caching
   */
  const loadInitialData = useCallback(async () => {
    if (refreshInProgress.current || initialLoadDone.current) return;
    refreshInProgress.current = true;
    setInitialLoading(true);

    try {
      // Load profile
      await loadProfile();

      // Load counts in parallel
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

  /**
   * Refresh all data (for pull-to-refresh)
   */
  const onRefresh = async () => {
    if (refreshing || refreshInProgress.current) return;

    setRefreshing(true);
    setIsCached(false);

    try {
      // Clear caches
      await profileCache.clear("my_profile");
      if (user?.id) {
        await profileCache.clear(`post_count_${user.id}`);
        await profileCache.clear(`connection_count_${user.id}`);
        await profileCache.clear(`user_posts_${user.id}_page_1`);
      }

      await loadProfile();
      await refreshUserProfile();
      await Promise.all([fetchPostCount(), fetchConnectionCount()]);

      if (activeTab === "posts") {
        await fetchUserPosts(1, false, true);
      }
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  };

  // Load profile on mount only once
  useEffect(() => {
    if (user?.id && !initialLoadDone.current && !authLoading) {
      loadInitialData();
    }
  }, [user?.id, authLoading, loadInitialData]);

  // Reload counts when profile changes
  useEffect(() => {
    if (profile && initialLoadDone.current) {
      fetchPostCount();
      fetchConnectionCount();
    }
  }, [profile, fetchPostCount, fetchConnectionCount]);

  // Load posts only when switching to posts tab
  useEffect(() => {
    if (
      activeTab === "posts" &&
      !postsLoaded &&
      user?.id &&
      !postsLoading &&
      initialLoadDone.current
    ) {
      fetchUserPosts(1, false);
    }
  }, [
    activeTab,
    postsLoaded,
    user?.id,
    postsLoading,
    initialLoadDone.current,
    fetchUserPosts,
  ]);

  // Refresh on screen focus
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
          await profileCache.clearAll();
          await logout();
          router.push("/(auth)/login");
        },
      },
    ]);
  };

  // ============ PROFILE PICTURE HANDLERS ============

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
      console.error("Gallery pick error:", error);
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
      console.error("Camera error:", error);
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

  // ============ COVER PHOTO HANDLERS ============

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
      console.error("Cover gallery error:", error);
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
      console.error("Cover camera error:", error);
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

  // ============ RENDER HELPERS ============

  const formattedUser = {
    _id: user?.id,
    name: user?.name || profile?.fullName,
    email: user?.email,
    username: user?.username || profile?.username,
    profileComplete: user?.profileComplete,
  };

  // Memoize header
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

  // Memoize tabs
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

  // Memoize posts props (NO repost)
  const postsProps = useMemo(
    () => ({
      posts,
      loading: postsLoading && !postsLoaded,
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
    [posts, postsLoading, postsLoaded, postsRefreshing, hasMorePosts],
  );

  // Memoize about content
  const aboutContentOnly = useMemo(
    () => (
      <View style={styles.aboutContent}>
        {isCached && (
          <View style={cacheStyles.cacheIndicator}>
            <Ionicons name="cloud-outline" size={12} color="#9ca3af" />
            <Text style={cacheStyles.cacheText}>Loaded from cache</Text>
          </View>
        )}
        <ProfileInfo profile={profile} user={user} />
        <ProfileStats
          stats={{
            posts: postCount,
            connections: connectionCount,
            groups: profile?.stats?.groups || 0,
          }}
        />
        <View style={menuStyles.menuSection}>
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() => router.push("/profile/edit")}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="create-outline" size={22} color="#4b5563" />
              <Text style={menuStyles.menuText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <View style={menuStyles.divider} />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() =>
              Alert.alert("Coming Soon", "Settings feature coming soon!")
            }
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="settings-outline" size={22} color="#4b5563" />
              <Text style={menuStyles.menuText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <View style={menuStyles.divider} />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() =>
              Alert.alert("Coming Soon", "Help & Support coming soon!")
            }
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="help-circle-outline" size={22} color="#4b5563" />
              <Text style={menuStyles.menuText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <View style={menuStyles.divider} />
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
    [profile, user, postCount, connectionCount, isCached],
  );

  // Loading state
  if ((authLoading || initialLoading) && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // No profile state
  if (!profile && !authLoading && !initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noProfileContainer}>
          <Ionicons name="person-circle-outline" size={100} color="#d1d5db" />
          <Text style={styles.noProfileTitle}>Complete Your Profile</Text>
          <Text style={styles.noProfileDescription}>
            Setup your profile to connect with other students
          </Text>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => router.push("/(auth)/setup-profile")}
          >
            <Ionicons name="person-add-outline" size={20} color="white" />
            <Text style={styles.setupButtonText}>Setup Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // About tab
  if (activeTab === "about") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView
          ref={mainScrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scrollStyles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8b5cf6"
              colors={["#8b5cf6"]}
            />
          }
        >
          {profileHeader}
          {profileTabs}
          {aboutContentOnly}
        </ScrollView>
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
      </SafeAreaView>
    );
  }

  // Posts tab
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {isCached && (
        <View style={cacheStyles.cacheHeader}>
          <Ionicons name="cloud-outline" size={12} color="#9ca3af" />
          <Text style={cacheStyles.cacheHeaderText}>Loaded from cache</Text>
        </View>
      )}
      <MemoizedProfilePosts
        {...postsProps}
        listHeaderComponent={
          <>
            {profileHeader}
            {profileTabs}
          </>
        }
      />
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
    </SafeAreaView>
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
  scrollContent: { paddingBottom: 20 },
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
