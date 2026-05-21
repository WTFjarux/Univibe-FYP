// app/components/chat/ChatList/CreateGroupModal.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import { API_BASE_URL } from "../../../../constants/ipConstants";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_GROUP_NAME_LENGTH = 50;
const MIN_MEMBERS = 2;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface User {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (roomId: string, groupName: string) => void;
  token: string | null;
  currentUserId?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CreateGroupModal({
  visible,
  onClose,
  onGroupCreated,
  token,
  currentUserId,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (visible) resetState();
  }, [visible]);
  useEffect(() => {
    if (!visible || !searchQuery.trim()) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(() => fetchUsers(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, visible]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setGroupPhoto(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => {
    setGroupPhoto(null);
  };

  const fetchUsers = async (query: string) => {
    if (!query.trim() || !token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (data.success && data.data) {
        const profiles = Array.isArray(data.data) ? data.data : [];
        const filtered = profiles
          .filter((profile: any) => {
            const userId = profile.user?._id || profile._id;
            return (
              userId !== currentUserId &&
              !selectedUsers.some((u) => u._id === userId)
            );
          })
          .map((profile: any) => ({
            _id: profile.user?._id || profile._id,
            name: profile.user?.name || profile.fullName || "Unknown",
            username: profile.username || "",
            profilePicture: profile.profilePicture || "",
            bio: profile.bio || "",
          }));
        setUsers(filtered);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (user: User) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u._id === user._id);
      if (exists) return prev.filter((u) => u._id !== user._id);
      return [...prev, user];
    });
  };

  const uploadGroupPhoto = async (): Promise<string | null> => {
    if (!groupPhoto) return null;
    try {
      const formData = new FormData();
      const filename = groupPhoto.split("/").pop() || "photo.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";
      formData.append("image", {
        uri: groupPhoto,
        name: filename,
        type,
      } as any);
      const res = await fetch(`${API_BASE_URL}/api/groups/upload-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) return data.url;
      return null;
    } catch (error) {
      return null;
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Group Name Required", "Please enter a name for your group.");
      return;
    }
    if (selectedUsers.length < MIN_MEMBERS) {
      Alert.alert(
        "More Members Needed",
        `Please select at least ${MIN_MEMBERS} members.`,
      );
      return;
    }
    setCreating(true);
    try {
      let photoUrl = null;
      if (groupPhoto) {
        photoUrl = await uploadGroupPhoto();
      }
      const response = await fetch(`${API_BASE_URL}/api/groups/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim(),
          icon: photoUrl,
          participantIds: selectedUsers.map((u) => u._id),
        }),
      });
      const data = await response.json();
      if (data.success) {
        onGroupCreated(data.data.roomId, groupName.trim());
        handleClose();
      } else {
        Alert.alert("Error", data.message || "Failed to create group");
      }
    } catch (error) {
      Alert.alert("Connection Error", "Please check your internet connection.");
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setGroupName("");
    setGroupDescription("");
    setGroupPhoto(null);
    setSearchQuery("");
    setUsers([]);
    setSelectedUsers([]);
    setLoading(false);
    setCreating(false);
  };
  const handleClose = () => {
    resetState();
    onClose();
  };

  const getMemberCountColor = () => {
    const count = selectedUsers.length;
    if (count >= MIN_MEMBERS) return "#34C759";
    if (count > 0) return "#FF9500";
    return colors.textSecondary;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            New Group
          </Text>
          <View style={styles.headerBtn} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={handlePickImage}
              >
                {groupPhoto ? (
                  <Image source={{ uri: groupPhoto }} style={styles.photo} />
                ) : (
                  <View
                    style={[
                      styles.photoPlaceholder,
                      {
                        backgroundColor: isDark
                          ? "rgba(167, 139, 250, 0.1)"
                          : "#F5F3FF",
                        borderColor: isDark
                          ? "rgba(167, 139, 250, 0.3)"
                          : "#EDE9FE",
                      },
                    ]}
                  >
                    <Ionicons
                      name="camera"
                      size={32}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.cameraBadge,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.card,
                    },
                  ]}
                >
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
              {groupPhoto ? (
                <TouchableOpacity
                  onPress={handleRemovePhoto}
                  style={styles.removePhotoBtn}
                >
                  <Text style={styles.removePhotoText}>Remove Photo</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={styles.addPhotoBtn}
                >
                  <Text
                    style={[styles.addPhotoText, { color: colors.primary }]}
                  >
                    Add Group Photo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.inputSection}>
              <Text
                style={[styles.sectionLabel, { color: colors.textSecondary }]}
              >
                GROUP NAME *
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.skeleton,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="chatbox-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Enter group name"
                  placeholderTextColor={colors.textMuted}
                  value={groupName}
                  onChangeText={(text) => {
                    if (text.length <= MAX_GROUP_NAME_LENGTH)
                      setGroupName(text);
                  }}
                  maxLength={MAX_GROUP_NAME_LENGTH}
                  autoFocus
                  autoCorrect={false}
                />
              </View>
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {groupName.length}/{MAX_GROUP_NAME_LENGTH}
              </Text>
            </View>
            <View style={styles.inputSection}>
              <Text
                style={[styles.sectionLabel, { color: colors.textSecondary }]}
              >
                DESCRIPTION (OPTIONAL)
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  styles.descWrapper,
                  {
                    backgroundColor: colors.skeleton,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.descIcon}
                />
                <TextInput
                  style={[styles.descInput, { color: colors.text }]}
                  placeholder="What's this group about?"
                  placeholderTextColor={colors.textMuted}
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
              </View>
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {groupDescription.length}/200
              </Text>
            </View>
            <View style={styles.membersSection}>
              <View style={styles.membersHeader}>
                <View style={styles.membersHeaderLeft}>
                  <Ionicons
                    name="people"
                    size={18}
                    color={getMemberCountColor()}
                  />
                  <Text
                    style={[
                      styles.membersCount,
                      { color: getMemberCountColor() },
                    ]}
                  >
                    {selectedUsers.length} member
                    {selectedUsers.length !== 1 ? "s" : ""} selected
                  </Text>
                </View>
                <Text
                  style={[styles.minMembers, { color: colors.textSecondary }]}
                >
                  Min. {MIN_MEMBERS}
                </Text>
              </View>
              {selectedUsers.length > 0 && (
                <View style={styles.chipsScroll}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsList}
                  >
                    {selectedUsers.map((user) => (
                      <TouchableOpacity
                        key={user._id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isDark
                              ? "rgba(167, 139, 250, 0.15)"
                              : "#F5F3FF",
                          },
                        ]}
                        onPress={() => handleToggleUser(user)}
                      >
                        <View
                          style={[
                            styles.chipAvatar,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          {user.profilePicture ? (
                            <Image
                              source={{ uri: user.profilePicture }}
                              style={styles.chipAvatarImg}
                            />
                          ) : (
                            <Text style={styles.chipAvatarText}>
                              {user.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[styles.chipName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {user.name.split(" ")[0]}
                        </Text>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <View style={styles.searchSection}>
              <View
                style={[
                  styles.searchWrapper,
                  { backgroundColor: colors.skeleton },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  ref={searchInputRef}
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search connections to add..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View>
                {users.length === 0 && searchQuery.trim() ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="person-outline"
                      size={40}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[styles.emptyTitle, { color: colors.textMuted }]}
                    >
                      No connections found
                    </Text>
                  </View>
                ) : (
                  users.map((item) => {
                    const isSelected = selectedUsers.some(
                      (u) => u._id === item._id,
                    );
                    return (
                      <TouchableOpacity
                        key={item._id}
                        style={[
                          styles.userItem,
                          isSelected && {
                            backgroundColor: isDark
                              ? "rgba(167, 139, 250, 0.08)"
                              : "rgba(139, 92, 246, 0.06)",
                          },
                        ]}
                        onPress={() => handleToggleUser(item)}
                      >
                        <View
                          style={[
                            styles.userAvatar,
                            { backgroundColor: colors.skeleton },
                          ]}
                        >
                          {item.profilePicture ? (
                            <Image
                              source={{ uri: item.profilePicture }}
                              style={styles.userAvatarImg}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.userAvatarText,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {item.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.userInfo}>
                          <Text
                            style={[styles.userName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              styles.userUsername,
                              { color: colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            @{item.username}
                          </Text>
                        </View>
                        <View
                          style={
                            isSelected
                              ? [
                                  styles.checkboxSelected,
                                  { backgroundColor: colors.primary },
                                ]
                              : [
                                  styles.checkboxEmpty,
                                  { borderColor: colors.textMuted },
                                ]
                          }
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.createBtn,
                { backgroundColor: colors.primary },
                (!groupName.trim() ||
                  selectedUsers.length < MIN_MEMBERS ||
                  creating) &&
                  styles.createBtnDisabled,
              ]}
              onPress={handleCreateGroup}
              disabled={
                !groupName.trim() ||
                selectedUsers.length < MIN_MEMBERS ||
                creating
              }
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>
                  Create Group
                  {selectedUsers.length >= MIN_MEMBERS
                    ? ` (${selectedUsers.length})`
                    : ""}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  photoSection: { alignItems: "center", paddingTop: 20, paddingBottom: 8 },
  photoContainer: { position: "relative", marginBottom: 12 },
  photo: { width: 90, height: 90, borderRadius: 45 },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  addPhotoBtn: { paddingVertical: 4 },
  addPhotoText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  removePhotoBtn: { paddingVertical: 4 },
  removePhotoText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  inputSection: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.5,
    fontFamily: "SofiaSans-SemiBold",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  descWrapper: { alignItems: "flex-start", paddingVertical: 4 },
  inputIcon: { marginRight: 10 },
  descIcon: { marginRight: 10, marginTop: 10 },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    fontFamily: "SofiaSans-Regular",
  },
  descInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
    minHeight: 60,
    fontFamily: "SofiaSans-Regular",
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  membersSection: { paddingHorizontal: 20, paddingTop: 20 },
  membersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  membersHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  membersCount: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  minMembers: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  chipsScroll: { marginBottom: 4 },
  chipsList: { paddingVertical: 4, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  chipAvatarImg: { width: "100%", height: "100%" },
  chipAvatarText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chipName: { fontSize: 13, maxWidth: 80, fontFamily: "SofiaSans-Medium" },
  searchSection: { paddingHorizontal: 16, paddingTop: 12 },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
  },
  loadingContainer: { paddingVertical: 40, alignItems: "center" },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  userAvatarImg: { width: "100%", height: "100%" },
  userAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "500", fontFamily: "SofiaSans-Medium" },
  userUsername: { fontSize: 13, marginTop: 2, fontFamily: "SofiaSans-Regular" },
  checkboxSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxEmpty: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { fontSize: 14, marginTop: 8, fontFamily: "SofiaSans-Regular" },
  bottomBar: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1 },
  createBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
});
