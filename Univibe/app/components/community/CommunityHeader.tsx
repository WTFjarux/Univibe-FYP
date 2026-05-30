// app/components/community/CommunityHeader.tsx

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { Community } from "../../../lib/types/community";

interface CommunityHeaderProps {
  community: Community;
  onBack: () => void;
  onCreatePress: () => void;
  onRequestsPress: () => void;
  onInvitePress: () => void;
  onSettingsPress: () => void;
}

export default function CommunityHeader({
  community,
  onBack,
  onCreatePress,
  onRequestsPress,
  onInvitePress,
  onSettingsPress,
}: CommunityHeaderProps) {
  const { colors, isDark } = useTheme();
  const pendingCount = community.pendingRequestsCount || 0;
  const isMember =
    community.isMember || community.isAdmin || community.isModerator;
  const canManage = community.isAdmin || community.isModerator;
  const isApproved = community.approvalStatus === "approved";

  return (
    <View
      style={[
        styles.header,
        { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
      ]}
    >
      {/* Back Button */}
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      {/* Title */}
      <Text
        style={[styles.headerTitle, { color: colors.text }]}
        numberOfLines={1}
      >
        {community.name}
      </Text>

      {/* Right Side */}
      {isApproved ? (
        <View style={styles.headerActions}>
          {canManage && (
            <TouchableOpacity onPress={onCreatePress} style={styles.headerBtn}>
              <Ionicons name="add-circle" size={26} color={colors.primary} />
            </TouchableOpacity>
          )}
          {canManage && (
            <TouchableOpacity
              onPress={onRequestsPress}
              style={styles.headerBtn}
            >
              <View>
                <Ionicons
                  name="people-outline"
                  size={pendingCount > 0 ? 24 : 22}
                  color={pendingCount > 0 ? colors.text : colors.textSecondary}
                />
                {pendingCount > 0 && (
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          {isMember && (
            <TouchableOpacity
              onPress={onSettingsPress}
              style={styles.headerBtn}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // ✅ Placeholder to keep title centered
        <View style={styles.headerBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "SofiaSans-Bold",
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  requestBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  requestBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontFamily: "SofiaSans-Bold",
  },
});
