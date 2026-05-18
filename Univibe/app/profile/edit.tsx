// app/profile/edit.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { profileService } from "../../lib/services/profileService";
import { useAuth } from "../../lib/contexts/AuthContext";
import UploadModal from "../components/Profile/UploadModal";
import ImageViewModal from "../components/Profile/ImageViewModal";
import { API_BASE_URL } from "../../constants/ipConstants";
import DiscardChangesModal from "../components/DiscardChangesModal";

// Import shared components and constants
import {
  ScrollableDropdown,
  YearSelector,
  PronounsSelector,
  BioInput,
  SocialLinksInput,
} from "../components/Profile/FormComponent";
import { GRADUATION_YEARS, MAJORS } from "../../constants/profileConstants";

// Local default avatar
const DEFAULT_AVATAR: ImageSourcePropType = require("../../assets/images/default-avatar.png");

// Interface for user profile data structure
interface UserProfile {
  username: string;
  fullName: string;
  bio: string;
  major: string;
  year: string;
  graduationYear: string;
  pronouns: string;
  universityEmail: string;
  profilePicture: string;
  instagram: string;
  linkedin: string;
  github: string;
}

// Type for fields that can be updated
type UpdatableFields = Omit<UserProfile, "username">;

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { loadProfile: refreshGlobalProfile } = useAuth();
  const pickerActiveRef = useRef(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // State management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [viewPhotoModal, setViewPhotoModal] = useState(false);
  const [originalUser, setOriginalUser] = useState<UserProfile | null>(null);
  const [pendingChanges, setPendingChanges] = useState<
    Partial<UpdatableFields>
  >({});
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const [user, setUser] = useState<UserProfile>({
    fullName: "",
    username: "",
    major: "",
    year: "",
    graduationYear: "",
    bio: "",
    pronouns: "",
    universityEmail: "",
    profilePicture: "",
    instagram: "",
    linkedin: "",
    github: "",
  });

  /**
   * Helper function to get profile image with local default fallback
   */
  const getProfileImageSource = useCallback(
    (imageUrl: string | undefined): ImageSourcePropType => {
      if (selectedImageUri) {
        return { uri: selectedImageUri };
      }

      if (imageUrl && imageUrl.trim() !== "") {
        let url = imageUrl;
        if (url.startsWith("/")) {
          url = `${API_BASE_URL}${url}`;
        }
        return { uri: url };
      }

      return DEFAULT_AVATAR;
    },
    [selectedImageUri],
  );

  // Hide tab bar when screen mounts
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

  // Load profile data when component mounts
  useEffect(() => {
    loadProfile();
  }, []);

  /**
   * Fetch user profile data from API and update state
   */
  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await profileService.getProfileDetails();

      if (response.success && response.data) {
        const { user: userData, profile } = response.data;

        const userProfile: UserProfile = {
          username: userData.username || "",
          fullName: profile.fullName || "",
          bio: profile.bio || "",
          major: profile.major || "",
          year: profile.year || "",
          graduationYear: profile.graduationYear || "",
          pronouns: profile.pronouns || "",
          universityEmail: profile.universityEmail || userData.email || "",
          profilePicture: profile.profilePicture || "",
          instagram: profile.socialLinks?.instagram || "",
          linkedin: profile.socialLinks?.linkedin || "",
          github: profile.socialLinks?.github || "",
        };

        setUser(userProfile);
        setOriginalUser(userProfile);
        setPendingChanges({});
        setSelectedImageUri(null);
        setAvatarError(false);
      } else {
        Alert.alert("Error", "Failed to load profile data");
        handleDiscard();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load profile");
      handleDiscard();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle text field changes
   */
  const handleFieldChange = useCallback(
    <K extends keyof UpdatableFields>(field: K, value: UpdatableFields[K]) => {
      setUser((prev) => ({ ...prev, [field]: value }));
      setPendingChanges((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  /**
   * Handle year selection
   */
  const handleYearSelect = useCallback(
    (year: string) => {
      handleFieldChange("year", year);
    },
    [handleFieldChange],
  );

  /**
   * Handle pronouns selection
   */
  const handlePronounsSelect = useCallback(
    (pronouns: string) => {
      handleFieldChange("pronouns", pronouns);
    },
    [handleFieldChange],
  );

  /**
   * Handle major selection
   */
  const handleMajorSelect = useCallback(
    (major: string) => {
      handleFieldChange("major", major);
    },
    [handleFieldChange],
  );

  /**
   * Handle graduation year selection
   */
  const handleGraduationYearSelect = useCallback(
    (year: string) => {
      handleFieldChange("graduationYear", year);
    },
    [handleFieldChange],
  );

  /**
   * Check if there are unsaved changes
   */
  const hasUnsavedChanges = useCallback(() => {
    return Object.keys(pendingChanges).length > 0 || selectedImageUri !== null;
  }, [pendingChanges, selectedImageUri]);

  /**
   * Handle back button press - shows discard modal if changes exist
   */
  const handleBackPress = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowDiscardModal(true);
    } else {
      navigateToProfile();
    }
  }, [hasUnsavedChanges]);

  /**
   * Navigate to profile screen
   */
  const navigateToProfile = useCallback(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: "flex" },
      });
    }
    router.replace("/(tabs)/profile");
  }, [navigation]);

  /**
   * Handle discard changes confirmation
   */
  const handleDiscardChanges = useCallback(() => {
    setShowDiscardModal(false);
    navigateToProfile();
  }, [navigateToProfile]);

  /**
   * Handle discard/back button press - OLD function kept for compatibility
   */
  const handleDiscard = useCallback(() => {
    handleBackPress();
  }, [handleBackPress]);

  /**
   * Handle profile picture upload
   */
  const handleProfilePictureUpload = useCallback(
    async (imageUri: string): Promise<string> => {
      setUploadingImage(true);
      try {
        const uploadResponse =
          await profileService.uploadProfilePicture(imageUri);
        if (uploadResponse.success) {
          console.log(
            "Profile picture uploaded successfully:",
            uploadResponse.data.profilePicture,
          );
          return uploadResponse.data.profilePicture;
        } else {
          throw new Error(
            uploadResponse.message || "Failed to upload profile picture",
          );
        }
      } finally {
        setUploadingImage(false);
      }
    },
    [],
  );

  /**
   * Handle profile picture deletion
   */
  const handleProfilePictureDeletion =
    useCallback(async (): Promise<boolean> => {
      setUploadingImage(true);
      try {
        const deleteResponse = await profileService.deleteProfilePicture();
        if (deleteResponse.success) {
          console.log("Profile picture deleted successfully");
          return true;
        } else {
          console.log(
            "Failed to delete profile picture:",
            deleteResponse.message,
          );
          return false;
        }
      } catch (deleteError: any) {
        console.error("Delete profile picture error:", deleteError);
        return false;
      } finally {
        setUploadingImage(false);
      }
    }, []);

  /**
   * Build update payload from pending changes
   */
  const buildUpdatePayload = useCallback(() => {
    const updatePayload: any = {
      username: user.username,
    };

    // Add all pending changes except social links and profile picture
    (Object.keys(pendingChanges) as Array<keyof UpdatableFields>).forEach(
      (key) => {
        if (key !== "profilePicture") {
          updatePayload[key] = pendingChanges[key];
        }
      },
    );

    // Handle social links separately
    const socialLinksChanged =
      pendingChanges.instagram !== undefined ||
      pendingChanges.linkedin !== undefined ||
      pendingChanges.github !== undefined;

    if (socialLinksChanged) {
      updatePayload.socialLinks = {
        instagram:
          pendingChanges.instagram !== undefined
            ? pendingChanges.instagram
            : originalUser?.instagram || "",
        linkedin:
          pendingChanges.linkedin !== undefined
            ? pendingChanges.linkedin
            : originalUser?.linkedin || "",
        github:
          pendingChanges.github !== undefined
            ? pendingChanges.github
            : originalUser?.github || "",
      };
    }

    // Handle profile picture
    if (selectedImageUri) {
      // New image selected - will be handled by upload
      updatePayload.hasNewImage = true;
    } else if (pendingChanges.profilePicture === "") {
      // Delete existing image
      updatePayload.deleteProfilePicture = true;
    }

    return updatePayload;
  }, [user.username, pendingChanges, originalUser, selectedImageUri]);

  /**
   * Update local storage after successful save
   */
  const updateLocalStorage = useCallback(
    async (profilePictureUrl: string) => {
      try {
        const localData = await AsyncStorage.getItem("profile_data");
        if (localData) {
          const parsedData = JSON.parse(localData);
          parsedData.profile = {
            ...parsedData.profile,
            fullName: user.fullName,
            bio: user.bio,
            major: user.major,
            year: user.year,
            graduationYear: user.graduationYear,
            pronouns: user.pronouns,
            universityEmail: user.universityEmail,
            profilePicture: profilePictureUrl,
            socialLinks: {
              instagram: user.instagram,
              linkedin: user.linkedin,
              github: user.github,
            },
          };
          await AsyncStorage.setItem(
            "profile_data",
            JSON.stringify(parsedData),
          );
        }
      } catch (error) {
        console.error("Error updating local storage:", error);
      }
    },
    [user],
  );

  /**
   * Handle save button press - validate and save profile data
   */
const handleSave = useCallback(async () => {
  // Validation
  if (!user.username || !user.major || !user.year) {
    Alert.alert("Required Fields", "Username, major, and year are required");
    return;
  }

  if (user.universityEmail && !user.universityEmail.includes("@")) {
    Alert.alert("Invalid Email", "Please enter a valid email address");
    return;
  }

  setSaving(true);

  try {
    let profilePictureUrl =
      originalUser?.profilePicture || user.profilePicture;

    // Handle profile picture upload
    if (selectedImageUri) {
      try {
        profilePictureUrl =
          await handleProfilePictureUpload(selectedImageUri);
      } catch (uploadError: any) {
        Alert.alert("Image Upload Error", uploadError.message);
        setSaving(false);
        return;
      }
    }
    // Handle profile picture deletion
    else if (pendingChanges.profilePicture === "") {
      await handleProfilePictureDeletion();
      profilePictureUrl = "";
    }

    // Build and send update payload
    const updatePayload = buildUpdatePayload();

    // Add profile picture URL if uploaded
    if (selectedImageUri) {
      updatePayload.profilePicture = profilePictureUrl;
    } else if (pendingChanges.profilePicture === "") {
      updatePayload.profilePicture = "";
    }

    console.log("Sending update payload:", updatePayload);

    const response = await profileService.updateProfile(updatePayload);

    // ✅ Check for null (auth error handled by service - Alert already shown)
    if (response === null || !response) {
      setSaving(false);
      return;
    }

    if (response.success) {
      await updateLocalStorage(profilePictureUrl);
      await refreshGlobalProfile();

      Alert.alert("Success", "Profile updated successfully!", [
        {
          text: "OK",
          onPress: () => {
            navigateToProfile();
          },
        },
      ]);

      setPendingChanges({});
      setSelectedImageUri(null);
    } else {
      Alert.alert("Update Failed", response.message || "Unknown error");
    }
  } catch (error: any) {
    console.error("Update error:", error);
    Alert.alert("Error", error.message || "Failed to update profile");
  } finally {
    setSaving(false);
  }
}, [
  user,
  originalUser,
  pendingChanges,
  selectedImageUri,
  handleProfilePictureUpload,
  handleProfilePictureDeletion,
  buildUpdatePayload,
  updateLocalStorage,
  refreshGlobalProfile,
  navigateToProfile,
]);

  // Image Upload Functions
  const openUploadModal = useCallback(() => setUploadModal(true), []);
  const closeUploadModal = useCallback(() => setUploadModal(false), []);
  const openImageViewer = useCallback(() => setViewPhotoModal(true), []);
  const closeImageViewer = useCallback(() => setViewPhotoModal(false), []);

  const handleImagePress = useCallback(() => {
    openUploadModal();
  }, [openUploadModal]);

  const handleGalleryPick = useCallback(async () => {
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
        const imageUri = result.assets[0].uri;
        setSelectedImageUri(imageUri);
        setAvatarError(false);
      }
    } catch (error) {
      console.error("Gallery picker error:", error);
      Alert.alert("Error", "Failed to select image from gallery");
      closeUploadModal();
    } finally {
      pickerActiveRef.current = false;
    }
  }, [closeUploadModal]);

  const handleCameraPick = useCallback(async () => {
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
        const imageUri = result.assets[0].uri;
        setSelectedImageUri(imageUri);
        setAvatarError(false);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo");
      closeUploadModal();
    } finally {
      pickerActiveRef.current = false;
    }
  }, [closeUploadModal]);

  const deleteProfileImage = useCallback(() => {
    setSelectedImageUri(null);
    setUser((prev) => ({ ...prev, profilePicture: "" }));
    setPendingChanges((prev) => ({
      ...prev,
      profilePicture: "",
    }));
    setAvatarError(false);
    closeUploadModal();
  }, [closeUploadModal]);

  // Get the current profile picture source
  const getDisplayProfilePicture = useCallback((): ImageSourcePropType => {
    return getProfileImageSource(user.profilePicture);
  }, [getProfileImageSource, user.profilePicture]);

  // Render profile picture with default avatar when no picture
  const renderProfilePicture = useCallback(() => {
    if (selectedImageUri) {
      return (
        <Image source={{ uri: selectedImageUri }} style={styles.profileImage} />
      );
    }

    const hasNoProfilePicture =
      !user.profilePicture || user.profilePicture === "";

    if (avatarError) {
      return <Image source={DEFAULT_AVATAR} style={styles.profileImage} />;
    }

    if (hasNoProfilePicture) {
      return <Image source={DEFAULT_AVATAR} style={styles.profileImage} />;
    }

    const imageSource = getDisplayProfilePicture();
    return (
      <Image
        source={imageSource}
        style={styles.profileImage}
        onError={() => setAvatarError(true)}
      />
    );
  }, [
    getDisplayProfilePicture,
    avatarError,
    user.profilePicture,
    selectedImageUri,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !hasUnsavedChanges()}
              style={[
                styles.saveButton,
                (!hasUnsavedChanges() || saving) && styles.saveButtonDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#8b5cf6" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.profilePictureSection}>
            <View style={styles.imageContainer}>
              {renderProfilePicture()}
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={handleImagePress}
              >
                <Ionicons name="camera" size={20} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={styles.imageHint}>Tap to change photo</Text>
            {hasUnsavedChanges() && (
              <View style={styles.unsavedIndicator}>
                <Ionicons name="information-circle" size={16} color="#f59e0b" />
                <Text style={styles.unsavedText}>You have unsaved changes</Text>
              </View>
            )}
          </View>

          <View style={styles.form}>
            {/* Basic Information Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Basic Information</Text>

              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name="person-outline" size={20} color="#4f46e5" />
                  <Text style={styles.label}>Full Name</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={user.fullName}
                  onChangeText={(text) => handleFieldChange("fullName", text)}
                  placeholder="Enter your full name"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name="at-outline" size={20} color="#4f46e5" />
                  <Text style={styles.label}>
                    Username <Text style={styles.requiredStar}>*</Text>
                  </Text>
                </View>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={user.username}
                  editable={false}
                  placeholder="Username (cannot be changed)"
                />
                <Text style={styles.inputHint}>
                  Username cannot be changed after setup
                </Text>
              </View>

              <PronounsSelector
                value={user.pronouns}
                onSelect={handlePronounsSelect}
              />

              <BioInput
                value={user.bio}
                onChange={(text) => handleFieldChange("bio", text)}
                maxLength={200}
              />
            </View>

            {/* Academic Information Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Academic Information</Text>

              <ScrollableDropdown
                label="Major / Department"
                value={user.major}
                options={MAJORS}
                onSelect={handleMajorSelect}
                placeholder="Select your major"
                required={true}
                icon={
                  <Ionicons name="school-outline" size={20} color="#4f46e5" />
                }
              />

              <YearSelector
                value={user.year}
                onSelect={handleYearSelect}
                required={true}
              />

              <ScrollableDropdown
                label="Expected Graduation Year"
                value={user.graduationYear}
                options={GRADUATION_YEARS}
                onSelect={handleGraduationYearSelect}
                placeholder="Select graduation year"
                icon={
                  <Ionicons name="today-outline" size={20} color="#4f46e5" />
                }
              />
            </View>

            {/* Social Links Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Social Links</Text>
              <SocialLinksInput
                instagram={user.instagram}
                linkedin={user.linkedin}
                github={user.github}
                onInstagramChange={(text) =>
                  handleFieldChange("instagram", text)
                }
                onLinkedinChange={(text) => handleFieldChange("linkedin", text)}
                onGithubChange={(text) => handleFieldChange("github", text)}
              />
            </View>

            <View style={styles.smallSpacer} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Discard Changes Modal - Using Reusable Component */}
      <DiscardChangesModal
        visible={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onDiscard={handleDiscardChanges}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to leave?"
        keepEditingText="Keep Editing"
        discardText="Discard"
      />

      <UploadModal
        visible={uploadModal}
        onClose={closeUploadModal}
        onViewImage={openImageViewer}
        onPickImage={handleGalleryPick}
        onTakePhoto={handleCameraPick}
        onDeletePhoto={deleteProfileImage}
        hasExistingImage={
          !!user.profilePicture && user.profilePicture.trim() !== ""
        }
      />

      <ImageViewModal
        visible={viewPhotoModal}
        imageUri={
          selectedImageUri ||
          (user.profilePicture
            ? user.profilePicture.startsWith("/")
              ? `${API_BASE_URL}${user.profilePicture}`
              : user.profilePicture
            : "")
        }
        onClose={closeImageViewer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "white",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    color: "#111827",
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#8b5cf6",
    fontSize: 16,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "600",
  },
  profilePictureSection: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "white",
    marginBottom: 8,
  },
  imageContainer: {
    position: "relative",
    marginBottom: 8,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#8b5cf6",
    backgroundColor: "#f3f4f6",
  },
  fallbackAvatar: {
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackAvatarText: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "bold",
  },
  changeImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#8b5cf6",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
  },
  imageHint: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
  },
  unsavedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  unsavedText: {
    fontSize: 12,
    color: "#92400e",
    fontFamily: "SofiaSans-Regular",
    marginLeft: 4,
    fontWeight: "500",
  },
  form: {
    padding: 20,
    paddingBottom: 20,
  },
  formSection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    color: "#374151",
  },
  requiredStar: {
    color: "#ef4444",
    fontSize: 15,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    color: "#111827",
  },
  disabledInput: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },
  inputHint: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    marginTop: 4,
  },
  smallSpacer: {
    height: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 16,
  },
});
