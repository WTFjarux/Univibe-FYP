// app/(tabs)/profile/edit.tsx
import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { profileService } from "../../../lib/profileService";
import UploadModal from "../../components/Profile/UploadModal";
import ImageViewModal from "../../components/Profile/ImageViewModal";

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

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const pickerActiveRef = useRef(false);

  // State management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [viewPhotoModal, setViewPhotoModal] = useState(false);
  const [originalUser, setOriginalUser] = useState<UserProfile | null>(null);

  // Track pending changes separately
  const [pendingChanges, setPendingChanges] = useState<Partial<UserProfile>>(
    {}
  );
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

  // Year options for selection
  const yearOptions = ["UPC", "First", "Second", "Third"];

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

        const userProfile = {
          username: userData.username || "",
          fullName: profile.fullName || "",
          bio: profile.bio || "",
          major: profile.major || "",
          year: profile.year || "",
          graduationYear: profile.graduationYear || "",
          pronouns: profile.pronouns || "",
          universityEmail: profile.universityEmail || userData.email || "",
          profilePicture:
            profile.profilePicture ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.username}`,
          instagram: profile.socialLinks?.instagram || "",
          linkedin: profile.socialLinks?.linkedin || "",
          github: profile.socialLinks?.github || "",
        };

        setUser(userProfile);
        setOriginalUser(userProfile);
        setPendingChanges({});
        setSelectedImageUri(null);
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
  const handleFieldChange = (field: keyof UserProfile, value: string) => {
    setUser((prev) => ({ ...prev, [field]: value }));

    // Track the change in pendingChanges
    setPendingChanges((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Handle year selection
   */
  const handleYearSelect = (year: string) => {
    setUser((prev) => ({ ...prev, year }));
    setPendingChanges((prev) => ({ ...prev, year }));
  };

  /**
   * Check if there are unsaved changes
   */
  const hasUnsavedChanges = () => {
    return Object.keys(pendingChanges).length > 0 || selectedImageUri !== null;
  };

  /**
   * Handle discard/back button press
   */
  const handleDiscard = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          {
            text: "Keep Editing",
            style: "cancel",
          },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              const parent = navigation.getParent();
              if (parent) {
                parent.setOptions({
                  tabBarStyle: { display: "flex" },
                });
              }
              router.back();
            },
          },
        ]
      );
    } else {
      const parent = navigation.getParent();
      if (parent) {
        parent.setOptions({
          tabBarStyle: { display: "flex" },
        });
      }
      router.back();
    }
  };

  /**
   * Handle save button press - validate and save profile data
   */
  const handleSave = async () => {
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
      // FIRST: Upload the profile picture if a new one was selected
      let profilePictureUrl =
        originalUser?.profilePicture || user.profilePicture;

      if (selectedImageUri) {
        try {
          setUploadingImage(true);
          const uploadResponse = await profileService.uploadProfilePicture(
            selectedImageUri
          );

          if (uploadResponse.success) {
            profilePictureUrl = uploadResponse.data.profilePicture;
            console.log(
              "Profile picture uploaded successfully:",
              profilePictureUrl
            );
          } else {
            Alert.alert(
              "Image Upload Failed",
              uploadResponse.message || "Failed to upload profile picture"
            );
            setSaving(false);
            setUploadingImage(false);
            return;
          }
        } catch (uploadError: any) {
          Alert.alert(
            "Image Upload Error",
            uploadError.message || "Failed to upload profile picture"
          );
          setSaving(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      // Prepare the update payload with the pending changes
      const updatePayload: any = {
        username: user.username,
        ...pendingChanges,
      };

      // Remove profilePicture from payload if it's not in pending changes
      if (!pendingChanges.profilePicture) {
        delete updatePayload.profilePicture;
      }

      // Add social links if they've been modified
      if (
        pendingChanges.instagram !== undefined ||
        pendingChanges.linkedin !== undefined ||
        pendingChanges.github !== undefined
      ) {
        updatePayload.socialLinks = {
          instagram: pendingChanges.instagram || originalUser?.instagram || "",
          linkedin: pendingChanges.linkedin || originalUser?.linkedin || "",
          github: pendingChanges.github || originalUser?.github || "",
        };
      }

      console.log("Sending update payload:", updatePayload);

      // Update the profile data
      const response = await profileService.updateProfile(updatePayload);

      if (response.success) {
        // Update AsyncStorage with the new data
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
            JSON.stringify(parsedData)
          );
        }

        Alert.alert("Success", "Profile updated successfully!", [
          {
            text: "OK",
            onPress: () => {
              const parent = navigation.getParent();
              if (parent) {
                parent.setOptions({
                  tabBarStyle: { display: "flex" },
                });
              }

              router.replace({
                pathname: "/(tabs)/profile",
                params: { refresh: Date.now() },
              });
            },
          },
        ]);

        // Clear pending changes after successful save
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
  };

  /**
   * Handle university email verification
   */
  const handleVerification = () => {
    if (!user.universityEmail) {
      Alert.alert("Email Required", "Please enter your university email first");
      return;
    }
    Alert.alert(
      "Verification",
      `Verification email sent to ${user.universityEmail}`
    );
  };

  // Image Upload Functions
  const openUploadModal = () => setUploadModal(true);
  const closeUploadModal = () => setUploadModal(false);
  const openImageViewer = () => setViewPhotoModal(true);
  const closeImageViewer = () => setViewPhotoModal(false);

  const handleImagePress = () => {
    openUploadModal();
  };

  /**
   * Handle gallery image selection
   */
  const handleGalleryPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      console.log("Opening gallery...");

      // Check permissions
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo access to upload profile pictures."
          );
          pickerActiveRef.current = false;
          return;
        }
      }

      // Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      closeUploadModal();

      if (!result.canceled && result.assets?.[0]?.uri) {
        console.log("Image selected, storing for later...");
        const imageUri = result.assets[0].uri;

        // Store the selected image URI (but don't upload yet)
        setSelectedImageUri(imageUri);

        // Update the UI preview immediately
        setUser((prev) => ({ ...prev, profilePicture: imageUri }));

        console.log("Image stored for later upload");
      }
    } catch (error) {
      console.error("Gallery picker error:", error);
      Alert.alert("Error", "Failed to select image from gallery");
      closeUploadModal();
    } finally {
      pickerActiveRef.current = false;
    }
  };

  /**
   * Handle camera photo capture
   */
  const handleCameraPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      console.log("Opening camera...");

      // Check camera permissions
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take photos."
          );
          pickerActiveRef.current = false;
          return;
        }
      }

      // Open camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      closeUploadModal();

      if (!result.canceled && result.assets?.[0]?.uri) {
        console.log("Photo taken, storing for later...");
        const imageUri = result.assets[0].uri;

        // Store the selected image URI (but don't upload yet)
        setSelectedImageUri(imageUri);

        // Update the UI preview immediately
        setUser((prev) => ({ ...prev, profilePicture: imageUri }));

        console.log("Photo stored for later upload");
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo");
      closeUploadModal();
    } finally {
      pickerActiveRef.current = false;
    }
  };

  /**
   * Handle profile picture deletion
   */
  const deleteProfileImage = async () => {
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture? This will only take effect when you save changes.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            try {
              // Set to default avatar for preview
              const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;

              // Clear the selected image URI
              setSelectedImageUri(null);

              // Update UI preview
              setUser((prev) => ({ ...prev, profilePicture: defaultAvatar }));

              // Mark that we want to delete the profile picture on save
              setPendingChanges((prev) => ({
                ...prev,
                profilePicture: defaultAvatar,
              }));

              closeUploadModal();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to remove profile picture"
              );
            }
          },
        },
      ]
    );
  };

  // Get the current profile picture URL for display
  const getDisplayProfilePicture = () => {
    if (selectedImageUri) {
      return selectedImageUri; // Show the selected image
    }
    return user.profilePicture; // Show the current profile picture
  };

  // Show loading spinner while fetching initial data
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
          {/* Header with close button and save action */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleDiscard} style={styles.backButton}>
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

          {/* Profile Picture Section */}
          <View style={styles.profilePictureSection}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: getDisplayProfilePicture() }}
                style={styles.profileImage}
              />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={handleImagePress}
              >
                <Ionicons name="camera" size={20} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={styles.imageHint}>
              {selectedImageUri
                ? "New image selected - will save on Save"
                : "Tap to change photo"}
            </Text>
            {hasUnsavedChanges() && (
              <View style={styles.unsavedIndicator}>
                <Ionicons name="information-circle" size={16} color="#f59e0b" />
                <Text style={styles.unsavedText}>You have unsaved changes</Text>
              </View>
            )}
          </View>

          {/* Form Sections */}
          <View style={styles.form}>
            {/* Basic Information Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Basic Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={user.fullName}
                  onChangeText={(text) => handleFieldChange("fullName", text)}
                  placeholder="Enter your full name"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username *</Text>
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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Major/Department *</Text>
                <TextInput
                  style={styles.input}
                  value={user.major}
                  onChangeText={(text) => handleFieldChange("major", text)}
                  placeholder="e.g., Computer Science"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Year *</Text>
                <View style={styles.yearContainer}>
                  {yearOptions.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.yearButton,
                        user.year === year && styles.yearButtonActive,
                      ]}
                      onPress={() => handleYearSelect(year)}
                    >
                      <Text
                        style={[
                          styles.yearButtonText,
                          user.year === year && styles.yearButtonTextActive,
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pronouns</Text>
                <TextInput
                  style={styles.input}
                  value={user.pronouns}
                  onChangeText={(text) => handleFieldChange("pronouns", text)}
                  placeholder="e.g., he/him, she/her, they/them"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Graduation Year</Text>
                <TextInput
                  style={styles.input}
                  value={user.graduationYear}
                  onChangeText={(text) =>
                    handleFieldChange("graduationYear", text)
                  }
                  placeholder="e.g., 2025"
                  keyboardType="number-pad"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Bio Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Bio</Text>
              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={user.bio}
                  onChangeText={(text) => handleFieldChange("bio", text)}
                  placeholder="Tell us about yourself..."
                  multiline
                  numberOfLines={4}
                  maxLength={200}
                  textAlignVertical="top"
                  returnKeyType="next"
                />
                <Text style={styles.charCount}>
                  {200 - user.bio.length} characters remaining
                </Text>
              </View>
            </View>

            {/* University Verification Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>University Verification</Text>
              <View style={styles.verificationCard}>
                <Ionicons name="school" size={24} color="#8b5cf6" />
                <View style={styles.verificationContent}>
                  <Text style={styles.verificationTitle}>
                    Verify Your Student Status
                  </Text>
                  <Text style={styles.verificationText}>
                    Use your university email to verify your student status
                  </Text>
                  <View style={styles.emailContainer}>
                    <TextInput
                      style={styles.emailInput}
                      value={user.universityEmail}
                      onChangeText={(text) =>
                        handleFieldChange("universityEmail", text)
                      }
                      placeholder="name@university.edu"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      returnKeyType="next"
                    />
                    <TouchableOpacity
                      style={styles.verifyButton}
                      onPress={handleVerification}
                    >
                      <Text style={styles.verifyButtonText}>Verify</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Social Links Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Social Links</Text>

              <View style={styles.inputGroup}>
                <View style={styles.socialInputContainer}>
                  <Ionicons name="logo-instagram" size={20} color="#8b5cf6" />
                  <TextInput
                    style={styles.socialInput}
                    value={user.instagram}
                    onChangeText={(text) =>
                      handleFieldChange("instagram", text)
                    }
                    placeholder="Instagram username"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.socialInputContainer}>
                  <Ionicons name="logo-linkedin" size={20} color="#3b82f6" />
                  <TextInput
                    style={styles.socialInput}
                    value={user.linkedin}
                    onChangeText={(text) => handleFieldChange("linkedin", text)}
                    placeholder="LinkedIn username"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.socialInputContainer}>
                  <Ionicons name="logo-github" size={20} color="#000000ff" />
                  <TextInput
                    style={styles.socialInput}
                    value={user.github}
                    onChangeText={(text) => handleFieldChange("github", text)}
                    placeholder="Github username"
                    autoCapitalize="none"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>


            {/* Small spacer */}
            <View style={styles.smallSpacer} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Upload Options Modal */}
      <UploadModal
        visible={uploadModal}
        onClose={closeUploadModal}
        onViewImage={openImageViewer}
        onPickImage={handleGalleryPick}
        onTakePhoto={handleCameraPick}
        onDeletePhoto={deleteProfileImage}
        hasExistingImage={
          !!user.profilePicture && !user.profilePicture.includes("dicebear")
        }
      />

      {/* Image Viewer Modal */}
      <ImageViewModal
        visible={viewPhotoModal}
        imageUri={getDisplayProfilePicture()}
        onClose={closeImageViewer}
      />
    </SafeAreaView>
  );
}

// Styles for the component
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
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },
  disabledInput: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },
  inputHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 4,
  },
  yearContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  yearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
  },
  yearButtonActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  yearButtonText: {
    fontSize: 14,
    color: "#374151",
  },
  yearButtonTextActive: {
    color: "white",
    fontWeight: "600",
  },
  verificationCard: {
    flexDirection: "row",
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  verificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  verificationText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  emailContainer: {
    flexDirection: "row",
    gap: 8,
  },
  emailInput: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  verifyButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
  },
  verifyButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  socialInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  socialInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    marginLeft: 8,
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
