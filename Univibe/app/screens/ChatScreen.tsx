// app/screens/ChatScreen.tsx (FULLY UPDATED - REAL-TIME AUDIO FIXED)

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Animated,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/contexts/AuthContext";
import { socketService } from "../../lib/services";
import { API_BASE_URL } from "../../constants/ipConstants";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import ChatHeader from "../components/chat/ChatMessage/ChatHeader";
import ChatInput from "../components/chat/ChatMessage/ChatInput";
import ChatAttachmentMenu from "../components/chat/ChatMessage/ChatAttachmentMenu";
import SwipeableChatMessage from "../components/chat/ChatMessage/SwipeableChatMessage";
import ReplyIndicator from "../components/chat/ChatMessage/ReplyIndicator";
import { useMessageScroll } from "../../hooks/useMessageScroll";
import { generateTempId, isTempId } from "../../lib/utils/messageIdGenerator";


const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Message {
  _id: string;
  sender: string | { _id: string; name: string; email?: string };
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read" | "sending";
  type?: "text" | "image" | "audio" | "file";
  mediaUrl?: string;
  mediaSize?: number;
  mediaName?: string;
  duration?: number;
  reactions?: Array<{ userId: string; reaction: string; createdAt: string }>;
  replyTo?: {
    messageId: string;
    message: string;
    senderName: string;
  };
  tempId?: string;
}

interface PendingMessage {
  tempId: string;
  message: string;
  timestamp: number;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  let otherUserId = params.otherUserId as string;
  const otherUserAvatar = params.otherUserAvatar as string;

  const extractOtherUserIdFromRoomId = (
    roomId: string,
    currentUserId: string,
  ): string => {
    if (!roomId || !currentUserId) return "";
    const parts = roomId.split("_");
    if (parts.length >= 3) {
      const userId1 = parts[1];
      const userId2 = parts[2];
      return userId1 === currentUserId ? userId2 : userId1;
    }
    return "";
  };

  if (!otherUserId && roomId && user?.id) {
    otherUserId = extractOtherUserIdFromRoomId(roomId, user.id);
  }

  // State declarations
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{
    _id: string;
    senderName: string;
    message: string;
    senderId?: string;
  } | null>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStoppingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track pending messages with temp IDs
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const pendingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const processedMessageIds = useRef<Set<string>>(new Set());

  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const inputRef = useRef<any>(null);
  const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");

  const {
    highlightedMessageId,
    registerMessagePosition,
    scrollToMessage,
    clearHighlight,
  } = useMessageScroll(flatListRef as React.RefObject<FlatList>);

  const attachmentOptions = [
    {
      id: "photo",
      title: "Photo",
      icon: "images-outline",
      color: "#007AFF",
      bgColor: "#E3F2FD",
      action: "pickImage",
    },
    {
      id: "camera",
      title: "Camera",
      icon: "camera-outline",
      color: "#34C759",
      bgColor: "#E8F5E9",
      action: "takePhoto",
    },
    {
      id: "document",
      title: "Document",
      icon: "document-outline",
      color: "#FF9500",
      bgColor: "#FFF3E0",
      action: "pickDocument",
    },
    {
      id: "location",
      title: "Location",
      icon: "location-outline",
      color: "#FF3B30",
      bgColor: "#FFEBEE",
      action: "shareLocation",
    },
  ];

  const getFullImageUrl = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    if (url.startsWith("/uploads")) return `${API_BASE_URL}${url}`;
    if (url.startsWith("uploads")) return `${API_BASE_URL}/${url}`;
    return `${API_BASE_URL}/uploads/${url}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isValidMessage = useCallback((msg: Message): boolean => {
    if (isTempId(msg._id)) return false;
    if (msg.status === "sending") return false;
    if (msg.type === "audio" && !msg.mediaUrl) return false;
    if (!msg._id) return false;
    return true;
  }, []);

  const filterInvalidMessages = useCallback(
    (msgs: Message[]): Message[] => {
      return msgs.filter(isValidMessage);
    },
    [isValidMessage],
  );

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.error);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      pendingTimeoutsRef.current.clear();
      pendingMessagesRef.current.clear();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
      return () => {
        pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        pendingTimeoutsRef.current.clear();
        setReplyToMessage(null);
        clearHighlight();
      };
    }, []),
  );

  useEffect(() => {
    const checkConnection = () =>
      setSocketConnected(socketService.getConnectionStatus());
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Setup chat room and socket listeners
  useEffect(() => {
    if (!roomId) return;
    socketService.joinRoom(roomId, otherUserId);
    loadMessages(true);

    // Handle message delivered event with tempId mapping
    socketService.on("message_delivered", (data: any) => {
      console.log("✅ Message delivered event:", data);

      const { tempId, messageId, message: messageData, success } = data;

      if (success === false) {
        console.log("❌ Message delivery failed:", data.error);
        if (tempId && pendingMessagesRef.current.has(tempId)) {
          pendingMessagesRef.current.delete(tempId);
          const timeout = pendingTimeoutsRef.current.get(tempId);
          if (timeout) {
            clearTimeout(timeout);
            pendingTimeoutsRef.current.delete(tempId);
          }
          setMessages((prev) =>
            prev.filter((msg) => msg.tempId !== tempId && msg._id !== tempId),
          );
          Alert.alert("Error", data.error || "Failed to send message");
        }
        return;
      }

      if (tempId && pendingMessagesRef.current.has(tempId)) {
        console.log(
          `🔄 Replacing temp message ${tempId} with real message ${messageId}`,
        );

        pendingMessagesRef.current.delete(tempId);
        const timeout = pendingTimeoutsRef.current.get(tempId);
        if (timeout) {
          clearTimeout(timeout);
          pendingTimeoutsRef.current.delete(tempId);
        }

        setMessages((prev) => {
          const tempIndex = prev.findIndex(
            (msg) => msg.tempId === tempId || msg._id === tempId,
          );
          if (tempIndex !== -1) {
            const newMessages = [...prev];
            const realMessage: Message = {
              ...(messageData || {}),
              _id: messageId,
              status: "sent",
            };
            newMessages[tempIndex] = realMessage;
            processedMessageIds.current.add(messageId);
            return newMessages;
          }
          return prev;
        });
      }
    });

    // Handle incoming messages from others (TEXT, AUDIO, etc.)
    socketService.on("receive_message", (message: Message) => {
      console.log("📨 Received message:", message._id, "Type:", message.type);

      if (message.roomId === roomId && isMountedRef.current) {
        if (!isValidMessage(message)) return;
        if (processedMessageIds.current.has(message._id)) return;

        processedMessageIds.current.add(message._id);

        setMessages((prev) => {
          const exists = prev.some((msg) => msg._id === message._id);
          if (exists) return prev;
          console.log("📝 Adding new message to list:", message.type);
          return [...prev, { ...message, status: "sent" }];
        });

        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      }
    });

    socketService.on("user_online", () => setIsOnline(true));
    socketService.on("user_offline", () => setIsOnline(false));

    return () => {
      socketService.off("message_delivered", () => {});
      socketService.off("receive_message", () => {});
      socketService.off("user_online", () => {});
      socketService.off("user_offline", () => {});
    };
  }, [roomId]);

  const loadMessages = async (forceRefresh: boolean = false) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${roomId}?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (data.success && isMountedRef.current) {
        const serverMessages = data.data.messages || [];
        const cleanMessages = filterInvalidMessages(serverMessages);

        processedMessageIds.current.clear();
        cleanMessages.forEach((msg) =>
          processedMessageIds.current.add(msg._id),
        );

        // Get pending messages that haven't been confirmed yet
        const pendingMessagesList = Array.from(
          pendingMessagesRef.current.values(),
        );

        const pendingMessages: Message[] = pendingMessagesList.map(
          (pending) => ({
            _id: pending.tempId,
            tempId: pending.tempId,
            sender: user?.id || "",
            senderName: user?.name || "You",
            message:
              pending.type === "audio" ? "🎤 Voice message" : pending.message,
            roomId: roomId,
            createdAt: new Date(pending.timestamp).toISOString(),
            status: "sending" as const,
            type: pending.type as "text" | "audio" | "image" | "file",
            mediaUrl: pending.mediaUrl,
            duration: pending.duration,
          }),
        );

        const finalMessages = [
          ...cleanMessages.filter((msg) => !isTempId(msg._id)),
          ...pendingMessages,
        ];

        finalMessages.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        setMessages(finalMessages);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };
  const handleReply = useCallback((message: Message) => {
    if (isTempId(message._id) || message.status === "sending") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const senderId =
      typeof message.sender === "string"
        ? message.sender
        : message.sender?._id || "";

    setReplyToMessage({
      _id: message._id,
      senderName: message.senderName,
      message: message.message,
      senderId: senderId,
    });

    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
    clearHighlight();
  }, [clearHighlight]);

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      scrollToMessage(messageId);
    },
    [scrollToMessage],
  );

  // Send message function with tempId tracking
  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    if (!socketConnected) {
      Alert.alert("Error", "Not connected to chat server");
      return;
    }

    const tempId = generateTempId();
    const currentReplyTo = replyToMessage;

    const tempMessage: Message = {
      _id: tempId,
      tempId: tempId,
      sender: user?.id || "",
      senderName: user?.name || "You",
      message: text,
      roomId: roomId,
      createdAt: new Date().toISOString(),
      status: "sending",
      type: "text",
      replyTo: currentReplyTo
        ? {
            messageId: currentReplyTo._id,
            message: currentReplyTo.message.substring(0, 100),
            senderName: currentReplyTo.senderName,
          }
        : undefined,
    };

    // Track pending message
    pendingMessagesRef.current.set(tempId, {
      tempId,
      message: text,
      timestamp: Date.now(),
      type: "text",
    });

    setMessages((prev) => [...prev, tempMessage]);
    flatListRef.current?.scrollToEnd();

    setReplyToMessage(null);
    setInputText("");

    console.log("📤 Sending text message with tempId:", tempId);

    // Send message via socket with tempId
    socketService.emit("send_message", {
      roomId,
      message: text,
      type: "text",
      replyTo: currentReplyTo
        ? {
            messageId: currentReplyTo._id,
            message: currentReplyTo.message.substring(0, 100),
            senderName: currentReplyTo.senderName,
          }
        : undefined,
      tempId,
    });

    // Timeout fallback
    const timeout = setTimeout(() => {
      console.log("⚠️ Timeout - removing pending message:", tempId);
      if (pendingMessagesRef.current.has(tempId)) {
        pendingMessagesRef.current.delete(tempId);
        setMessages((prev) =>
          prev.filter((msg) => msg.tempId !== tempId && msg._id !== tempId),
        );
        Alert.alert("Error", "Message failed to send. Please try again.");
      }
      pendingTimeoutsRef.current.delete(tempId);
    }, 10000);

    pendingTimeoutsRef.current.set(tempId, timeout);
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (e) {}
        setRecording(null);
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Please grant microphone permission");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Failed to start recording");
      setIsRecording(false);
      setRecording(null);
    }
  };

  const stopRecording = async (shouldSend: boolean = true) => {
    if (!recording || isStoppingRef.current) {
      setIsRecording(false);
      return;
    }

    isStoppingRef.current = true;
    const currentRecording = recording;
    const currentDuration = recordingDuration;

    setRecording(null);
    setIsRecording(false);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingDuration(0);

    try {
      await currentRecording.stopAndUnloadAsync();
      if (shouldSend && currentDuration > 0) {
        const uri = currentRecording.getURI();
        if (uri && currentDuration >= 1) {
          await uploadAndSendAudio(uri, currentDuration);
        } else if (currentDuration < 1) {
          Alert.alert(
            "Info",
            "Recording too short. Please record at least 1 second.",
          );
        }
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      if (shouldSend) Alert.alert("Error", "Failed to save recording");
    } finally {
      isStoppingRef.current = false;
    }
  };

  const cancelRecording = async () => {
    await stopRecording(false);
  };

  const uploadAndSendAudio = async (uri: string, duration: number) => {
    const tempId = generateTempId();
    const currentReplyTo = replyToMessage;

    const tempMessage: Message = {
      _id: tempId,
      tempId: tempId,
      sender: user?.id || "",
      senderName: user?.name || "You",
      message: "🎤 Voice message",
      roomId: roomId,
      createdAt: new Date().toISOString(),
      status: "sending",
      type: "audio",
      mediaUrl: undefined,
      duration: duration,
      replyTo: currentReplyTo
        ? {
            messageId: currentReplyTo._id,
            message: currentReplyTo.message.substring(0, 100),
            senderName: currentReplyTo.senderName,
          }
        : undefined,
    };

    // Track pending audio message
    pendingMessagesRef.current.set(tempId, {
      tempId,
      message: "🎤 Voice message",
      timestamp: Date.now(),
      type: "audio",
      duration: duration,
    });

    setMessages((prev) => [...prev, tempMessage]);
    flatListRef.current?.scrollToEnd();
    setUploading(true);
    setReplyToMessage(null);

    try {
      const formData = new FormData();
      const filename = `voice_${Date.now()}.m4a`;

      formData.append("audio", {
        uri,
        name: filename,
        type: "audio/m4a",
      } as any);
      formData.append("roomId", roomId);
      formData.append("duration", duration.toString());
      formData.append("tempId", tempId);

      if (currentReplyTo) {
        formData.append("replyToId", currentReplyTo._id);
        formData.append(
          "replyToMessage",
          currentReplyTo.message.substring(0, 100),
        );
        formData.append("replyToSender", currentReplyTo.senderName);
      }

      console.log("📤 Uploading audio message...");
      const response = await fetch(`${API_BASE_URL}/api/chat/upload-audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (data.success && isMountedRef.current) {
        console.log("✅ Audio uploaded successfully:", data.url);

        // Update pending message with media URL
        const pending = pendingMessagesRef.current.get(tempId);
        if (pending) {
          pending.mediaUrl = data.url;
          pendingMessagesRef.current.set(tempId, pending);
        }

        // CRITICAL: Emit socket event for real-time audio delivery
        socketService.emit("send_message", {
          roomId: roomId,
          message: "🎤 Voice message",
          type: "audio",
          replyTo: currentReplyTo
            ? {
                messageId: currentReplyTo._id,
                message: currentReplyTo.message.substring(0, 100),
                senderName: currentReplyTo.senderName,
              }
            : undefined,
          mediaUrl: data.url,
          duration: duration,
          tempId: tempId,
        });

        // Don't remove temp message here - wait for message_delivered event
        // The message_delivered event will replace the temp message
        console.log("📡 Audio socket event emitted with tempId:", tempId);
      } else if (isMountedRef.current) {
        console.error("❌ Audio upload failed:", data.message);
        pendingMessagesRef.current.delete(tempId);
        setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
        Alert.alert("Error", data.message || "Failed to send voice message");
      }
    } catch (error) {
      console.error("Upload error:", error);
      if (isMountedRef.current) {
        pendingMessagesRef.current.delete(tempId);
        setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
        Alert.alert("Error", "Failed to send voice message");
      }
    } finally {
      if (isMountedRef.current) setUploading(false);
    }
  };

  const markAudioAsPlayed = async (messageId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/chat/audio/${messageId}/played`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {}
  };

  const handleReaction = async (
    messageId: string,
    reaction: string,
    shouldRemove?: boolean,
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/message/${messageId}/react`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reaction, remove: shouldRemove || false }),
        },
      );

      const data = await response.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, reactions: data.reactions } : msg,
          ),
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update reaction");
    }
  };

  const handleDelete = async (messageId: string) => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/api/chat/message/${messageId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              const data = await response.json();
              if (data.success) {
                setMessages((prev) =>
                  prev.filter((msg) => msg._id !== messageId),
                );
                socketService.emit("delete_message", { messageId, roomId });
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete message");
            }
          },
        },
      ],
    );
  };

  const handleForward = (message: Message) => {
    Alert.alert("Forward", "Forward feature coming soon!");
  };

  const pickImage = async () => {
    setShowAttachmentMenu(false);
    Alert.alert("Coming Soon", "Image sharing will be available soon!");
  };

  const takePhoto = async () => {
    setShowAttachmentMenu(false);
    Alert.alert("Coming Soon", "Camera will be available soon!");
  };

  const pickDocument = async () => {
    setShowAttachmentMenu(false);
    Alert.alert("Coming Soon", "Document sharing will be available soon!");
  };

  const shareLocation = () => {
    setShowAttachmentMenu(false);
    Alert.alert("Coming Soon", "Location sharing will be available soon!");
  };

  const handleAttachmentAction = async (action: string) => {
    switch (action) {
      case "pickImage":
        await pickImage();
        break;
      case "takePhoto":
        await takePhoto();
        break;
      case "pickDocument":
        await pickDocument();
        break;
      case "shareLocation":
        shareLocation();
        break;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages(true);
  };

  const getSenderId = (message: Message): string =>
    typeof message.sender === "string"
      ? message.sender
      : message.sender?._id || "";

  const isOwnMessage = (message: Message): boolean => {
    if (!user?.id) return false;
    if (message.tempId && pendingMessagesRef.current.has(message.tempId))
      return true;
    if (isTempId(message._id)) return true;
    const senderId = getSenderId(message);
    return senderId.toString() === user.id.toString();
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const ownMessage = isOwnMessage(item);
    const showAvatar =
      !ownMessage &&
      (index === 0 || getSenderId(messages[index - 1]) !== getSenderId(item));
    const showTime =
      index === messages.length - 1 ||
      getSenderId(messages[index + 1]) !== getSenderId(item);

    return (
      <View
        onLayout={(event) => {
          const layout = event.nativeEvent.layout;
          registerMessagePosition(item._id, layout.y);
        }}
      >
        <SwipeableChatMessage
          message={item}
          isOwnMessage={ownMessage}
          showAvatar={showAvatar}
          showTime={showTime}
          formatTime={formatTime}
          getFullImageUrl={getFullImageUrl}
          DEFAULT_AVATAR={DEFAULT_AVATAR}
          onAudioPlayed={markAudioAsPlayed}
          onReaction={handleReaction}
          onReply={handleReply}
          onDelete={handleDelete}
          onForward={handleForward}
          currentUserId={user?.id}
          highlightedMessageId={highlightedMessageId || undefined}
          onScrollToMessage={handleScrollToMessage}
        />
      </View>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
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
        style={{ flex: 1, backgroundColor: "#f8f9fa" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16 }}
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 80,
              }}
            >
              <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: "#333",
                  marginBottom: 10,
                  fontFamily: "SofiaSans-Bold",
                }}
              >
                No messages yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#999",
                  textAlign: "center",
                  fontFamily: "SofiaSans-Regular",
                }}
              >
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
          onSendMessage={sendMessage}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          uploading={uploading}
          socketConnected={socketConnected}
        />
      </KeyboardAvoidingView>

      <ChatAttachmentMenu
        visible={showAttachmentMenu}
        slideAnim={slideAnim}
        attachmentOptions={attachmentOptions}
        onSelectAction={handleAttachmentAction}
        onClose={() => setShowAttachmentMenu(false)}
      />
    </SafeAreaView>
  );
}
