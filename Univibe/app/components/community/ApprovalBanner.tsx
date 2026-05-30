// app/components/community/ApprovalBanner.tsx

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ApprovalBannerProps {
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  onEditPress?: () => void;
}

export default function ApprovalBanner({
  status = "pending",
  rejectionReason,
  onEditPress,
}: ApprovalBannerProps) {
  const isPending = status === "pending";
  const isRejected = status === "rejected";

  if (status === "approved") return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isPending ? "#f59e0b20" : "#ef444420",
          borderColor: isPending ? "#f59e0b40" : "#ef444440",
        },
      ]}
    >
      <Ionicons
        name={isPending ? "time-outline" : "close-circle"}
        size={16}
        color={isPending ? "#f59e0b" : "#ef4444"}
      />
      <View style={styles.textContainer}>
        <Text
          style={[styles.title, { color: isPending ? "#f59e0b" : "#ef4444" }]}
        >
          {isPending ? "Pending Approval" : "Community Rejected"}
        </Text>
        <Text
          style={[styles.message, { color: isPending ? "#f59e0b" : "#ef4444" }]}
        >
          {isPending
            ? "This community is not yet visible to others"
            : rejectionReason
              ? `Reason: ${rejectionReason}`
              : "This community was not approved"}
        </Text>
      </View>
      {isRejected && onEditPress && (
        <TouchableOpacity style={styles.editBtn} onPress={onEditPress}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontFamily: "SofiaSans-Bold",
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 16,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#ef4444",
  },
  editBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "SofiaSans-SemiBold",
  },
});
