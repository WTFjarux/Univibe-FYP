// app/screens/ChatScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { socketService } from "../../lib/services";
import { API_BASE_URL } from "../../constants/ipConstants";
import {
  ChatHeader,
  ChatMessage,
  ChatInput,
  ChatTypingIndicator,
  ChatEmptyState,
} from "../components/Chat";

interface Message {
  _id: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read";
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  const otherUserId = params.otherUserId as string;
  const otherUserAvatar = params.otherUserAvatar as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Check socket connection
  useEffect(() => {
    const checkConnection = () => {
      setSocketConnected(socketService.getConnectionStatus());
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Setup chat
  useEffect(() => {
    if (!roomId) return;

    socketService.joinRoom(roomId, otherUserId);
    loadMessages();

    socketService.on("receive_message", handleNewMessage);
    socketService.on("message_delivered", handleMessageDelivered);
    socketService.on("user_typing", () => setOtherUserTyping(true));
    socketService.on("user_stop_typing", () => setOtherUserTyping(false));
    socketService.on("user_online", () => setIsOnline(true));
    socketService.on("user_offline", (data) => {
      setIsOnline(false);
      setLastSeen(data.lastSeen ? new Date(data.lastSeen) : new Date());
    });

    return () => {
      socketService.off("receive_message", handleNewMessage);
      socketService.off("message_delivered", handleMessageDelivered);
      socketService.off("user_typing", () => {});
      socketService.off("user_stop_typing", () => {});
      socketService.off("user_online", () => {});
      socketService.off("user_offline", () => {});
    };
  }, [roomId]);

  const loadMessages = async (showLoading = true) => {
    if (!roomId) return;
    if (showLoading) setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${roomId}?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (data.success) {
        setMessages(data.data.messages);
        setHasMore(data.data.hasMore);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || loading || messages.length === 0) return;

    const oldestMessage = messages[0];
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${roomId}?limit=20&before=${oldestMessage.createdAt}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (data.success && data.data.messages.length > 0) {
        setMessages((prev) => [...data.data.messages.reverse(), ...prev]);
        setHasMore(data.data.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    }
  };

  const handleNewMessage = (message: Message) => {
    if (message.roomId === roomId) {
      setMessages((prev) => [...prev, message]);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    }
  };

  const handleMessageDelivered = (message: Message) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === message._id
          ? { ...msg, status: "delivered" as const }
          : msg,
      ),
    );
  };

  const sendMessage = (text: string) => {
    if (!socketConnected) {
      Alert.alert("Error", "Not connected to chat server");
      return;
    }
    socketService.sendMessage(roomId, text);
  };

  const sendTyping = () => {
    socketService.sendTyping(roomId);
  };

  const stopTyping = () => {
    socketService.stopTyping(roomId);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages(false);
  };

  const handleCall = () => {
    Alert.alert("Call", "Call feature coming soon!");
  };

  const handleVideoCall = () => {
    Alert.alert("Video Call", "Video call feature coming soon!");
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const currentUserId = user?.id?.toString();
    const messageSenderId = item.sender?.toString();
    const isOwnMessage = currentUserId === messageSenderId;

    const showAvatar =
      !isOwnMessage &&
      (index === 0 ||
        messages[index - 1]?.sender?.toString() !== messageSenderId);

    const showTime =
      index === messages.length - 1 ||
      messages[index + 1]?.sender?.toString() !== messageSenderId;

    return (
      <ChatMessage
        message={item}
        isOwnMessage={isOwnMessage}
        showAvatar={showAvatar}
        showTime={showTime}
      />
    );
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ChatHeader
        userName={otherUserName}
        userAvatar={
          otherUserAvatar ? `${API_BASE_URL}${otherUserAvatar}` : undefined
        }
        isOnline={isOnline}
        lastSeen={lastSeen || undefined}
        onCallPress={handleCall}
        onVideoCallPress={handleVideoCall}
        onBackPress={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#f8f9fa" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.1}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
            />
          }
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<ChatEmptyState />}
        />

        {otherUserTyping && <ChatTypingIndicator userName={otherUserName} />}

        <ChatInput
          onSendMessage={sendMessage}
          onTyping={sendTyping}
          onStopTyping={stopTyping}
          isConnected={socketConnected}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
