// app/components/chat/ChatList/NewChatModal.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import UserItem from "../ChatList/UserItem";
import { API_BASE_URL } from "../../../../constants/ipConstants";

// Define the User interface
interface User {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

// Define the props interface
interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
  onStartChat: (userId: string, userName: string, userAvatar?: string) => void;
  currentUserId?: string;
  token: string | null;
}

export default function NewChatModal({
  visible,
  onClose,
  onStartChat,
  currentUserId,
  token,
}: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { colors } = useTheme();

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setUsers([]);
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && searchQuery.trim()) {
      fetchUsers(searchQuery);
    } else if (visible) {
      setUsers([]);
    }
  }, [searchQuery, visible]);

  const fetchUsers = async (query: string) => {
    if (!query.trim() || !token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/profile/search-connections?query=${encodeURIComponent(query)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();

      if (data.success && data.data) {
        const profiles = Array.isArray(data.data) ? data.data : [];
        const filtered = profiles
          .filter((profile: any) => {
            const userId = profile.user?._id || profile._id;
            return userId !== currentUserId;
          })
          .map((profile: any) => ({
            _id: profile.user?._id || profile._id,
            name:
              profile.user?.name ||
              profile.fullName ||
              profile.name ||
              "Unknown",
            username: profile.user?.username || profile.username || "",
            profilePicture:
              profile.profilePicture || profile.user?.profilePicture || "",
          }));
        setUsers(filtered);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) setUsers([]);
  };

  const handleStartChat = (user: User) => {
    onStartChat(user._id, user.name, user.profilePicture);
    setSearchQuery("");
    setUsers([]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.modalHeader,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            New Chat
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <View
          style={[
            styles.modalSearchContainer,
            { backgroundColor: colors.skeleton },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={[styles.modalSearchInput, { color: colors.text }]}
            placeholder="Search by name or username..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator
            style={styles.loader}
            size="large"
            color={colors.primary}
          />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <UserItem user={item} onPress={() => handleStartChat(item)} />
            )}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyUsersContainer}>
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={colors.textMuted}
                />
                <Text
                  style={[
                    styles.emptyUsersText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {searchQuery.length > 0
                    ? "No users found"
                    : "Search for users to start a chat"}
                </Text>
                {searchQuery.length === 0 && (
                  <Text
                    style={[
                      styles.emptyUsersSubtext,
                      { color: colors.textMuted },
                    ]}
                  >
                    Enter a name or username to find people
                  </Text>
                )}
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
  },
  loader: {
    marginTop: 20,
  },
  emptyUsersContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyUsersText: {
    fontSize: 16,
    marginTop: 16,
    fontFamily: "SofiaSans-Regular",
  },
  emptyUsersSubtext: {
    fontSize: 14,
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },
});
