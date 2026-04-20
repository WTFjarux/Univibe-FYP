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
import { UserItem } from "../ChatList/UserItem";
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

export const NewChatModal: React.FC<NewChatModalProps> = ({
  visible,
  onClose,
  onStartChat,
  currentUserId,
  token,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

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
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.success && data.profiles) {
        const filtered = data.profiles.filter(
          (profile: { user?: { _id: string } }) =>
            profile.user?._id !== currentUserId,
        );
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
    // Reset state after starting chat
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
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Chat</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.modalSearchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.modalSearchInput}
            placeholder="Search by name or username..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator
            style={styles.loader}
            size="large"
            color="#007AFF"
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
                <Ionicons name="people-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyUsersText}>
                  {searchQuery.length > 0
                    ? "No users found"
                    : "Search for users to start a chat"}
                </Text>
                {searchQuery.length === 0 && (
                  <Text style={styles.emptyUsersSubtext}>
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
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
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
    color: "#999",
    marginTop: 16,
    fontFamily: "SofiaSans-Regular",
  },
  emptyUsersSubtext: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },
});
