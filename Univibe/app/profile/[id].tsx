// app/profile/[id].tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../../lib/AuthContext";
import { profileService } from "../../lib/profileService";

import ProfileHeader from "../components/Profile/ProfileHeader";
import ProfileInfo from "../components/Profile/ProfileInfo";
import ProfileStats from "../components/Profile/ProfileStats";
import { styles } from "../components/Profile/profileStyles";

interface PublicProfile {
  _id: string;
  user: {
    _id: string;
    username: string;
    email: string;
    profileComplete: boolean;
    name?: string;
  };
  fullName: string;
  username: string;
  bio: string;
  major: string;
  year: string;
  graduationYear: string;
  pronouns: string;
  profilePicture: string;
  coverPhoto: string;
  socialLinks: {
    instagram: string;
    linkedin: string;
    github: string;
  };
  stats: {
    posts: number;
    connections: number;
    groups: number;
  };
  isFollowing?: boolean;
  followerCount?: number;
  followingCount?: number;
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  // Hide tab bar when this screen mounts
  useEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: "none" },
      });
    }

    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: { display: "flex" },
        });
      }
    };
  }, [navigation]);

  // Load profile data
  const loadProfile = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await profileService.getPublicProfile(id);

      if (response.success && response.data) {
        const profileData = response.data.profile;
        const userData = response.data.user;

        setProfile({
          _id: profileData._id,
          user: {
            _id: userData._id,
            username: userData.username,
            email: userData.email || "",
            profileComplete: userData.profileComplete,
            name: userData.name,
          },
          fullName: profileData.fullName || userData.name || "User",
          username: profileData.username || userData.username,
          bio: profileData.bio || "",
          major: profileData.major || "",
          year: profileData.year || "",
          graduationYear: profileData.graduationYear || "",
          pronouns: profileData.pronouns || "",
          profilePicture: profileData.profilePicture || "",
          coverPhoto: profileData.coverPhoto || "",
          socialLinks: profileData.socialLinks || {
            instagram: "",
            linkedin: "",
            github: "",
          },
          stats: profileData.stats || { posts: 0, connections: 0, groups: 0 },
          isFollowing: profileData.isFollowing || false,
          followerCount: profileData.followerCount || 0,
          followingCount: profileData.followingCount || 0,
        });
        setIsFollowing(profileData.isFollowing || false);
      } else {
        Alert.alert("Error", response.message || "Failed to load profile");
        goBack();
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", error.message || "Failed to load profile");
      goBack();
    } finally {
      setLoading(false);
    }
  };

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!profile) return;

    setFollowLoading(true);
    try {
      const response = await profileService.toggleFollow(profile.user._id);

      if (response.success) {
        setIsFollowing(!isFollowing);
        // Update follower count in UI
        setProfile((prev: PublicProfile | null) => {
          if (!prev) return null;
          return {
            ...prev,
            followerCount: isFollowing
              ? (prev.followerCount || 0) - 1
              : (prev.followerCount || 0) + 1,
          };
        });
      } else {
        Alert.alert(
          "Error",
          response.message || "Failed to update follow status",
        );
      }
    } catch (error: any) {
      console.error("Follow error:", error);
      Alert.alert("Error", error.message || "Failed to update follow status");
    } finally {
      setFollowLoading(false);
    }
  };

  // Reload profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [id]),
  );

  // Go back function
  const goBack = () => {
    router.back();
  };

  // Format user data for ProfileHeader component
  const formattedUser = {
    _id: profile?.user._id,
    name: profile?.fullName,
    email: profile?.user.email,
    username: profile?.username,
    profileComplete: profile?.user.profileComplete,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noProfileContainer}>
          <Ionicons name="person-circle-outline" size={100} color="#d1d5db" />
          <Text style={styles.noProfileTitle}>Profile Not Found</Text>
          <Text style={styles.noProfileDescription}>
            The profile you're looking for doesn't exist.
          </Text>
          <TouchableOpacity style={styles.setupButton} onPress={goBack}>
            <Ionicons name="arrow-back-outline" size={20} color="white" />
            <Text style={styles.setupButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={publicStyles.header}>
        <TouchableOpacity onPress={goBack} style={publicStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={publicStyles.headerTitle} numberOfLines={1}>
          {profile.fullName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ProfileHeader
          user={formattedUser}
          profile={profile}
          uploading={false}
          coverUploading={false}
          onImagePress={() => {}}
          onCoverPhotoPress={() => {}}
          isPublicView={true}
        />

        <View style={styles.content}>
          {/* Follow Button for Other Profiles */}
          {!isOwnProfile && (
            <View style={publicStyles.followButtonContainer}>
              <TouchableOpacity
                style={[
                  publicStyles.followButton,
                  isFollowing && publicStyles.followingButton,
                ]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? "#8b5cf6" : "white"}
                  />
                ) : (
                  <>
                    <Ionicons
                      name={isFollowing ? "checkmark" : "person-add"}
                      size={20}
                      color={isFollowing ? "#8b5cf6" : "white"}
                    />
                    <Text
                      style={[
                        publicStyles.followButtonText,
                        isFollowing && publicStyles.followingButtonText,
                      ]}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <ProfileInfo profile={profile} user={profile.user} />

          <ProfileStats
            stats={{
              posts: profile.stats?.posts || 0,
              connections: profile.stats?.connections || 0,
              groups: profile.stats?.groups || 0,
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const publicStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  followButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  followButton: {
    backgroundColor: "#8b5cf6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  followingButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  followButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  followingButtonText: {
    color: "#8b5cf6",
  },
});
