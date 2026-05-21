// app/screens/ChatListScreen.tsx

import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { useActiveRoom } from "../../lib/contexts/ActiveRoomContext";
import { useTheme } from "../../lib/contexts/ThemeContext";
import { useChatList } from "../../hooks/chatList/useChatList";
import { useChatItemAnimations } from "../../hooks/chatList/useChatItemAnimation";
import ChatListHeader from "../components/chat/ChatList/ChatListHeader";
import SearchBar from "../components/chat/ChatList/SearchBar";
import EmptyChatList from "../components/chat/ChatList/EmptyChatList";
import NewChatModal from "../components/chat/ChatList/NewChatModal";
import CreateGroupModal from "../components/chat/ChatList/CreateGroupModal";
import ChatItem from "../components/chat/ChatList/ChatItem";
import ChatListOptionsModal from "../components/chat/ChatList/ChatListOptionsModal";
import type { ChatRoom, ItemLayout } from "../../lib/types/chat.types";
import { getDirectRoomId } from "../../lib/utils/chatUtils";

// -----------------------------------------------------------------------------
// ChatListScreen Component
// -----------------------------------------------------------------------------

export default function ChatListScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { clearActiveRoom } = useActiveRoom();
  const { colors, isDark } = useTheme();

  // Clear active room when this screen gains focus
  useFocusEffect(
    useCallback(() => {
      clearActiveRoom();
    }, [clearActiveRoom]),
  );

  // ─── Core chat list logic ────────────────────────────────────────────────

  const {
    filteredRooms,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery,
    fetchRooms,
    onRefresh,
    isRoomUnread,
    markRoomAsRead,
    pinChat,
    toggleRead,
    toggleMute,
    deleteChat,
  } = useChatList(token, user?.id);

  // ─── UI state ────────────────────────────────────────────────────────────

  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [selectedItemLayout, setSelectedItemLayout] = useState<ItemLayout>({
    y: 0,
    height: 0,
  });
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // ─── Animations ──────────────────────────────────────────────────────────

  const {
    itemScaleAnim,
    itemTranslateYAnim,
    highlightAnimRef,
    highlightedRoomIdRef,
    animateItemPop,
    resetItemAnimation,
  } = useChatItemAnimations();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Opens the options modal when a user long-presses a chat row.
   * Captures the item layout for animation positioning.
   */
  const handleLongPress = useCallback(
    (
      item: ChatRoom,
      layout: { y: number; height: number; pageX: number; pageY: number },
    ) => {
      setSelectedRoom(item);
      setSelectedItemLayout(layout);
      animateItemPop();
      setShowOptionsModal(true);
    },
    [animateItemPop],
  );

  /** Closes the options modal and resets animations */
  const handleCloseModal = useCallback(() => {
    resetItemAnimation();
    setShowOptionsModal(false);
    setSelectedRoom(null);
  }, [resetItemAnimation]);

  /**
   * Navigates to the ChatScreen for a given room.
   * Marks the room as read before navigating if it has unread messages.
   * Handles both direct and group chats.
   */
  const navigateToChat = useCallback(
    (room: ChatRoom) => {
      if (showOptionsModal) return;

      if (isRoomUnread(room)) {
        markRoomAsRead(room.roomId);
      }

      const isGroup = room.type === "group";

      router.push({
        pathname: "/screens/ChatScreen",
        params: {
          roomId: room.roomId,
          otherUserName: room.name,
          otherUserId: room.otherUserId ?? "",
          otherUserAvatar: room.otherUserAvatar ?? "",
          isGroup: isGroup ? "true" : "false",
          participantCount: room.participantCount?.toString() || "0",
          groupPhoto: room.groupPhoto || "",
        },
      });
    },
    [showOptionsModal, router, isRoomUnread, markRoomAsRead],
  );

  /**
   * Handles starting a new direct chat with a selected user.
   * Navigates directly to ChatScreen with the target user's info.
   */
  const handleStartNewChat = useCallback(
    (userId: string, userName: string, userAvatar?: string) => {
      setShowNewChatModal(false);

      const currentUserId = user?.id;
      if (!currentUserId) return;

      const roomId = getDirectRoomId(currentUserId, userId);

      router.push({
        pathname: "/screens/ChatScreen",
        params: {
          roomId: roomId,
          otherUserName: userName,
          otherUserId: userId,
          otherUserAvatar: userAvatar ?? "",
          isGroup: "false",
        },
      });
    },
    [router, user?.id],
  );

  /**
   * Handles group creation success.
   * Navigates to the new group chat screen.
   */
  const handleGroupCreated = useCallback(
    (roomId: string, groupName: string) => {
      setShowCreateGroupModal(false);

      router.push({
        pathname: "/screens/ChatScreen",
        params: {
          roomId: roomId,
          otherUserName: groupName,
          otherUserId: "",
          otherUserAvatar: "",
          isGroup: "true",
          participantCount: "0",
        },
      });

      fetchRooms();
    },
    [router, fetchRooms],
  );

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  /**
   * Renders a single chat row item.
   * Determines unread status, selection state, and passes animation values.
   */
  const renderItem = useCallback(
    ({ item }: { item: ChatRoom }) => {
      const isUnread = isRoomUnread(item);

      return (
        <ChatItem
          item={item}
          isUnread={isUnread}
          currentUserId={user?.id}
          isSelected={selectedRoom?.roomId === item.roomId && showOptionsModal}
          highlightAnim={highlightAnimRef.current}
          isHighlighted={highlightedRoomIdRef.current === item.roomId}
          itemScaleAnim={itemScaleAnim}
          itemTranslateYAnim={itemTranslateYAnim}
          onPress={() => navigateToChat(item)}
          onLongPress={handleLongPress}
        />
      );
    },
    [
      isRoomUnread,
      user?.id,
      selectedRoom,
      showOptionsModal,
      highlightAnimRef,
      highlightedRoomIdRef,
      itemScaleAnim,
      itemTranslateYAnim,
      navigateToChat,
      handleLongPress,
    ],
  );

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  /** Fetch rooms every time the screen gains focus to ensure fresh data */
  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, [fetchRooms]),
  );

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header with New Chat and New Group buttons */}
        <ChatListHeader
          onNewChat={() => setShowNewChatModal(true)}
          onNewGroup={() => setShowCreateGroupModal(true)}
        />

        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.roomId}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.card}
            />
          }
          ListEmptyComponent={<EmptyChatList />}
          contentContainerStyle={
            filteredRooms.length === 0 ? styles.emptyList : undefined
          }
          removeClippedSubviews={Platform.OS === "android"}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
          extraData={{
            rooms: filteredRooms,
            isRoomUnread,
            selectedRoomId: selectedRoom?.roomId,
            showOptionsModal,
          }}
        />
      </View>

      {/* New Direct Chat Modal */}
      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onStartChat={handleStartNewChat}
        currentUserId={user?.id}
        token={token}
      />

      {/* New Group Chat Modal */}
      <CreateGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onGroupCreated={handleGroupCreated}
        token={token}
        currentUserId={user?.id}
      />

      {/* Chat Options Modal (Long Press) */}
      <ChatListOptionsModal
        visible={showOptionsModal}
        onClose={handleCloseModal}
        item={selectedRoom}
        itemLayout={selectedItemLayout}
        isPinned={selectedRoom?.isPinned ?? false}
        isMuted={selectedRoom?.isMuted ?? false}
        isRead={selectedRoom ? !isRoomUnread(selectedRoom) : true}
        onPin={() => pinChat(selectedRoom)}
        onToggleRead={() => toggleRead(selectedRoom)}
        onMute={() => toggleMute(selectedRoom)}
        onDelete={() => deleteChat(selectedRoom, handleCloseModal)}
        currentUserId={user?.id}
      />
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyList: {
    flex: 1,
  },
});
