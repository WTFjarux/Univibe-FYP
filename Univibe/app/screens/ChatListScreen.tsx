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
import { useChatList } from "../../hooks/chatList/useChatList";
import { useChatItemAnimations } from "../../hooks/chatList/useChatItemAnimation";
import { ChatListHeader } from "../components/chat/ChatList/ChatListHeader";
import SearchBar from "../components/chat/ChatList/SearchBar";
import EmptyChatList from "../components/chat/ChatList/EmptyChatList";
import NewChatModal from "../components/chat/ChatList/NewChatModal";
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
   */
  const navigateToChat = useCallback(
    (room: ChatRoom) => {
      if (showOptionsModal) return;

      if (isRoomUnread(room)) {
        markRoomAsRead(room.roomId);
      }

      router.push({
        pathname: "/screens/ChatScreen",
        params: {
          roomId: room.roomId,
          otherUserName: room.name,
          otherUserId: room.otherUserId ?? "",
          otherUserAvatar: room.otherUserAvatar ?? "",
        },
      });
    },
    [showOptionsModal, router, isRoomUnread, markRoomAsRead],
  );

  /**
   * Handles starting a new chat with a selected user.
   * Navigates directly to ChatScreen with the target user's info.
   */
  const handleStartNewChat = useCallback(
    (userId: string, userName: string, userAvatar?: string) => {
      setShowNewChatModal(false);

      const currentUserId = user?.id;
      if (!currentUserId) return;

      // Generate proper direct room ID
      const roomId = getDirectRoomId(currentUserId, userId);

      router.push({
        pathname: "/screens/ChatScreen",
        params: {
          roomId: roomId,
          otherUserName: userName,
          otherUserId: userId,
          otherUserAvatar: userAvatar ?? "",
        },
      });
    },
    [router, user?.id],
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>
        <ChatListHeader onNewChat={() => setShowNewChatModal(true)} />
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.roomId}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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

      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onStartChat={handleStartNewChat}
        currentUserId={user?.id}
        token={token}
      />

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
