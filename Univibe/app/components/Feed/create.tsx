import React, { useState, useEffect } from "react"; // Added useEffect import
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { createPost } from "../../../lib/postService";
import { useAuth } from "../../../lib/AuthContext";
import { API_BASE_URL } from "../../../constants/stringConstants";

const { width } = Dimensions.get("window");

// Visibility options
type Visibility = "campus" | "connections" | "following" | "private";

export default function CreatePostScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("campus");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // When anonymous is toggled, set visibility to "campus" automatically
  useEffect(() => {
    if (isAnonymous) {
      setVisibility("campus");
    }
  }, [isAnonymous]);

  // Check if there's anything to post
  const hasContentToPost = () => {
    return content.trim().length > 0 || images.length > 0;
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("/")) {
      return `${API_BASE_URL}${url}`;
    }
    return `${API_BASE_URL}/${url}`;
  };

  const userAvatar = profile?.profilePicture
    ? getFullImageUrl(profile.profilePicture)
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || user?.email || "User"}`;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant photo library permissions to add images",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.8,
      selectionLimit: 4 - images.length,
    });

    if (!result.canceled && result.assets) {
      const newImages = [
        ...images,
        ...result.assets.map((asset) => asset.uri).slice(0, 4 - images.length),
      ];
      setImages(newImages);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const getVisibilityIcon = (option: Visibility) => {
    switch (option) {
      case "campus":
        return "school-outline";
      case "connections":
        return "people-outline";
      case "following":
        return "eye-outline";
      case "private":
        return "lock-closed-outline";
      default:
        return "globe-outline";
    }
  };

  const getVisibilityLabel = (option: Visibility) => {
    switch (option) {
      case "campus":
        return "Campus";
      case "connections":
        return "Connections";
      case "following":
        return "Following";
      case "private":
        return "Only Me";
      default:
        return "Public";
    }
  };

  const handleSubmit = async () => {
    if (!hasContentToPost()) {
      Alert.alert("Add content", "Please add some text or photos to post");
      return;
    }

    try {
      setLoading(true);

      // Prepare image objects if any
      const imageObjects =
        images.length > 0
          ? await Promise.all(
              images.map(async (uri) => {
                const filename = uri.split("/").pop() || "";
                const ext = filename.split(".").pop()?.toLowerCase() || "jpg";

                let mimeType = "image/jpeg";
                if (ext === "png") mimeType = "image/png";
                else if (ext === "gif") mimeType = "image/gif";
                else if (ext === "webp") mimeType = "image/webp";

                return {
                  uri,
                  type: mimeType,
                  name: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`,
                };
              }),
            )
          : [];

      console.log("Creating post with:", {
        content: content.substring(0, 50) + "...",
        imageCount: images.length,
        visibility: isAnonymous ? "campus" : visibility,
        isAnonymous,
      });

      // ✅ FIXED: For anonymous posts, always use "campus" visibility
      const finalVisibility = isAnonymous ? "campus" : visibility;

      await createPost(content, imageObjects, finalVisibility, isAnonymous);

      Alert.alert(
        "Posted!",
        `Your post has been shared ${isAnonymous ? "anonymously " : ""}with ${getVisibilityLabel(finalVisibility)} visibility.`,
        [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)/feed"),
          },
        ],
      );
    } catch (error: any) {
      console.error("Error creating post:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to create post. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Get user's full name with proper fallbacks
  const getUserName = () => {
    if (isAnonymous) return "Anonymous";

    // First try profile fullName (most accurate)
    if (profile?.fullName) return profile.fullName;

    // Then try other name fields as fallbacks
    if (profile?.name) return profile.name;
    if (user?.name) return user.name;
    if (profile?.username) {
      const cleanUsername = profile.username.replace("@", "");
      return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
    }

    return "You";
  };

  // Get user's handle/username
  const getUserHandle = () => {
    if (isAnonymous) return "Hidden identity";

    // Try profile username first
    if (profile?.username) return `@${profile.username}`;

    // Try email username
    if (user?.email) {
      const emailUsername = user.email.split("@")[0];
      return `@${emailUsername}`;
    }

    return "@user";
  };

  // Visibility options - hide some options when anonymous
  const getVisibilityOptions = (): Visibility[] => {
    if (isAnonymous) {
      // For anonymous posts, only show campus option (and it's disabled/selected)
      return ["campus"];
    }
    return ["campus", "connections", "following"]; // Remove "private" if you don't want it
  };

  const visibilityOptions = getVisibilityOptions();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} disabled={loading}>
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !hasContentToPost()}
            style={[
              styles.postButton,
              (!hasContentToPost() || loading) && styles.postButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        <ScrollView style={styles.content}>
          {/* User Info - Show user's full name */}
          <View style={styles.userInfo}>
            {isAnonymous ? (
              <View style={[styles.avatar, styles.anonymousAvatar]}>
                <Ionicons name="eye-off" size={20} color="#666" />
              </View>
            ) : (
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
            )}
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>{getUserName()}</Text>
              <Text style={styles.userHandle}>{getUserHandle()}</Text>
            </View>

            {/* Anonymous toggle on the right */}
            <TouchableOpacity
              style={styles.anonymousToggleRight}
              onPress={() => setIsAnonymous(!isAnonymous)}
              disabled={loading}
            >
              <View style={styles.toggleContainerRight}>
                <View
                  style={[
                    styles.toggleCircleRight,
                    isAnonymous && styles.toggleCircleRightActive,
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.toggleTextRight,
                  isAnonymous && styles.toggleTextRightActive,
                ]}
              >
                {isAnonymous ? "Anonymous ON" : "Post anonymously"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Anonymous warning message */}
          {isAnonymous && (
            <View style={styles.anonymousWarning}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#f59e0b"
              />
              <Text style={styles.anonymousWarningText}>
                Your identity will be hidden from other users.
              </Text>
            </View>
          )}

          {/* Text Input */}
          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            editable={!loading}
            placeholderTextColor="#999"
          />

          {/* Character Count */}
          <Text style={styles.charCount}>{content.length}/500</Text>

          {/* Image Preview */}
          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              <Text style={styles.imagesTitle}>Photos ({images.length}/4)</Text>
              <View style={styles.imagesGrid}>
                {images.map((image, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image
                      source={{ uri: image }}
                      style={styles.previewImage}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                    {images.length > 1 && (
                      <View style={styles.imageNumber}>
                        <Text style={styles.imageNumberText}>{index + 1}</Text>
                      </View>
                    )}
                  </View>
                ))}
                {images.length < 4 && (
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={pickImage}
                    disabled={loading}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={32}
                      color="#8b5cf6"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Visibility Options - Show disabled when anonymous */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Who can see this?
              {isAnonymous && (
                <Text style={styles.anonymousNote}>
                  {" "}
                  (Campus only for anonymous posts)
                </Text>
              )}
            </Text>
            <View style={styles.visibilityOptions}>
              {visibilityOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.visibilityOption,
                    visibility === option && styles.visibilityOptionActive,
                    isAnonymous && styles.visibilityOptionDisabled,
                  ]}
                  onPress={() => !isAnonymous && setVisibility(option)}
                  disabled={loading || isAnonymous}
                >
                  <Ionicons
                    name={getVisibilityIcon(option)}
                    size={18}
                    color={visibility === option ? "#fff" : "#666"}
                  />
                  <Text
                    style={[
                      styles.visibilityText,
                      visibility === option && styles.visibilityTextActive,
                      isAnonymous && styles.visibilityTextDisabled,
                    ]}
                  >
                    {getVisibilityLabel(option)}
                    {isAnonymous && option === "campus"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.visibilityDescription}>
              {isAnonymous
                ? "Anonymous posts are always visible to everyone in your campus for maximum reach while protecting your identity."
                : visibility === "campus" &&
                  "Visible to all users in your campus"}
              {visibility === "connections" &&
                "Visible to your connections only"}
              {visibility === "following" && "Visible to people you follow"}
              {visibility === "private" && "Only visible to you"}
            </Text>
          </View>

          {/* Add Image Button */}
          {images.length < 4 && (
            <TouchableOpacity
              style={styles.addImageButtonSimple}
              onPress={pickImage}
              disabled={loading}
            >
              <Ionicons name="image-outline" size={24} color="#8b5cf6" />
              <Text style={styles.addImageTextSimple}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  postButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  postButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  postButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  anonymousAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  userTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userHandle: {
    fontSize: 14,
    color: "#666",
  },
  anonymousToggleRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleContainerRight: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ddd",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleCircleRight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  toggleCircleRightActive: {
    backgroundColor: "#000000",
    transform: [{ translateX: 16 }],
  },
  toggleTextRight: {
    fontSize: 12,
    color: "#666",
    marginLeft: 8,
  },
  toggleTextRightActive: {
    color: "#000000",
    fontWeight: "600",
  },
  anonymousWarning: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  anonymousWarningText: {
    fontSize: 14,
    color: "#92400e",
    flex: 1,
    fontStyle: "italic",
  },
  input: {
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    color: "#999",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  imagesContainer: {
    marginBottom: 20,
  },
  imagesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageWrapper: {
    width: (width - 64) / 2,
    height: (width - 64) / 2,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  imageNumber: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  imageNumberText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  addMoreButton: {
    width: (width - 64) / 2,
    height: (width - 64) / 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  anonymousNote: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  visibilityOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  visibilityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#eee",
  },
  visibilityOptionActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  visibilityOptionDisabled: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
  },
  visibilityTextActive: {
    color: "#fff",
  },
  visibilityTextDisabled: {
    color: "#ffffff",
  },
  visibilityDescription: {
    fontSize: 12,
    color: "#8b5cf6",
    marginTop: 10,
    fontStyle: "italic",
  },
  addImageButtonSimple: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  addImageTextSimple: {
    marginLeft: 8,
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
  },
});
