// lib/ChatContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { View, Text } from "react-native";
import socketService from "../services/socketService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define types
interface Message {
  _id?: string;
  messageId?: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: string;
  status?: string;
  createdAt?: Date;
}

interface TypingData {
  userId: string;
  userName: string;
  roomId: string;
}

interface UserStatusData {
  userId: string;
  userInfo?: any;
  lastSeen?: Date;
}

interface ChatContextType {
  isConnected: boolean;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, Record<string, boolean>>;
  onlineUsers: Set<string>;
  currentRoom: string | null;
  loading: boolean;
  joinChatRoom: (roomId: string, otherUserId?: string | null) => void;
  sendMessage: (roomId: string, text: string) => void;
  sendTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  getMessageHistory: (
    roomId: string,
    limit?: number,
    before?: string | null,
  ) => void;
}

interface ChatProviderProps {
  children: ReactNode;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [typingUsers, setTypingUsers] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    initializeSocket();

    return () => {
      socketService.disconnect();
    };
  }, []);

  const initializeSocket = async (): Promise<void> => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      await socketService.connect();
      setupSocketListeners();
    }
  };

  const setupSocketListeners = (): void => {
    socketService.on("socket_connected", () => {
      setIsConnected(true);
    });

    socketService.on("socket_disconnected", () => {
      setIsConnected(false);
    });

    socketService.on("new_message", (message: Message) => {
      // Add message to state
      setMessages((prev) => ({
        ...prev,
        [message.roomId]: [...(prev[message.roomId] || []), message],
      }));
    });

    socketService.on("message_delivered", (message: Message) => {
      // Update message status
      if (message.messageId) {
        updateMessageStatus(message.messageId, "delivered");
      }
    });

    socketService.on("user_typing", (data: TypingData) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.roomId]: {
          ...prev[data.roomId],
          [data.userId]: true,
        },
      }));

      // Auto clear typing after 3 seconds
      setTimeout(() => {
        setTypingUsers((prev) => ({
          ...prev,
          [data.roomId]: {
            ...prev[data.roomId],
            [data.userId]: false,
          },
        }));
      }, 3000);
    });

    socketService.on("user_stop_typing", (data: TypingData) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.roomId]: {
          ...prev[data.roomId],
          [data.userId]: false,
        },
      }));
    });

    socketService.on("user_online", (data: UserStatusData) => {
      setOnlineUsers((prev) => new Set([...prev, data.userId]));
    });

    socketService.on("user_offline", (data: UserStatusData) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });
  };

  const updateMessageStatus = (messageId: string, status: string): void => {
    // Update message status in state
    Object.keys(messages).forEach((roomId) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: prev[roomId].map((msg: Message) =>
          msg.messageId === messageId ? { ...msg, status } : msg,
        ),
      }));
    });
  };

  const joinChatRoom = (
    roomId: string,
    otherUserId: string | null = null,
  ): void => {
    setCurrentRoom(roomId);
    socketService.joinRoom(roomId, otherUserId);
    socketService.getMessageHistory(roomId);
  };

  const sendMessage = (roomId: string, text: string): void => {
    if (text.trim()) {
      socketService.sendMessage(roomId, text);
    }
  };

  const sendTyping = (roomId: string): void => {
    socketService.sendTyping(roomId);
  };

  const stopTyping = (roomId: string): void => {
    socketService.stopTyping(roomId);
  };

  const value: ChatContextType = {
    isConnected,
    messages,
    typingUsers,
    onlineUsers,
    currentRoom,
    loading,
    joinChatRoom,
    sendMessage,
    sendTyping,
    stopTyping,
    getMessageHistory: socketService.getMessageHistory.bind(socketService),
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
