// app/components/community/JoinButton.tsx

import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { PrivacyType } from "../../../lib/types/community";

interface JoinButtonProps {
  isMember: boolean;
  isAdmin: boolean;
  privacy: PrivacyType;
  joinRequested: boolean;
  joining: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onRequestToJoin?: () => void;
}

export default function JoinButton({
  isMember,
  isAdmin,
  privacy,
  joinRequested,
  joining,
  onJoin,
  onLeave,
  onRequestToJoin,
}: JoinButtonProps) {
  const { colors } = useTheme();

  if (isAdmin) {
    return (
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary + "20" }]}
        disabled
      >
        <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
        <Text style={[styles.text, { color: colors.primary }]}>Admin</Text>
      </TouchableOpacity>
    );
  }

  if (isMember) {
    return (
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary + "20" }]}
        onPress={onLeave}
      >
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        <Text style={[styles.text, { color: colors.primary }]}>Joined</Text>
      </TouchableOpacity>
    );
  }

  if (privacy === "private") {
    if (joinRequested) {
      return (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#f59e0b20" }]}
          disabled
        >
          <Ionicons name="time-outline" size={18} color="#f59e0b" />
          <Text style={[styles.text, { color: "#f59e0b" }]}>Requested</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onRequestToJoin || onJoin}
        disabled={joining}
      >
        {joining ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="lock-closed-outline" size={18} color="#ffffff" />
            <Text style={[styles.text, { color: "#ffffff" }]}>
              Request to Join
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.primary }]}
      onPress={onJoin}
      disabled={joining}
    >
      {joining ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <>
          <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
          <Text style={[styles.text, { color: "#ffffff" }]}>
            Join Community
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  text: { fontSize: 14, fontFamily: "SofiaSans-Bold" },
});
