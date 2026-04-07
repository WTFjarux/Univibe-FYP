// components/EventActionBar.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EventActionBarProps {
  isInterested: boolean;
  isRsvpd: boolean;
  isFull: boolean;
  processing: boolean;
  onInterest: () => void;
  onRsvp: () => void;
}

export const EventActionBar = ({
  isInterested,
  isRsvpd,
  isFull,
  processing,
  onInterest,
  onRsvp,
}: EventActionBarProps) => {
  return (
    <View style={styles.actionBar}>
      <TouchableOpacity
        style={[styles.actionButton, isInterested && styles.actionButtonActive]}
        onPress={onInterest}
        disabled={processing}
      >
        <Ionicons
          name={isInterested ? "heart" : "heart-outline"}
          size={20}
          color={isInterested ? "#ef4444" : "#6b7280"}
        />
        <Text
          style={[
            styles.actionButtonText,
            isInterested && styles.actionButtonTextActive,
          ]}
        >
          {isInterested ? "Interested" : "Interest"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.rsvpButton,
          isRsvpd && styles.rsvpButtonActive,
          isFull && !isRsvpd && styles.rsvpButtonDisabled,
        ]}
        onPress={onRsvp}
        disabled={processing || (isFull && !isRsvpd)}
      >
        <Text
          style={[
            styles.rsvpButtonText,
            isRsvpd && styles.rsvpButtonTextActive,
          ]}
        >
          {isRsvpd ? "✓ Going" : isFull ? "Full" : "RSVP"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
  },
  actionButtonActive: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  actionButtonText: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  actionButtonTextActive: {
    color: "#ef4444",
  },
  rsvpButton: {
    flex: 1.5,
    backgroundColor: "#8b5cf6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rsvpButtonActive: {
    backgroundColor: "#10b981",
  },
  rsvpButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  rsvpButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "SofiaSans-Bold",
  },
  rsvpButtonTextActive: {
    color: "white",
  },
});

export default EventActionBar; 