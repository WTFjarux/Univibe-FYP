// app/components/chat/ChatInput.tsx
import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  isConnected: boolean;
}

export default function ChatInput({
  onSendMessage,
  onTyping,
  onStopTyping,
  isConnected,
}: ChatInputProps) {
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChangeText = (text: string) => {
    setInputText(text);

    if (text && !isTyping && isConnected) {
      setIsTyping(true);
      onTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onStopTyping();
      }
    }, 2000);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (!isConnected) return;

    onSendMessage(inputText);
    setInputText("");

    if (isTyping) {
      setIsTyping(false);
      onStopTyping();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  return (
    <View style={styles.inputContainer}>
      <TouchableOpacity style={styles.attachButton}>
        <Ionicons name="add-circle-outline" size={32} color="#007AFF" />
      </TouchableOpacity>

      <View style={styles.textInputWrapper}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleChangeText}
          placeholder="Message..."
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={500}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.sendButton,
          !inputText.trim() && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!inputText.trim() || !isConnected}
      >
        <LinearGradient
          colors={
            inputText.trim() ? ["#007AFF", "#0051D5"] : ["#C7C7CC", "#C7C7CC"]
          }
          style={styles.sendGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    gap: 8,
  },
  attachButton: {
    padding: 4,
  },
  textInputWrapper: {
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
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
