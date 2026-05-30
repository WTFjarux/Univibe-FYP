// app/screens/CreateCommunityScreen.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTheme } from "../../lib/contexts/ThemeContext";
import { useAuth } from "../../lib/contexts/AuthContext";
import { communityService } from "../../lib/services/communityService";
import { profileService } from "../../lib/services/profileService";
import {
  CommunityType,
  PrivacyType,
  CommunityResponse,
  CommunityRule,
} from "../../lib/types/community";

const { width: screenWidth } = Dimensions.get("window");

export default function CreateCommunityScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const descriptionInputRef = useRef<TextInput>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CommunityType>("community");
  const [privacy, setPrivacy] = useState<PrivacyType>("public");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [university, setUniversity] = useState<string>("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [processingImage, setProcessingImage] = useState(false);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Rules
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const [showAddRule, setShowAddRule] = useState(false);

  // Validation
  const [errors, setErrors] = useState<{ name?: string; description?: string }>(
    {},
  );

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const result = await profileService.getMyProfile(true);
        if (result.success && result.data) {
          const campus = result.data.profile?.campus || "";
          setUniversity(campus);
          if (!campus) {
            Alert.alert(
              "Profile Incomplete",
              "Please set your campus in your profile before creating a community.",
              [{ text: "OK", onPress: () => router.back() }],
            );
          }
        } else {
          Alert.alert(
            "Error",
            "Unable to load your profile. Please try again.",
          );
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  // ============================================
  // VALIDATION
  // ============================================

  const validate = (): boolean => {
    const newErrors: { name?: string; description?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Community name is required";
    } else if (name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (name.trim().length > 100) {
      newErrors.name = "Name must be less than 100 characters";
    }

    if (!description.trim()) {
      newErrors.description = "Description is required";
    } else if (description.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // KEYBOARD HANDLING
  // ============================================

  const handleNameFocus = () => {
    setTimeout(
      () => scrollViewRef.current?.scrollTo({ y: 320, animated: true }),
      300,
    );
  };

  const handleDescriptionFocus = () => {
    setTimeout(
      () => scrollViewRef.current?.scrollTo({ y: 500, animated: true }),
      300,
    );
  };

  // ============================================
  // IMAGE PROCESSING
  // ============================================

  const forceCropTo16x9 = async (uri: string): Promise<string | null> => {
    try {
      setProcessingImage(true);

      const imageInfo = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            (error) => reject(error),
          );
        },
      );

      const targetAspectRatio = 16 / 9;
      const currentAspectRatio = imageInfo.width / imageInfo.height;

      let cropRect: {
        originX: number;
        originY: number;
        width: number;
        height: number;
      };

      if (currentAspectRatio > targetAspectRatio) {
        const targetWidth = Math.round(imageInfo.height * targetAspectRatio);
        const offsetX = Math.round((imageInfo.width - targetWidth) / 2);
        cropRect = {
          originX: offsetX,
          originY: 0,
          width: targetWidth,
          height: imageInfo.height,
        };
      } else if (currentAspectRatio < targetAspectRatio) {
        const targetHeight = Math.round(imageInfo.width / targetAspectRatio);
        const offsetY = Math.round((imageInfo.height - targetHeight) / 2);
        cropRect = {
          originX: 0,
          originY: offsetY,
          width: imageInfo.width,
          height: targetHeight,
        };
      } else {
        cropRect = {
          originX: 0,
          originY: 0,
          width: imageInfo.width,
          height: imageInfo.height,
        };
      }

      const croppedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: cropRect }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );

      const finalImage = await ImageManipulator.manipulateAsync(
        croppedImage.uri,
        [{ resize: { width: 1280, height: 720 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      return finalImage.uri;
    } catch (error) {
      console.error("Error processing cover image:", error);
      Alert.alert("Error", "Failed to process the image. Please try again.");
      return null;
    } finally {
      setProcessingImage(false);
    }
  };

  const updateCoverImage = async (originalUri: string) => {
    const processedUri = await forceCropTo16x9(originalUri);
    if (processedUri) {
      setCoverImage(processedUri);
      setCoverFile({
        uri: processedUri,
        name: `cover_${Date.now()}.jpg`,
        type: "image/jpeg",
      });
    }
  };

  // ============================================
  // COVER IMAGE HANDLERS
  // ============================================

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      await updateCoverImage(result.assets[0].uri);
    }
  };

  const handleTakeCover = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your camera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      await updateCoverImage(result.assets[0].uri);
    }
  };

  const handleRemoveCover = () => {
    setCoverImage(null);
    setCoverFile(null);
  };

  // ============================================
  // TAGS HANDLERS
  // ============================================

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      Alert.alert("Duplicate", "This tag already exists");
      return;
    }
    if (tags.length >= 10) {
      Alert.alert("Limit Reached", "Maximum 10 tags allowed");
      return;
    }
    if (trimmed.length > 30) {
      Alert.alert("Too Long", "Tags must be under 30 characters");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput("");
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  // ============================================
  // RULES HANDLERS
  // ============================================

  const handleAddRule = () => {
    if (!newRuleTitle.trim()) {
      Alert.alert("Required", "Rule title is required");
      return;
    }
    if (rules.length >= 20) {
      Alert.alert("Limit Reached", "Maximum 20 rules allowed");
      return;
    }
    setRules([
      ...rules,
      { title: newRuleTitle.trim(), description: newRuleDescription.trim() },
    ]);
    setNewRuleTitle("");
    setNewRuleDescription("");
    setShowAddRule(false);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  // ============================================
  // SUBMIT
  // ============================================

  const handleCreate = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!university) {
      Alert.alert(
        "Error",
        "Unable to determine your university. Please complete your profile first.",
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        university,
        type,
        privacy: type === "department" ? "private" : privacy,
        coverImage: coverFile,
        tags: tags,
        rules: rules,
      };

      const result: CommunityResponse =
        await communityService.createCommunity(payload);

      if (result.success) {
        Alert.alert(
          "Success!",
          type === "department"
            ? "Department created and submitted for approval."
            : "Community created and submitted for approval.",
          [{ text: "OK", onPress: () => router.back() }],
        );
      } else {
        Alert.alert("Error", "Failed to create community. Please try again.");
      }
    } catch (error: any) {
      console.error("Create community error:", error);
      Alert.alert(
        "Error",
        error?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loadingProfile) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER
  // ============================================

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
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Create {type === "department" ? "Department" : "Community"}
        </Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={loading || !name.trim() || processingImage}
          style={[
            styles.createBtn,
            {
              backgroundColor:
                name.trim() && !processingImage
                  ? colors.primary
                  : colors.primary + "40",
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Cover Image */}
          <View style={styles.coverContainer}>
            {processingImage ? (
              <View
                style={[
                  styles.coverPlaceholder,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    styles.coverPlaceholderText,
                    { color: colors.primary },
                  ]}
                >
                  Processing Image...
                </Text>
              </View>
            ) : coverImage ? (
              <View style={styles.coverImageWrapper}>
                <Image
                  source={{ uri: coverImage }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.changeCoverBtn}
                  onPress={handlePickCover}
                >
                  <Ionicons name="camera" size={16} color="#ffffff" />
                  <Text style={styles.changeCoverText}>Change Cover</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeCoverBtn}
                  onPress={handleRemoveCover}
                >
                  <Ionicons name="trash" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.coverPlaceholder,
                  { backgroundColor: colors.primary + "15" },
                ]}
                onPress={handlePickCover}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="image-outline"
                  size={40}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.coverPlaceholderText,
                    { color: colors.primary },
                  ]}
                >
                  Add Cover Image
                </Text>
                <Text
                  style={[styles.coverHint, { color: colors.textSecondary }]}
                >
                  Recommended: 16:9 ratio
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {coverImage && !processingImage && (
            <View style={styles.coverOptions}>
              <TouchableOpacity
                style={[styles.coverOptionBtn, { borderColor: colors.border }]}
                onPress={handlePickCover}
              >
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[styles.coverOptionText, { color: colors.primary }]}
                >
                  Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.coverOptionBtn, { borderColor: colors.border }]}
                onPress={handleTakeCover}
              >
                <Ionicons
                  name="camera-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[styles.coverOptionText, { color: colors.primary }]}
                >
                  Camera
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Type Selector */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            TYPE
          </Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeOption,
                {
                  backgroundColor:
                    type === "community"
                      ? colors.primary + "20"
                      : isDark
                        ? "#1e293b"
                        : "#f1f5f9",
                  borderColor:
                    type === "community" ? colors.primary : "transparent",
                },
              ]}
              onPress={() => {
                setType("community");
                setPrivacy("public");
              }}
            >
              <Ionicons
                name="people-outline"
                size={24}
                color={
                  type === "community" ? colors.primary : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.typeTitle,
                  {
                    color: type === "community" ? colors.primary : colors.text,
                  },
                ]}
              >
                Community
              </Text>
              <Text
                style={[
                  styles.typeDesc,
                  {
                    color:
                      type === "community"
                        ? colors.primary
                        : colors.textSecondary,
                  },
                ]}
              >
                Student clubs, groups, and organizations
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeOption,
                {
                  backgroundColor:
                    type === "department"
                      ? colors.primary + "20"
                      : isDark
                        ? "#1e293b"
                        : "#f1f5f9",
                  borderColor:
                    type === "department" ? colors.primary : "transparent",
                },
              ]}
              onPress={() => {
                setType("department");
                setPrivacy("private");
              }}
            >
              <Ionicons
                name="school-outline"
                size={24}
                color={
                  type === "department" ? colors.primary : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.typeTitle,
                  {
                    color: type === "department" ? colors.primary : colors.text,
                  },
                ]}
              >
                Department
              </Text>
              <Text
                style={[
                  styles.typeDesc,
                  {
                    color:
                      type === "department"
                        ? colors.primary
                        : colors.textSecondary,
                  },
                ]}
              >
                Official academic departments
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Selector */}
          {type === "community" && (
            <>
              <Text
                style={[styles.sectionLabel, { color: colors.textSecondary }]}
              >
                PRIVACY
              </Text>
              <View style={styles.privacySelector}>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    {
                      backgroundColor:
                        privacy === "public"
                          ? colors.primary + "20"
                          : isDark
                            ? "#1e293b"
                            : "#f1f5f9",
                      borderColor:
                        privacy === "public" ? colors.primary : "transparent",
                    },
                  ]}
                  onPress={() => setPrivacy("public")}
                >
                  <Ionicons
                    name="globe-outline"
                    size={20}
                    color={
                      privacy === "public"
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <View style={styles.privacyInfo}>
                    <Text
                      style={[
                        styles.privacyTitle,
                        {
                          color:
                            privacy === "public" ? colors.primary : colors.text,
                        },
                      ]}
                    >
                      Public
                    </Text>
                    <Text
                      style={[
                        styles.privacyDesc,
                        {
                          color:
                            privacy === "public"
                              ? colors.primary
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      Anyone can join instantly
                    </Text>
                  </View>
                  {privacy === "public" && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    {
                      backgroundColor:
                        privacy === "private"
                          ? colors.primary + "20"
                          : isDark
                            ? "#1e293b"
                            : "#f1f5f9",
                      borderColor:
                        privacy === "private" ? colors.primary : "transparent",
                    },
                  ]}
                  onPress={() => setPrivacy("private")}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={
                      privacy === "private"
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <View style={styles.privacyInfo}>
                    <Text
                      style={[
                        styles.privacyTitle,
                        {
                          color:
                            privacy === "private"
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      Private
                    </Text>
                    <Text
                      style={[
                        styles.privacyDesc,
                        {
                          color:
                            privacy === "private"
                              ? colors.primary
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      Members need admin approval
                    </Text>
                  </View>
                  {privacy === "private" && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {type === "department" && (
            <View
              style={[
                styles.departmentNote,
                {
                  backgroundColor: colors.primary + "15",
                  borderColor: colors.primary + "30",
                },
              ]}
            >
              <Ionicons
                name="information-circle"
                size={20}
                color={colors.primary}
              />
              <Text
                style={[styles.departmentNoteText, { color: colors.primary }]}
              >
                Departments are always private. Members need admin approval to
                join.
              </Text>
            </View>
          )}

          {/* Name */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            NAME <Text style={{ color: "#ef4444" }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                color: colors.text,
                borderColor: errors.name ? "#ef4444" : "transparent",
              },
            ]}
            placeholder="Enter community name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name)
                setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            onFocus={handleNameFocus}
            maxLength={100}
            returnKeyType="next"
            onSubmitEditing={() => descriptionInputRef.current?.focus()}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>
            {name.length}/100
          </Text>

          {/* Description */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            DESCRIPTION <Text style={{ color: "#ef4444" }}>*</Text>
          </Text>
          <TextInput
            ref={descriptionInputRef}
            style={[
              styles.textArea,
              {
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                color: colors.text,
                borderColor: errors.description ? "#ef4444" : "transparent",
                borderWidth: errors.description ? 2 : 0,
              },
            ]}
            placeholder="Describe what this community is about..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (errors.description)
                setErrors((prev) => ({ ...prev, description: undefined }));
            }}
            onFocus={handleDescriptionFocus}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          {errors.description && (
            <Text style={styles.errorText}>{errors.description}</Text>
          )}
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>
            {description.length}/500
          </Text>

          {/* Tags */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            TAGS (OPTIONAL)
          </Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[
                styles.tagInput,
                {
                  backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                  color: colors.text,
                },
              ]}
              placeholder="Add a tag..."
              placeholderTextColor={colors.textSecondary}
              value={tagInput}
              onChangeText={setTagInput}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={handleAddTag}
            />
            <TouchableOpacity
              style={[styles.addTagBtn, { backgroundColor: colors.primary }]}
              onPress={handleAddTag}
            >
              <Ionicons name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View
                  key={index}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.primary }]}>
                    {tag}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveTag(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Rules */}
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              RULES (OPTIONAL)
            </Text>
            <TouchableOpacity onPress={() => setShowAddRule(!showAddRule)}>
              <Text style={[styles.addRuleText, { color: colors.primary }]}>
                {showAddRule ? "Cancel" : "+ Add Rule"}
              </Text>
            </TouchableOpacity>
          </View>
          {showAddRule && (
            <View
              style={[
                styles.addRuleContainer,
                { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
              ]}
            >
              <TextInput
                style={[
                  styles.ruleInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Rule title"
                placeholderTextColor={colors.textSecondary}
                value={newRuleTitle}
                onChangeText={setNewRuleTitle}
                maxLength={100}
              />
              <TextInput
                style={[
                  styles.ruleInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Rule description (optional)"
                placeholderTextColor={colors.textSecondary}
                value={newRuleDescription}
                onChangeText={setNewRuleDescription}
                maxLength={300}
                multiline
              />
              <TouchableOpacity
                style={[styles.addRuleBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddRule}
              >
                <Text style={styles.addRuleBtnText}>Add Rule</Text>
              </TouchableOpacity>
            </View>
          )}
          {rules.length > 0 && (
            <View style={styles.rulesContainer}>
              {rules.map((rule, index) => (
                <View
                  key={index}
                  style={[
                    styles.ruleItem,
                    {
                      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                      borderColor: isDark ? "#334155" : "#e2e8f0",
                    },
                  ]}
                >
                  <View style={styles.ruleContent}>
                    <View style={styles.ruleHeader}>
                      <Text
                        style={[styles.ruleNumber, { color: colors.primary }]}
                      >
                        {index + 1}.
                      </Text>
                      <Text style={[styles.ruleTitle, { color: colors.text }]}>
                        {rule.title}
                      </Text>
                    </View>
                    {rule.description ? (
                      <Text
                        style={[
                          styles.ruleDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {rule.description}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveRule(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* University Display */}
          <View
            style={[
              styles.universityDisplay,
              { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
            ]}
          >
            <Ionicons
              name="business-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.universityText, { color: colors.text }]}>
              {university || "Loading university..."}
            </Text>
          </View>

          {/* Info Note */}
          <View
            style={[
              styles.infoNote,
              {
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.infoNoteText, { color: colors.textSecondary }]}
            >
              Your {type === "department" ? "department" : "community"} will be
              reviewed by university admins before being visible to others.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 14, fontFamily: "SofiaSans-Regular", marginTop: 12 },
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
  headerTitle: {
    fontSize: 17,
    fontFamily: "SofiaSans-Bold",
    flex: 1,
    textAlign: "center",
  },
  createBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  createBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  coverContainer: { marginBottom: 16, borderRadius: 12, overflow: "hidden" },
  coverImageWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
  },
  coverImage: { width: "100%", height: "100%" },
  coverPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  coverPlaceholderText: {
    fontSize: 14,
    fontFamily: "SofiaSans-SemiBold",
    marginTop: 8,
  },
  coverHint: { fontSize: 12, fontFamily: "SofiaSans-Regular", marginTop: 4 },
  changeCoverBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  changeCoverText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "SofiaSans-SemiBold",
  },
  removeCoverBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverOptions: { flexDirection: "row", gap: 12, marginBottom: 20 },
  coverOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  coverOptionText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "SofiaSans-Bold",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  typeSelector: { flexDirection: "row", gap: 12, marginBottom: 20 },
  typeOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  typeTitle: { fontSize: 15, fontFamily: "SofiaSans-Bold", marginTop: 8 },
  typeDesc: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    marginTop: 4,
  },
  privacySelector: { gap: 10, marginBottom: 20 },
  privacyOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  privacyInfo: { flex: 1 },
  privacyTitle: { fontSize: 14, fontFamily: "SofiaSans-SemiBold" },
  privacyDesc: { fontSize: 12, fontFamily: "SofiaSans-Regular", marginTop: 2 },
  departmentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  departmentNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    borderWidth: 2,
    marginBottom: 4,
  },
  textArea: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    minHeight: 100,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
    textAlign: "right",
    marginBottom: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 4,
  },
  tagInputRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tagInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  addTagBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addRuleText: { fontSize: 14, fontFamily: "SofiaSans-SemiBold" },
  addRuleContainer: { padding: 12, borderRadius: 10, gap: 8, marginBottom: 12 },
  ruleInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    borderWidth: 1,
  },
  addRuleBtn: { paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  addRuleBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  rulesContainer: { gap: 8, marginBottom: 16 },
  ruleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  ruleContent: { flex: 1 },
  ruleHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  ruleNumber: { fontSize: 14, fontFamily: "SofiaSans-Bold" },
  ruleTitle: { fontSize: 14, fontFamily: "SofiaSans-SemiBold", flex: 1 },
  ruleDescription: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginTop: 4,
    lineHeight: 16,
  },
  universityDisplay: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  universityText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
  },
});
