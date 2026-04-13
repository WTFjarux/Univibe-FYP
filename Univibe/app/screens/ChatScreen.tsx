// app/screens/ChatScreen.tsx - COMPLETELY FIXED with robust message filtering
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
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/contexts/AuthContext";
import { socketService } from "../../lib/services";
import { API_BASE_URL } from "../../constants/ipConstants";
import { profileService } from "../../lib/services/profileService";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import {
  ChatHeader,
  ChatMessage,
  ChatInput,
  ChatAttachmentMenu,
} from "../components/chat";

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
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  let otherUserId = params.otherUserId as string;
  const otherUserAvatar = params.otherUserAvatar as string;

  // Helper functions
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
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStoppingRef = useRef(false);
  const isMountedRef = useRef(true);
  const tempMessagesRef = useRef<Set<string>>(new Set());
  const processedMessageIds = useRef<Set<string>>(new Set());

  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");

  // Attachment options
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

  // Helper functions
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

  // CRITICAL: Validate if a message is valid (not a ghost message)
  const isValidMessage = useCallback((msg: Message): boolean => {
    // Never allow temp messages
    if (msg._id?.startsWith("temp_")) return false;

    // Never allow sending status messages
    if (msg.status === "sending") return false;

    // For audio messages, must have valid mediaUrl
    if (msg.type === "audio" && !msg.mediaUrl) return false;

    // Must have valid ID
    if (!msg._id) return false;

    return true;
  }, []);

  // Filter out ALL invalid messages
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
    };
  }, []);

  // Clear invalid messages when screen loses focus
  useFocusEffect(
    useCallback(() => {
      // When screen comes into focus, load fresh messages
      loadMessages(true);

      return () => {
        // CRITICAL: Clear ALL invalid messages when leaving the screen
        setMessages((prev) => filterInvalidMessages(prev));
        tempMessagesRef.current.clear();
        processedMessageIds.current.clear();
      };
    }, []),
  );

  // Monitor socket connection
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

    socketService.on("receive_message", (message: Message) => {
      if (message.roomId === roomId && isMountedRef.current) {
        // Skip invalid messages
        if (!isValidMessage(message)) return;

        // Prevent duplicate processing
        if (processedMessageIds.current.has(message._id)) return;
        processedMessageIds.current.add(message._id);

        setMessages((prev) => {
          const exists = prev.some((msg) => msg._id === message._id);
          if (exists) {
            return prev.map((msg) => (msg._id === message._id ? message : msg));
          }
          return [...prev, message];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      }
    });

    socketService.on("user_online", () => setIsOnline(true));
    socketService.on("user_offline", () => setIsOnline(false));

    return () => {
      socketService.off("receive_message", () => {});
      socketService.off("user_online", () => {});
      socketService.off("user_offline", () => {});
      processedMessageIds.current.clear();
    };
  }, [roomId]);

  const loadMessages = async (forceRefresh: boolean = false) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${roomId}?limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (data.success && isMountedRef.current) {
        const serverMessages = data.data.messages || [];

        // CRITICAL: Filter out ALL invalid messages from server
        const cleanMessages = filterInvalidMessages(serverMessages);

        // Update processed IDs set
        cleanMessages.forEach((msg) => {
          processedMessageIds.current.add(msg._id);
        });

        setMessages(cleanMessages);
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

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    if (!socketConnected) {
      Alert.alert("Error", "Not connected to chat server");
      return;
    }

    const tempMessage: Message = {
      _id: `temp_${Date.now()}`,
      sender: user?.id || "",
      senderName: user?.name || "You",
      message: text,
      roomId: roomId,
      createdAt: new Date().toISOString(),
      status: "sent",
      type: "text",
      replyTo: replyToMessage
        ? {
            messageId: replyToMessage._id,
            message: replyToMessage.message.substring(0, 100),
            senderName: replyToMessage.senderName,
          }
        : undefined,
    };

    tempMessagesRef.current.add(tempMessage._id);
    setMessages((prev) => [...prev, tempMessage]);
    flatListRef.current?.scrollToEnd();
    socketService.sendMessage(roomId, text);
    setReplyToMessage(null);

    // Remove temp message after 5 seconds (fallback cleanup)
    setTimeout(() => {
      if (tempMessagesRef.current.has(tempMessage._id)) {
        setMessages((prev) =>
          prev.filter((msg) => msg._id !== tempMessage._id),
        );
        tempMessagesRef.current.delete(tempMessage._id);
      }
    }, 5000);
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (e) {
          // Ignore
        }
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

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

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
      } else {
        console.log("Recording discarded by user");
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      if (shouldSend) {
        Alert.alert("Error", "Failed to save recording");
      }
    } finally {
      isStoppingRef.current = false;
    }
  };

  const cancelRecording = async () => {
    await stopRecording(false);
  };

  const uploadAndSendAudio = async (uri: string, duration: number) => {
    // Create a temporary loading message immediately
    const tempMessageId = `temp_audio_${Date.now()}`;
    const tempMessage: Message = {
      _id: tempMessageId,
      sender: user?.id || "",
      senderName: user?.name || "You",
      message: "🎤 Voice message",
      roomId: roomId,
      createdAt: new Date().toISOString(),
      status: "sending",
      type: "audio",
      mediaUrl: undefined,
      duration: duration,
    };

    tempMessagesRef.current.add(tempMessageId);
    setMessages((prev) => [...prev, tempMessage]);
    flatListRef.current?.scrollToEnd();

    setUploading(true);

    try {
      const formData = new FormData();
      const filename = `voice_${Date.now()}.m4a`;

      formData.append("audio", {
        uri: uri,
        name: filename,
        type: "audio/m4a",
      } as any);
      formData.append("roomId", roomId);
      formData.append("duration", duration.toString());

      const response = await fetch(`${API_BASE_URL}/api/chat/upload-audio`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success && isMountedRef.current) {
        const finalMessage: Message = {
          _id: data.data._id,
          sender: user?.id || "",
          senderName: user?.name || "You",
          message: "🎤 Voice message",
          roomId: roomId,
          createdAt: new Date().toISOString(),
          status: "sent",
          type: "audio",
          mediaUrl: data.url,
          duration: duration,
        };

        // Replace loading message with actual message
        setMessages((prev) =>
          prev.map((msg) => (msg._id === tempMessageId ? finalMessage : msg)),
        );
        tempMessagesRef.current.delete(tempMessageId);
        processedMessageIds.current.add(finalMessage._id);

        // Send via socket
        socketService.sendMessage(roomId, "🎤 Voice message", "audio");
      } else if (isMountedRef.current) {
        // Remove loading message and show error
        setMessages((prev) => prev.filter((msg) => msg._id !== tempMessageId));
        tempMessagesRef.current.delete(tempMessageId);
        Alert.alert("Error", data.message || "Failed to send voice message");
      }
    } catch (error) {
      console.error("Upload error:", error);
      if (isMountedRef.current) {
        setMessages((prev) => prev.filter((msg) => msg._id !== tempMessageId));
        tempMessagesRef.current.delete(tempMessageId);
        Alert.alert("Error", "Failed to send voice message");
      }
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  };

  const markAudioAsPlayed = async (messageId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/chat/audio/${messageId}/played`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      // Silent fail
    }
  };

  // Message actions
  const handleReaction = async (messageId: string, reaction: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/message/${messageId}/react`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reaction }),
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
      Alert.alert("Error", "Failed to add reaction");
    }
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
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
                // Update local messages
                setMessages((prev) =>
                  prev.filter((msg) => msg._id !== messageId),
                );

                // Emit socket event for message deletion using the new emit method
                socketService.emit("delete_message", {
                  messageId,
                  roomId,
                });
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

  const cancelReply = () => {
    setReplyToMessage(null);
  };

  // Media upload functions
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
    const senderId = getSenderId(message);
    if (message._id?.startsWith("temp_")) return true;
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
      <ChatMessage
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

      {/* Reply Indicator */}
      {replyToMessage && (
        <View style={styles.replyIndicator}>
          <View style={styles.replyContent}>
            <View style={styles.replyBar} />
            <View style={styles.replyTextContainer}>
              <Text style={styles.replyLabel}>
                Replying to {replyToMessage.senderName}
              </Text>
              <Text style={styles.replyMessage} numberOfLines={1}>
                {replyToMessage.message}
              </Text>
            </View>
            <TouchableOpacity onPress={cancelReply} style={styles.replyCancel}>
              <Ionicons name="close" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#f8f9fa" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? -18 : 0}
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

        <ChatInput
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

const styles = StyleSheet.create({
  replyIndicator: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e5ea",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyBar: {
    width: 4,
    height: 40,
    backgroundColor: "#007AFF",
    borderRadius: 2,
    marginRight: 12,
  },
  replyTextContainer: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    color: "#007AFF",
    fontFamily: "SofiaSans-Regular",
    marginBottom: 2,
  },
  replyMessage: {
    fontSize: 14,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  replyCancel: {
    padding: 8,
  },
});
