// app/screens/EditCommunityScreen.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../lib/contexts/ThemeContext";
import {
  communityService,
  getFullImageUrl,
} from "../../lib/services/communityService";
import {
  Community,
  CommunityRule,
  PrivacyType,
} from "../../lib/types/community";
import DiscardChangesModal from "../components/DiscardChangesModal";

export default function EditCommunityScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { colors, isDark } = useTheme();

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const pickerActiveRef = useRef(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<PrivacyType>("public");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [newCoverImage, setNewCoverImage] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const [showAddRule, setShowAddRule] = useState(false);
  const [isDepartment, setIsDepartment] = useState(false);

  // Original data for comparison
  const [originalData, setOriginalData] = useState<{
    name: string;
    description: string;
    privacy: PrivacyType;
    coverImage: string | null;
    tags: string[];
    rules: CommunityRule[];
  } | null>(null);

  // Track if this is a resubmission (rejected community)
  const [isResubmission, setIsResubmission] = useState(false);

  // Errors
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Discard modal
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // ============================================
  // LOAD COMMUNITY DATA
  // ============================================

  useEffect(() => {
    const loadCommunity = async () => {
      if (!communityId) return;
      try {
        const result = await communityService.getCommunity(communityId);
        if (result.success && result.data) {
          const community = result.data;
          const initialData = {
            name: community.name,
            description: community.description || "",
            privacy: community.privacy,
            coverImage: community.coverImage,
            tags: community.tags || [],
            rules: community.rules || [],
          };
          setOriginalData(initialData);
          setName(initialData.name);
          setDescription(initialData.description);
          setPrivacy(initialData.privacy);
          setCoverImage(initialData.coverImage);
          setTags(initialData.tags);
          setRules(initialData.rules);
          setIsDepartment(community.type === "department");

          // Check if this is a rejected community being resubmitted
          if (community.approvalStatus === "rejected") {
            setIsResubmission(true);
          }
        } else {
          Alert.alert("Error", "Community not found");
          router.back();
        }
      } catch (error) {
        console.error("Load community error:", error);
        Alert.alert("Error", "Failed to load community");
        router.back();
      } finally {
        setLoading(false);
      }
    };
    loadCommunity();
  }, [communityId]);

  // ============================================
  // CHECK FOR UNSAVED CHANGES
  // ============================================

  const hasChanges = useCallback((): boolean => {
    if (!originalData) return false;
    return (
      name !== originalData.name ||
      description !== originalData.description ||
      privacy !== originalData.privacy ||
      newCoverImage !== null ||
      JSON.stringify(tags) !== JSON.stringify(originalData.tags) ||
      JSON.stringify(rules) !== JSON.stringify(originalData.rules)
    );
  }, [originalData, name, description, privacy, newCoverImage, tags, rules]);

  // ============================================
  // BACK HANDLER WITH DISCARD CHECK
  // ============================================

  const handleBackPress = useCallback(() => {
    if (hasChanges()) {
      setShowDiscardModal(true);
    } else {
      router.back();
    }
  }, [hasChanges]);

  const handleDiscardChanges = useCallback(() => {
    setShowDiscardModal(false);
    router.back();
  }, []);

  // ============================================
  // VALIDATION
  // ============================================

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = "Community name is required";
    } else if (name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (name.trim().length > 100) {
      newErrors.name = "Name must be less than 100 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // COVER IMAGE HANDLERS
  // ============================================

  const handlePickCover = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setNewCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select image");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleRemoveCover = () => {
    Alert.alert(
      "Remove Cover",
      "Are you sure you want to remove the cover image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setNewCoverImage(null);
            setCoverImage(null);
          },
        },
      ],
    );
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
  // SAVE
  // ============================================

  const handleSave = async () => {
    if (!validate()) return;

    if (isResubmission) {
      Alert.alert(
        "Resubmit for Approval",
        "Are you sure you want to resubmit this community for approval? It will be reviewed by university admins again.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Resubmit", onPress: () => performSave() },
        ],
      );
      return;
    }

    // ✅ Warn about privacy change
    if (privacy !== originalData?.privacy) {
      const message =
        privacy === "private"
          ? "Changing to private means new members will need admin approval to join. Existing members will not be affected."
          : "Changing to public means anyone can join instantly without approval.";

      Alert.alert("Change Privacy?", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => performSave() },
      ]);
      return;
    }

    performSave();
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        tags: tags,
        rules: rules,
      };
      if (!isDepartment) {
        payload.privacy = privacy;
      }
      if (newCoverImage !== null) {
        if (newCoverImage) {
          const filename = newCoverImage.split("/").pop() || "cover.jpg";
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : "image/jpeg";
          payload.coverImage = { uri: newCoverImage, name: filename, type };
        }
      }

      const result = await communityService.updateCommunity(
        communityId!,
        payload,
      );

      if (result.success) {
        if (isResubmission) {
          Alert.alert(
            "Resubmitted! 🎉",
            "Your community has been resubmitted for approval. You'll be notified once it's reviewed.",
            [{ text: "OK", onPress: () => router.back() }],
          );
        } else {
          Alert.alert("Success", "Community updated successfully", [
            { text: "OK", onPress: () => router.back() },
          ]);
        }
      } else {
        Alert.alert("Error", result.message || "Failed to update community");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading community...
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
        <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isResubmission ? "Edit & Resubmit" : "Edit Community"}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !hasChanges()}
          style={[
            styles.saveBtn,
            (!hasChanges() || saving) && styles.saveBtnDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.saveBtnText,
                { color: hasChanges() ? "#ffffff" : colors.textSecondary },
              ]}
            >
              {isResubmission ? "Resubmit" : "Save"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Resubmission banner */}
      {isResubmission && (
        <View
          style={[
            styles.resubmitBanner,
            { backgroundColor: "#f59e0b15", borderColor: "#f59e0b30" },
          ]}
        >
          <Ionicons name="information-circle" size={18} color="#f59e0b" />
          <Text style={[styles.resubmitBannerText, { color: "#f59e0b" }]}>
            This community was rejected. Make the necessary changes and resubmit
            for approval.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover Image */}
          <TouchableOpacity
            style={styles.coverContainer}
            onPress={handlePickCover}
            activeOpacity={0.8}
          >
            {newCoverImage !== null ? (
              newCoverImage ? (
                <View>
                  <Image
                    source={{ uri: newCoverImage }}
                    style={styles.coverImage}
                  />
                  <TouchableOpacity
                    style={styles.changeCoverBtn}
                    onPress={handlePickCover}
                  >
                    <Ionicons name="camera" size={14} color="#ffffff" />
                    <Text style={styles.changeCoverText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeCoverBtn}
                    onPress={handleRemoveCover}
                  >
                    <Ionicons name="trash" size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  style={[
                    styles.coverPlaceholder,
                    { backgroundColor: colors.primary + "15" },
                  ]}
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
                </View>
              )
            ) : coverImage ? (
              <View>
                <Image
                  source={{ uri: getFullImageUrl(coverImage) }}
                  style={styles.coverImage}
                />
                <TouchableOpacity
                  style={styles.changeCoverBtn}
                  onPress={handlePickCover}
                >
                  <Ionicons name="camera" size={14} color="#ffffff" />
                  <Text style={styles.changeCoverText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeCoverBtn}
                  onPress={handleRemoveCover}
                >
                  <Ionicons name="trash" size={14} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={[
                  styles.coverPlaceholder,
                  { backgroundColor: colors.primary + "15" },
                ]}
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
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            NAME
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
            placeholder="Community name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors({});
            }}
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
            DESCRIPTION
          </Text>
          <TextInput
            ref={descriptionInputRef}
            style={[
              styles.textArea,
              {
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                color: colors.text,
              },
            ]}
            placeholder="Describe what this community is about..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>
            {description.length}/500
          </Text>

          {/* ✅ Privacy Selector (only for non-department communities) */}
          {!isDepartment && (
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

          {/* Department note */}
          {isDepartment && (
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

          {/* Tags */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            TAGS
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
              RULES
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

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <DiscardChangesModal
        visible={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onDiscard={handleDiscardChanges}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to leave?"
        keepEditingText="Keep Editing"
        discardText="Discard"
      />
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
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#8b5cf6",
  },
  saveBtnDisabled: { backgroundColor: "transparent" },
  saveBtnText: { fontSize: 14, fontFamily: "SofiaSans-Bold" },
  resubmitBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  resubmitBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 16,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  coverContainer: { marginBottom: 20 },
  coverImage: { width: "100%", height: 180, borderRadius: 12 },
  coverPlaceholder: {
    width: "100%",
    height: 180,
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
  sectionLabel: {
    fontSize: 12,
    fontFamily: "SofiaSans-Bold",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
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
    marginBottom: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 4,
  },
  // ✅ Privacy selector
  privacySelector: { gap: 10, marginBottom: 8 },
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
    marginBottom: 8,
    gap: 8,
  },
  departmentNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
  },
  // Tags
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
    marginBottom: 8,
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
  // Rules
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
  rulesContainer: { gap: 8, marginBottom: 8 },
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
});
