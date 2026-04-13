// app/screens/ChatListScreen.tsx
/**
 * Chat List Screen
 *
 * Displays all user conversations with search functionality and ability to start new chats.
 * Features:
 * - List of existing chat rooms
 * - Search conversations by name
 * - Create new chat by searching users
 * - Real-time updates when new messages arrive
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { API_BASE_URL } from "../../constants/ipConstants";
import { Ionicons } from "@expo/vector-icons";
import { profileService } from "../../lib/services/profileService";
import { socketService } from "../../lib/services";

/** Chat room data structure from API */
interface ChatRoom {
  roomId: string;
  type: string;
  name: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  lastMessage?: {
    message: string;
    sentAt: string;
  };
  updatedAt: string;
}

/** User data structure for search results */
interface User {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

export default function ChatListScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  // State declarations
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  // Monitor socket connection
  useEffect(() => {
    const checkConnection = () =>
      setSocketConnected(socketService.getConnectionStatus());
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Setup socket listeners for real-time updates
  useEffect(() => {
    if (!socketConnected) return;

    // Listen for new messages
    const handleReceiveMessage = (message: any) => {
      if (message.roomId) {
        updateChatRoomLastMessage(
          message.roomId,
          message.message,
          new Date().toISOString(),
        );
      }
    };

    // Listen for message deletion
    const handleMessageDeleted = (data: {
      roomId: string;
      messageId: string;
    }) => {
      if (data.roomId) {
        // Force refresh the entire chat list to get accurate data
        fetchChatRooms();
      }
    };

    // Listen for message updates (reactions, etc.)
    const handleMessageUpdated = (data: { roomId: string }) => {
      if (data.roomId) {
        refreshChatRoom(data.roomId);
      }
    };

    socketService.on("receive_message", handleReceiveMessage);
    socketService.on("message_deleted", handleMessageDeleted);
    socketService.on("message_updated", handleMessageUpdated);

    return () => {
      socketService.off("receive_message", handleReceiveMessage);
      socketService.off("message_deleted", handleMessageDeleted);
      socketService.off("message_updated", handleMessageUpdated);
    };
  }, [socketConnected]);

  /**
   * Update a specific chat room's last message
   */
  const updateChatRoomLastMessage = (
    roomId: string,
    message: string,
    sentAt: string,
  ) => {
    setChatRooms((prev) => {
      const updated = prev.map((room) => {
        if (room.roomId === roomId) {
          return {
            ...room,
            lastMessage: { message, sentAt },
            updatedAt: sentAt,
          };
        }
        return room;
      });
      // Sort by updatedAt (most recent first)
      updated.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      return updated;
    });
    setFilteredRooms((prev) => {
      const updated = prev.map((room) => {
        if (room.roomId === roomId) {
          return {
            ...room,
            lastMessage: { message, sentAt },
            updatedAt: sentAt,
          };
        }
        return room;
      });
      updated.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      return updated;
    });
  };

  /**
   * Refresh a specific chat room to get latest data
   */
  const refreshChatRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data) {
        const updatedRoom = {
          roomId: data.data.roomId,
          type: data.data.type,
          name: data.data.name,
          otherUserId: data.data.otherUserId,
          otherUserAvatar: data.data.otherUserAvatar,
          lastMessage: data.data.lastMessage,
          updatedAt: data.data.updatedAt,
        };

        setChatRooms((prev) => {
          const exists = prev.some((room) => room.roomId === roomId);
          let newRooms;
          if (exists) {
            newRooms = prev.map((room) =>
              room.roomId === roomId ? updatedRoom : room,
            );
          } else {
            newRooms = [...prev, updatedRoom];
          }
          // Sort by updatedAt
          newRooms.sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
          return newRooms;
        });

        // Update filteredRooms if not in search mode
        if (!searchQuery.trim()) {
          setFilteredRooms((prev) => {
            const exists = prev.some((room) => room.roomId === roomId);
            let newRooms;
            if (exists) {
              newRooms = prev.map((room) =>
                room.roomId === roomId ? updatedRoom : room,
              );
            } else {
              newRooms = [...prev, updatedRoom];
            }
            newRooms.sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            );
            return newRooms;
          });
        }
      }
    } catch (error) {
      console.error("Error refreshing chat room:", error);
    }
  };

  /**
   * Fetch all chat rooms for current user
   * Runs when screen is focused
   */
  const fetchChatRooms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        // Sort by updatedAt (most recent first)
        const sortedRooms = data.data.sort(
          (a: ChatRoom, b: ChatRoom) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setChatRooms(sortedRooms);

        // Only update filteredRooms if not searching
        if (!searchQuery.trim()) {
          setFilteredRooms(sortedRooms);
        } else {
          // Re-apply search filter
          const filtered = sortedRooms.filter((room: ChatRoom) =>
            room.name.toLowerCase().includes(searchQuery.toLowerCase()),
          );
          setFilteredRooms(filtered);
        }
      }
    } catch (error) {
      console.error("Error fetching chat rooms:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Search for users by name or username
   * @param query - Search query string
   */
  const fetchUsers = async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    setLoadingUsers(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();

      if (data.success && data.profiles) {
        // Filter out current user
        const filteredUsers = data.profiles.filter(
          (profile: any) => profile.user?._id !== user?.id,
        );
        setUsers(filteredUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  /**
   * Filter chat rooms based on search query
   * @param text - Search input text
   */
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim()) {
      const filtered = chatRooms.filter((room) =>
        room.name.toLowerCase().includes(text.toLowerCase()),
      );
      setFilteredRooms(filtered);
    } else {
      setFilteredRooms(chatRooms);
    }
  };

  /**
   * Handle user search input for new chat modal
   * @param text - Search input text
   */
  const handleSearchUsers = (text: string) => {
    setSearchUserQuery(text);
    fetchUsers(text);
  };

  /**
   * Start a new chat with selected user
   * Creates or retrieves existing chat room
   * @param userId - Target user ID
   * @param userName - Target user name
   * @param userAvatar - Target user avatar
   */
  const startNewChat = async (
    userId: string,
    userName: string,
    userAvatar?: string,
  ) => {
    setShowNewChatModal(false);
    setSearchUserQuery("");
    setUsers([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/room/${userId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        router.push({
          pathname: "/screens/ChatScreen",
          params: {
            roomId: data.data.roomId,
            otherUserName: userName,
            otherUserId: userId,
            otherUserAvatar: userAvatar || "",
          },
        });
      }
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  /**
   * Navigate to existing chat screen
   * @param roomId - Chat room ID
   * @param name - Other user's name
   * @param otherUserId - Other user's ID
   * @param otherUserAvatar - Other user's avatar URL
   */
  const navigateToChat = (
    roomId: string,
    name: string,
    otherUserId?: string,
    otherUserAvatar?: string,
  ) => {
    router.push({
      pathname: "/screens/ChatScreen",
      params: {
        roomId,
        otherUserName: name,
        otherUserId: otherUserId || "",
        otherUserAvatar: otherUserAvatar || "",
      },
    });
  };

  /**
   * Format timestamp for display
   * @param dateString - ISO date string
   * @returns Formatted time string
   */
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (hours < 48) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  /**
   * Get user initials for avatar fallback
   * @param name - User's full name
   * @returns First letter of name
   */
  const getInitials = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || "?";
  };

  /**
   * Get full image URL for avatar
   * @param avatar - Relative avatar path
   * @returns Complete image URL
   */
  const getAvatarUrl = (avatar: string | undefined): string => {
    if (!avatar) return "";
    return profileService.getFullImageUrl(avatar);
  };

  /**
   * Render individual chat room item
   */
  const renderChatItem = ({ item }: { item: ChatRoom }) => {
    const avatarUrl = getAvatarUrl(item.otherUserAvatar);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() =>
          navigateToChat(
            item.roomId,
            item.name,
            item.otherUserId,
            item.otherUserAvatar,
          )
        }
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
            </View>
          )}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{item.name}</Text>
            {item.lastMessage && (
              <Text style={styles.chatTime}>
                {formatTime(item.lastMessage.sentAt)}
              </Text>
            )}
          </View>

          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage?.message || "No messages yet"}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  /**
   * Render user item in new chat search results
   */
  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => startNewChat(item._id, item.name, item.profilePicture)}
    >
      {item.profilePicture ? (
        <Image
          source={{ uri: getAvatarUrl(item.profilePicture) }}
          style={styles.userAvatar}
        />
      ) : (
        <View style={styles.userAvatarPlaceholder}>
          <Text style={styles.userAvatarText}>{getInitials(item.name)}</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  // Refresh chat rooms when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchChatRooms();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchChatRooms();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>
        {/* Header with title and create icon */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowNewChatModal(true)}
          >
            <Ionicons name="create-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Chat Rooms List */}
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.roomId}
          renderItem={renderChatItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + icon to start a new chat
              </Text>
            </View>
          }
        />

        {/* New Chat Modal */}
        <Modal
          visible={showNewChatModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowNewChatModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowNewChatModal(false)}>
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
                value={searchUserQuery}
                onChangeText={handleSearchUsers}
                autoFocus
                placeholderTextColor="#999"
              />
            </View>

            {loadingUsers ? (
              <ActivityIndicator style={styles.loader} color="#007AFF" />
            ) : (
              <FlatList
                data={users}
                keyExtractor={(item) => item._id}
                renderItem={renderUserItem}
                ListEmptyComponent={
                  searchUserQuery.length > 0 ? (
                    <View style={styles.emptyUsersContainer}>
                      <Text style={styles.emptyUsersText}>No users found</Text>
                    </View>
                  ) : (
                    <View style={styles.emptyUsersContainer}>
                      <Text style={styles.emptyUsersText}>
                        Search for users to start a chat
                      </Text>
                    </View>
                  )
                }
              />
            )}
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  createButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
  },
  chatItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  chatTime: {
    fontSize: 12,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  lastMessage: {
    fontSize: 14,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
    fontFamily: "SofiaSans-Bold",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
  },
  // Modal styles
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
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  userAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  userUsername: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
    fontFamily: "SofiaSans-Regular",
  },
  loader: {
    marginTop: 20,
  },
  emptyUsersContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyUsersText: {
    fontSize: 16,
    color: "#999",
    fontFamily: "SofiaSans-Regular",
  },
});
