// app/screens/ChatScreen.tsx

import React, { useRef, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  Text,
  StyleSheet,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useChatScreen } from "../../hooks/chatScreen/useChatScreen";
import ChatHeader from "../components/chat/ChatMessage/ChatHeader";
import ChatInput from "../components/chat/ChatMessage/ChatInput";
import ReplyIndicator from "../components/chat/ChatMessage/ReplyIndicator";
import MessageItem from "../components/chat/ChatMessage/MessageItem";
import DateSeparator from "../components/chat/ChatMessage/DateSeparator";
import {
  formatMessageTime,
  formatDateSeparator,
  isNewDay,
  getTimeDifferenceInMinutes,
  getFullImageUrl,
  getSenderId,
} from "../../lib/utils/chatUtils";
import { isTempId } from "../../lib/utils/messageIdGenerator";
import type { Message } from "../../lib/types/chat.types";

const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");
const MESSAGE_TIME_GAP_MINUTES = 5;

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  const hasLoadedRef = useRef(false);
  const initialScrollDoneRef = useRef(false);

  const {
    messages,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    loadMessages,
    loadOlderMessages,
    socketConnected,
    isOnline,
    uploading,
    replyToMessage,
    highlightedMessageId,
    otherUserName,
    otherUserId,
    otherUserAvatar,
    user,
    clearAllPending,
    clearHighlight,
    cleanupScroll,
    audioCleanup,
    onRefresh,
    handleSendMessage,
    handleReply,
    cancelReply,
    handleReaction,
    handleDelete,
    markAudioAsPlayed,
    handleAttachmentsSelected,
    handleLocationShared,
    handleScrollToMessage,
    registerMessageRef,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
  } = useChatScreen(flatListRef);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadMessages(false);
      hasLoadedRef.current = true;
    }

    return () => {
      clearAllPending();
      clearHighlight();
      cleanupScroll();
      audioCleanup();
    };
  }, []);

  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDoneRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        initialScrollDoneRef.current = true;
      }, 300);
    }
  }, [loading, messages.length]);

  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
    );
    return () => showListener.remove();
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMore) loadOlderMessages();
  }, [hasMore, loadingMore, loadOlderMessages]);

  const isOwnMessage = useCallback(
    (message: Message): boolean => {
      if (!user?.id) return false;
      if (isTempId(message._id) || message.status === "sending") return true;
      return getSenderId(message).toString() === user.id.toString();
    },
    [user?.id],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const ownMessage = isOwnMessage(item);
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const showDateSeparator =
        index === 0 || isNewDay(item.createdAt, messages[index - 1].createdAt);
      const showAvatar =
        !ownMessage &&
        (index === 0 || getSenderId(messages[index - 1]) !== getSenderId(item));
      const showTime =
        index === messages.length - 1 ||
        getTimeDifferenceInMinutes(
          item.createdAt,
          messages[index + 1]?.createdAt || item.createdAt,
        ) > MESSAGE_TIME_GAP_MINUTES ||
        (messages[index + 1] &&
          getSenderId(messages[index + 1]) !== getSenderId(item));

      return (
        <View key={item._id || item.tempId || `msg-${index}`}>
          {showDateSeparator && (
            <DateSeparator date={formatDateSeparator(item.createdAt)} />
          )}
          <MessageItem
            item={item}
            index={index}
            messages={messages}
            isOwnMessage={ownMessage}
            showAvatar={showAvatar}
            showTime={showTime}
            formatTime={formatMessageTime}
            getFullImageUrl={getFullImageUrl}
            DEFAULT_AVATAR={DEFAULT_AVATAR}
            onAudioPlayed={markAudioAsPlayed}
            onReaction={handleReaction}
            onReply={handleReply}
            onDelete={handleDelete}
            onForward={() =>
              Alert.alert("Forward", "Forward feature coming soon!")
            }
            currentUserId={user?.id}
            highlightedMessageId={highlightedMessageId || undefined}
            onScrollToMessage={handleScrollToMessage}
            registerMessageRef={registerMessageRef}
          />
        </View>
      );
    },
    [
      messages,
      user?.id,
      isOwnMessage,
      markAudioAsPlayed,
      handleReaction,
      handleReply,
      handleDelete,
      highlightedMessageId,
      handleScrollToMessage,
      registerMessageRef,
    ],
  );

  const keyExtractor = useCallback((item: Message, index: number) => {
    // ✅ Use _id + tempId combo to guarantee uniqueness
    return item._id || item.tempId || `msg-${index}-${item.createdAt}`;
  }, []);

  const ListHeaderComponent = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }, [loadingMore]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ChatHeader
        otherUserName={otherUserName}
        otherUserId={otherUserId}
        otherUserAvatar={otherUserAvatar}
        isOnline={isOnline}
        DEFAULT_AVATAR={DEFAULT_AVATAR}
        getFullImageUrl={getFullImageUrl}
      />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          removeClippedSubviews={Platform.OS === "android"}
          maxToRenderPerBatch={10}
          windowSize={11}
          initialNumToRender={15}
          ListHeaderComponent={ListHeaderComponent}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            messages.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                Send a message to start the conversation
              </Text>
            </View>
          }
        />
        <ReplyIndicator
          replyToMessage={replyToMessage}
          onCancelReply={cancelReply}
        />
        <ChatInput
          ref={inputRef}
          onSendMessage={handleSendMessage}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          uploading={uploading}
          socketConnected={socketConnected}
          onAttachmentsSelected={handleAttachmentsSelected}
          onLocationShared={handleLocationShared}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  kav: { flex: 1, backgroundColor: "#f8f9fa" },
  listContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },
  emptyList: { flex: 1, paddingHorizontal: 12, paddingVertical: 16 },
  loadingMore: { paddingVertical: 10, alignItems: "center" },
  emptyView: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 10,
    fontFamily: "SofiaSans-Bold",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center" as const,
    fontFamily: "SofiaSans-Regular",
  },
});
