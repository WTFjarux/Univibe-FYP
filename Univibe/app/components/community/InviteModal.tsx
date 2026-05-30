// app/components/community/InviteModal.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import {
  communityService,
  getFullImageUrl,
} from "../../../lib/services/communityService";
import { API_BASE_URL } from "../../../constants/ipConstants";

interface InviteModalProps {
  visible: boolean;
  communityId: string;
  communityName: string;
  isAdmin: boolean;
  isPrivate: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

interface UserResult {
  _id: string;
  name: string;
  username: string;
  profilePicture: string | null;
  campus?: string;
  major?: string;
  connectionStatus?: string;
}

export default function InviteModal({
  visible,
  communityId,
  communityName,
  isAdmin,
  isPrivate,
  onClose,
  onInvited,
}: InviteModalProps) {
  const { colors, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery("");
      setSearchResults([]);
      setSearched(false);
      setInvitedIds(new Set());
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ============================================
  // DEBOUNCED SEARCH
  // ============================================

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/api/search/users?q=${encodeURIComponent(query)}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (data.success && data.data?.users) {
        const users: UserResult[] = data.data.users.map((u: any) => ({
          _id: u.user?._id || u._id,
          name: u.fullName || u.user?.name || "Unknown",
          username: u.username || "user",
          profilePicture: u.profilePicture || null,
          campus: u.campus || "",
          major: u.major || "",
          connectionStatus: u.connectionStatus,
        }));
        setSearchResults(users);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(text.trim());
      }, 300);
    },
    [performSearch],
  );

  // ============================================
  // INVITE USER
  // ============================================

  const handleInvite = async (user: UserResult) => {
    Alert.alert("Invite User", `Invite ${user.name} to "${communityName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Invite",
        onPress: async () => {
          setInvitingId(user._id);
          try {
            const result = await communityService.inviteUser(
              communityId,
              user._id,
            );

            if (result.success) {
              setInvitedIds((prev) => new Set(prev).add(user._id));
              Alert.alert("Success", "Invitation sent!");
              onInvited?.();
            } else {
              Alert.alert("Error", result.message || "Failed to invite user");
            }
          } catch (error) {
            console.error("Invite error:", error);
            Alert.alert("Error", "Failed to send invitation");
          } finally {
            setInvitingId(null);
          }
        },
      },
    ]);
  };

  // ============================================
  // AVATAR HELPERS
  // ============================================

  const getInitials = (name: string): string => {
    if (!name || name === "Unknown") return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (id: string): string => {
    const colorPalette = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E9",
      "#F8C471",
      "#82E0AA",
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colorPalette[Math.abs(hash) % colorPalette.length];
  };

  // ============================================
  // RENDER USER ITEM
  // ============================================

  const renderUserItem = ({ item }: { item: UserResult }) => {
    const isInviting = invitingId === item._id;
    const isInvited = invitedIds.has(item._id);
    const avatarUri = item.profilePicture
      ? getFullImageUrl(item.profilePicture)
      : null;

    return (
      <View style={styles.userItem}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: getAvatarColor(item._id) + "25" },
            ]}
          >
            <Text
              style={[styles.avatarText, { color: getAvatarColor(item._id) }]}
            >
              {getInitials(item.name)}
            </Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text
            style={[styles.userName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[styles.userUsername, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            @{item.username}
          </Text>
          {item.major ? (
            <Text
              style={[styles.userDetail, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.major}
            </Text>
          ) : null}
        </View>

        {isInvited ? (
          <View style={[styles.invitedBadge, { backgroundColor: "#10b98120" }]}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            <Text style={[styles.invitedText, { color: "#10b981" }]}>
              Invited
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleInvite(item)}
            disabled={isInviting}
          >
            {isInviting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="person-add" size={16} color="#ffffff" />
                <Text style={styles.inviteBtnText}>Invite</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.header,
            { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Invite to Community
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                borderColor: isDark ? "#334155" : "#cbd5e1",
              },
            ]}
          >
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by name or username..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearched(false);
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={
            searchResults.length === 0 ? styles.emptyList : styles.listContent
          }
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name={searched ? "people-outline" : "search-outline"}
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {searched ? "No users found" : "Search for users"}
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  {searched
                    ? "Try searching with a different name or username"
                    : "Enter a name or username to find people to invite"}
                </Text>
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerTitle: { fontSize: 17, fontFamily: "SofiaSans-Bold" },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    paddingVertical: 10,
  },
  loadingContainer: { paddingVertical: 8, alignItems: "center" },
  listContent: { paddingBottom: 40 },
  emptyList: { flexGrow: 1 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 17, fontFamily: "SofiaSans-Bold" },
  userInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  userName: { fontSize: 15, fontFamily: "SofiaSans-SemiBold" },
  userUsername: { fontSize: 12, fontFamily: "SofiaSans-Regular", marginTop: 1 },
  userDetail: { fontSize: 11, fontFamily: "SofiaSans-Regular", marginTop: 2 },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  inviteBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "SofiaSans-SemiBold",
  },
  invitedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  invitedText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 18, fontFamily: "SofiaSans-Bold", marginTop: 16 },
  emptyText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
