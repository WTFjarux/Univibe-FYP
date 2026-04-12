// app/screens/ChatScreen.tsx
/**
 * Chat Screen
 *
 * Real-time messaging interface with support for text, images, and voice messages.
 * Features:
 * - Real-time message sending and receiving
 * - Typing indicators
 * - Online/offline status
 * - iMessage-style square attachment menu
 * - Voice message recording
 * - Message bubbles with sender avatars
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/contexts/AuthContext";
import { socketService } from "../../lib/services";
import { API_BASE_URL } from "../../constants/ipConstants";
import { profileService } from "../../lib/services/profileService";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Message {
  _id: string;
  sender: string | { _id: string; name: string; email?: string };
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read";
  type?: "text" | "image" | "audio" | "file";
  mediaUrl?: string;
  mediaSize?: number;
  mediaName?: string;
  duration?: number;
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  // Get chat parameters from navigation
  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  let otherUserId = params.otherUserId as string;

  // Extract other user ID from room ID if not provided directly
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

  // Auto-extract other user ID if needed
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
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");

  // Attachment menu options
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

  // Animate attachment menu
  useEffect(() => {
    if (showAttachmentMenu) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: -SCREEN_WIDTH,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [showAttachmentMenu]);

  // Fetch other user's profile to get avatar
  useEffect(() => {
    const fetchOtherUserProfile = async () => {
      if (!otherUserId) {
        setFetchingProfile(false);
        return;
      }

      try {
        setFetchingProfile(true);
        const response = await profileService.getPublicProfile(otherUserId);

        if (response.success && response.profile) {
          setOtherUserProfile(response);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setFetchingProfile(false);
      }
    };

    fetchOtherUserProfile();
  }, [otherUserId]);

  // Fallback: Get avatar from messages if profile fetch failed
  useEffect(() => {
    if (otherUserProfile?.profile?.profilePicture || messages.length === 0)
      return;

    const otherUserMessage = messages.find((msg) => {
      const senderId =
        typeof msg.sender === "string" ? msg.sender : msg.sender?._id;
      return (
        senderId?.toString() === otherUserId?.toString() && msg.senderAvatar
      );
    });

    if (otherUserMessage?.senderAvatar) {
      setOtherUserProfile({
        profile: {
          profilePicture: otherUserMessage.senderAvatar,
        },
      });
    }
  }, [messages, otherUserId]);

  // Get full avatar URL
  const getOtherUserAvatar = (): string => {
    let pictureUrl = null;

    if (otherUserProfile?.profile?.profilePicture) {
      pictureUrl = otherUserProfile.profile.profilePicture;
    } else if (otherUserProfile?.profilePicture) {
      pictureUrl = otherUserProfile.profilePicture;
    }

    return pictureUrl ? profileService.getFullImageUrl(pictureUrl) : "";
  };

  // Monitor socket connection status
  useEffect(() => {
    const checkConnection = () => {
      setSocketConnected(socketService.getConnectionStatus());
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Setup chat room and socket listeners
  useEffect(() => {
    if (!roomId) return;

    socketService.joinRoom(roomId, otherUserId);
    loadMessages();

    // Handle incoming messages
    socketService.on("receive_message", (message: Message) => {
      if (message.roomId === roomId) {
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

    // Handle user online/offline status
    socketService.on("user_online", () => setIsOnline(true));
    socketService.on("user_offline", () => setIsOnline(false));

    return () => {
      socketService.off("receive_message", () => {});
      socketService.off("user_online", () => {});
      socketService.off("user_offline", () => {});
    };
  }, [roomId]);

  // Load message history from API
  const loadMessages = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${roomId}?limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (data.success) {
        setMessages(data.data.messages || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Send a new text message
  const sendMessage = () => {
    if (!inputText.trim()) return;
    if (!socketConnected) {
      Alert.alert("Error", "Not connected to chat server");
      return;
    }

    // Create temporary message for instant display
    const tempMessage: Message = {
      _id: `temp_${Date.now()}`,
      sender: user?.id || "",
      senderName: user?.name || "You",
      message: inputText,
      roomId: roomId,
      createdAt: new Date().toISOString(),
      status: "sent",
      type: "text",
    };

    // Add to UI immediately
    setMessages((prev) => [...prev, tempMessage]);
    flatListRef.current?.scrollToEnd();

    // Send actual message via socket
    socketService.sendMessage(roomId, inputText);
    setInputText("");
    setShowAttachmentMenu(false);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
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

      // Clear any existing timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      await uploadAndSendVoice(uri);
    }
    setRecordingDuration(0);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Upload and send voice message
  const uploadAndSendVoice = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: uri,
        name: `voice_${Date.now()}.m4a`,
        type: "audio/m4a",
      } as any);
      formData.append("roomId", roomId);
      formData.append("type", "audio");

      const response = await fetch(`${API_BASE_URL}/api/chat/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        const tempMessage: Message = {
          _id: `temp_${Date.now()}`,
          sender: user?.id || "",
          senderName: user?.name || "You",
          message: `🎤 Voice message (${formatDuration(recordingDuration)})`,
          roomId: roomId,
          createdAt: new Date().toISOString(),
          status: "sent",
          type: "audio",
          mediaUrl: data.url,
          duration: recordingDuration,
        };
        setMessages((prev) => [...prev, tempMessage]);
        flatListRef.current?.scrollToEnd();

        socketService.sendMessage(roomId, tempMessage.message, "audio");
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to send voice message");
    } finally {
      setUploading(false);
    }
  };

  // Pick image from library
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant permission to access photos",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setShowAttachmentMenu(false);
      await uploadAndSendMedia(result.assets[0].uri, "image");
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant permission to use camera");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setShowAttachmentMenu(false);
      await uploadAndSendMedia(result.assets[0].uri, "image");
    }
  };

  // Pick document
  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/msword", "text/plain"],
    });

    if (result.assets && result.assets[0]) {
      setShowAttachmentMenu(false);
      await uploadAndSendMedia(
        result.assets[0].uri,
        "file",
        result.assets[0].name,
      );
    }
  };

  // Share location
  const shareLocation = () => {
    setShowAttachmentMenu(false);
    Alert.alert("Coming Soon", "Location sharing will be available soon!");
  };

  // Upload and send media
  const uploadAndSendMedia = async (
    uri: string,
    type: string,
    name?: string,
  ) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename =
        name || uri.split("/").pop() || `media_${Date.now()}.jpg`;

      formData.append("file", {
        uri: uri,
        name: filename,
        type: type === "image" ? "image/jpeg" : "application/octet-stream",
      } as any);
      formData.append("roomId", roomId);
      formData.append("type", type);

      const response = await fetch(`${API_BASE_URL}/api/chat/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        const tempMessage: Message = {
          _id: `temp_${Date.now()}`,
          sender: user?.id || "",
          senderName: user?.name || "You",
          message: type === "image" ? "📷 Photo" : `📎 ${name || "File"}`,
          roomId: roomId,
          createdAt: new Date().toISOString(),
          status: "sent",
          type: type as any,
          mediaUrl: data.url,
          mediaName: name,
        };
        setMessages((prev) => [...prev, tempMessage]);
        flatListRef.current?.scrollToEnd();

        socketService.sendMessage(roomId, tempMessage.message, type);
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to send media");
    } finally {
      setUploading(false);
    }
  };

  // Handle attachment selection
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
      default:
        break;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  // Helper to get sender ID from message object
  const getSenderId = (message: Message): string => {
    if (typeof message.sender === "string") return message.sender;
    return message.sender?._id || "";
  };

  // Check if message is from current user
  const isOwnMessage = (message: Message): boolean => {
    if (!user?.id) return false;
    const senderId = getSenderId(message);
    if (message._id?.startsWith("temp_")) return true;
    return senderId.toString() === user.id.toString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Render individual message bubble
  const renderMessage = ({ item }: { item: Message }) => {
    const ownMessage = isOwnMessage(item);
    const avatarUrl = item.senderAvatar
      ? profileService.getFullImageUrl(item.senderAvatar)
      : "";

    return (
      <View
        style={[
          styles.messageRow,
          ownMessage ? styles.ownMessageRow : styles.otherMessageRow,
        ]}
      >
        {/* Avatar for other user's messages */}
        {!ownMessage && (
          <View style={styles.avatarContainer}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR}
              style={styles.avatar}
            />
          </View>
        )}

        {/* Spacer for alignment of own messages */}
        {ownMessage && <View style={styles.avatarSpacer} />}

        {/* Message bubble */}
        <View
          style={[
            styles.bubbleWrapper,
            ownMessage ? styles.ownBubbleWrapper : styles.otherBubbleWrapper,
          ]}
        >
          <View
            style={[
              styles.bubble,
              ownMessage ? styles.ownBubble : styles.otherBubble,
            ]}
          >
            {item.type === "image" && item.mediaUrl ? (
              <Image
                source={{ uri: item.mediaUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            ) : item.type === "audio" ? (
              <View style={styles.voiceMessageContainer}>
                <Ionicons
                  name="musical-notes"
                  size={20}
                  color={ownMessage ? "#fff" : "#007AFF"}
                />
                <Text
                  style={[
                    styles.voiceMessageText,
                    ownMessage && { color: "#fff" },
                  ]}
                >
                  {item.message}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.messageText,
                  ownMessage ? styles.ownMessageText : styles.otherMessageText,
                ]}
              >
                {item.message}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.timeText,
              ownMessage ? styles.ownTimeText : styles.otherTimeText,
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  // Show loading indicator
  if (loading || fetchingProfile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const headerAvatarUrl = getOtherUserAvatar();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Custom Header */}
      <View style={styles.header}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </TouchableOpacity>

        {/* User info - tappable to view profile */}
        <TouchableOpacity
          style={styles.headerUserInfo}
          onPress={() => router.push(`/profile/${otherUserId}`)}
        >
          <View style={styles.headerAvatar}>
            <Image
              source={
                headerAvatarUrl ? { uri: headerAvatarUrl } : DEFAULT_AVATAR
              }
              style={styles.headerAvatarImage}
            />
            {isOnline && <View style={styles.headerOnlineDot} />}
          </View>
          <View>
            <Text style={styles.headerName}>{otherUserName}</Text>
            <Text style={styles.headerStatus}>
              {isOnline ? "Active now" : "Offline"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Call buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => Alert.alert("Call", "Coming soon")}
          >
            <Ionicons name="call-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => Alert.alert("Video Call", "Coming soon")}
          >
            <Ionicons name="videocam-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? -10 : 0}
      >
        {/* Messages list */}
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
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Send a message to start the conversation
              </Text>
            </View>
          }
        />

        {/* Message input area */}
        <View style={styles.inputArea}>
          {/* Input row */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
            >
              <Ionicons
                name={showAttachmentMenu ? "close-outline" : "add-outline"}
                size={28}
                color="#007AFF"
              />
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message..."
                placeholderTextColor="#999"
                multiline
              />
            </View>

            {/* Voice message button */}
            <TouchableOpacity
              style={styles.voiceButton}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={uploading}
            >
              {isRecording ? (
                <View style={styles.recordingActive}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>
                    {formatDuration(recordingDuration)}
                  </Text>
                </View>
              ) : (
                <Ionicons name="mic-outline" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && !isRecording && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={
                (!inputText.trim() && !isRecording) ||
                !socketConnected ||
                uploading
              }
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* iMessage Style Square Attachment Menu - Slides from left */}
      <Animated.View
        style={[
          styles.attachmentMenuContainer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.attachmentMenuHeader}>
          <Text style={styles.attachmentMenuTitle}>Attachments</Text>
          <TouchableOpacity onPress={() => setShowAttachmentMenu(false)}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        <View style={styles.attachmentMenuGrid}>
          {attachmentOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.attachmentMenuItem}
              onPress={() => handleAttachmentAction(option.action)}
            >
              <View
                style={[
                  styles.attachmentMenuIcon,
                  { backgroundColor: option.bgColor },
                ]}
              >
                <Ionicons
                  name={option.icon as any}
                  size={28}
                  color={option.color}
                />
              </View>
              <Text style={styles.attachmentMenuItemTitle}>{option.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  backButton: {
    padding: 4,
  },
  headerUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  headerAvatar: {
    position: "relative",
    marginRight: 12,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  headerStatus: {
    fontSize: 12,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerAction: {
    padding: 4,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  ownMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  avatarSpacer: {
    width: 40,
  },
  bubbleWrapper: {
    maxWidth: "75%",
  },
  ownBubbleWrapper: {
    alignItems: "flex-end",
  },
  otherBubbleWrapper: {
    alignItems: "flex-start",
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#E5E5EA",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "SofiaSans-Regular",
  },
  ownMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: "#000",
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  voiceMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceMessageText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    marginHorizontal: 4,
    fontFamily: "SofiaSans-Regular",
  },
  ownTimeText: {
    color: "#8E8E93",
  },
  otherTimeText: {
    color: "#8E8E93",
  },
  inputArea: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 25,
    gap: 8,
  },
  attachButton: {
    padding: 6,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  input: {
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#000",
    fontFamily: "SofiaSans-Regular",
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  recordingText: {
    fontSize: 12,
    color: "#FF3B30",
    fontFamily: "SofiaSans-Regular",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
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
  // iMessage Square Attachment Menu
  attachmentMenuContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  attachmentMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  attachmentMenuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  attachmentMenuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  attachmentMenuItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 24,
  },
  attachmentMenuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  attachmentMenuItemTitle: {
    fontSize: 12,
    color: "#666",
    fontFamily: "SofiaSans-Regular",
  },
});
