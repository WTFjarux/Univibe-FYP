// app/components/community/CommunityCard.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { getFullImageUrl } from "../../../lib/services/communityService";
import { Community } from "../../../lib/types/community";

interface CommunityCardProps {
  community: Community;
  joiningId: string | null;
  onJoin: (community: Community) => void;
  onRequestToJoin: (community: Community) => void;
}

const CommunityCard: React.FC<CommunityCardProps> = ({
  community,
  joiningId,
  onJoin,
  onRequestToJoin,
}) => {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const isMember = community.isMember || false;
  const isAdmin = community.isAdmin || false;
  const isModerator = community.isModerator || false;
  const isJoining = joiningId === community._id;
  const isDepartment = community.type === "department";
  const isPrivate = community.privacy === "private";

  // ✅ Use approvalStatus instead of isApproved
  const approvalStatus = community.approvalStatus || "pending";
  const isApproved = approvalStatus === "approved";
  const isRejected = approvalStatus === "rejected";
  const isPending = approvalStatus === "pending";

  const hasPendingRequest =
    community.hasPendingRequest && !isAdmin && !isMember;

  // Determine role badge
  const getRoleBadge = () => {
    if (isAdmin) {
      return {
        label: "Admin",
        color: "#8b5cf6",
        icon: "shield-checkmark" as const,
        bgColor: "#8b5cf620",
      };
    }
    if (isModerator) {
      return {
        label: "Moderator",
        color: "#6366f1",
        icon: "star" as const,
        bgColor: "#6366f120",
      };
    }
    if (isMember) {
      return {
        label: "Joined",
        color: "#10b981",
        icon: "checkmark-circle" as const,
        bgColor: "#10b98120",
      };
    }
    return null;
  };

  const roleBadge = getRoleBadge();

  // Determine button state
  const showRequestedButton = hasPendingRequest && isApproved;
  const showJoinButton =
    !isMember && !isAdmin && !hasPendingRequest && isApproved;
  const showPendingApproval = isPending && isAdmin;
  const showRejectedBadge = isRejected && isAdmin;
  const showNotAvailable =
    !isMember && !isAdmin && !isApproved && !hasPendingRequest;

  const handlePress = () => {
    router.push(`/screens/CommunityScreen?communityId=${community._id}` as any);
  };

  const handleJoinPress = (e: any) => {
    e.stopPropagation();
    if (isPrivate) {
      onRequestToJoin(community);
    } else {
      onJoin(community);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: isDark ? "#1e293b" : "#ffffff" }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Cover Image */}
      {community.coverImage ? (
        <Image
          source={{ uri: getFullImageUrl(community.coverImage) }}
          style={styles.coverImage}
        />
      ) : (
        <View
          style={[
            styles.coverPlaceholder,
            { backgroundColor: colors.primary + "25" },
          ]}
        >
          <Ionicons
            name={isDepartment ? "school-outline" : "people-outline"}
            size={36}
            color={colors.primary}
          />
        </View>
      )}

      <View style={styles.cardContent}>
        {/* Header with Name and Role Badge */}
        <View style={styles.cardHeader}>
          <Text
            style={[styles.communityName, { color: colors.text }]}
            numberOfLines={1}
          >
            {community.name}
          </Text>

          {/* Role Badge */}
          {roleBadge && (
            <View
              style={[styles.roleBadge, { backgroundColor: roleBadge.bgColor }]}
            >
              <Ionicons
                name={roleBadge.icon}
                size={12}
                color={roleBadge.color}
              />
              <Text style={[styles.roleBadgeText, { color: roleBadge.color }]}>
                {roleBadge.label}
              </Text>
            </View>
          )}

          {/* ✅ Pending Approval Badge */}
          {showPendingApproval && (
            <View style={[styles.roleBadge, { backgroundColor: "#f59e0b20" }]}>
              <Ionicons name="time-outline" size={12} color="#f59e0b" />
              <Text style={[styles.roleBadgeText, { color: "#f59e0b" }]}>
                Pending
              </Text>
            </View>
          )}

          {/* ✅ Rejected Badge */}
          {showRejectedBadge && (
            <View style={[styles.roleBadge, { backgroundColor: "#ef444420" }]}>
              <Ionicons name="close-circle" size={12} color="#ef4444" />
              <Text style={[styles.roleBadgeText, { color: "#ef4444" }]}>
                Rejected
              </Text>
            </View>
          )}

          {/* Pending Join Request */}
          {showRequestedButton && (
            <View style={[styles.roleBadge, { backgroundColor: "#3b82f620" }]}>
              <Ionicons name="time-outline" size={12} color="#3b82f6" />
              <Text style={[styles.roleBadgeText, { color: "#3b82f6" }]}>
                Requested
              </Text>
            </View>
          )}
        </View>

        {/* Type & Privacy Badges */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isDepartment
                  ? "#10b98120"
                  : colors.primary + "15",
              },
            ]}
          >
            <Ionicons
              name={isDepartment ? "school-outline" : "people-outline"}
              size={11}
              color={isDepartment ? "#10b981" : colors.primary}
            />
            <Text
              style={[
                styles.typeBadgeText,
                { color: isDepartment ? "#10b981" : colors.primary },
              ]}
            >
              {isDepartment ? "Department" : "Community"}
            </Text>
          </View>
          <View
            style={[
              styles.privacyBadge,
              { backgroundColor: isPrivate ? "#f59e0b15" : "#10b98115" },
            ]}
          >
            <Ionicons
              name={isPrivate ? "lock-closed-outline" : "globe-outline"}
              size={11}
              color={isPrivate ? "#f59e0b" : "#10b981"}
            />
            <Text
              style={[
                styles.privacyBadgeText,
                { color: isPrivate ? "#f59e0b" : "#10b981" },
              ]}
            >
              {isPrivate ? "Private" : "Public"}
            </Text>
          </View>
        </View>

        {/* Description */}
        {community.description ? (
          <Text
            style={[styles.description, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {community.description}
          </Text>
        ) : null}

        {/* ✅ Rejection Reason */}
        {isRejected && community.rejectionReason && (
          <Text
            style={[styles.rejectionReason, { color: "#ef4444" }]}
            numberOfLines={1}
          >
            Reason: {community.rejectionReason}
          </Text>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.memberCount}>
            <Ionicons
              name="people-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.memberCountText, { color: colors.textSecondary }]}
            >
              {community.memberCount}{" "}
              {community.memberCount === 1 ? "member" : "members"}
            </Text>
          </View>

          {/* Action Button */}
          {showJoinButton && (
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.primary }]}
              onPress={handleJoinPress}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name={
                      isPrivate ? "lock-closed-outline" : "add-circle-outline"
                    }
                    size={14}
                    color="#ffffff"
                  />
                  <Text style={styles.joinButtonText}>
                    {isPrivate ? "Request" : "Join"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {showRequestedButton && (
            <View
              style={[styles.statusButton, { backgroundColor: "#3b82f620" }]}
            >
              <Ionicons name="time-outline" size={14} color="#3b82f6" />
              <Text style={[styles.statusButtonText, { color: "#3b82f6" }]}>
                Requested
              </Text>
            </View>
          )}

          {showPendingApproval && (
            <View
              style={[styles.statusButton, { backgroundColor: "#f59e0b20" }]}
            >
              <Ionicons name="time-outline" size={14} color="#f59e0b" />
              <Text style={[styles.statusButtonText, { color: "#f59e0b" }]}>
                Pending Approval
              </Text>
            </View>
          )}

          {showNotAvailable && (
            <View
              style={[
                styles.statusButton,
                { backgroundColor: isDark ? "#334155" : "#e2e8f0" },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.statusButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Not Available
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  coverImage: { width: "100%", height: 100 },
  coverPlaceholder: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { padding: 12 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  communityName: { fontSize: 16, fontFamily: "SofiaSans-Bold", flex: 1 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    flexShrink: 0,
  },
  roleBadgeText: { fontSize: 11, fontFamily: "SofiaSans-SemiBold" },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
  },
  typeBadgeText: { fontSize: 11, fontFamily: "SofiaSans-SemiBold" },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
  },
  privacyBadgeText: { fontSize: 11, fontFamily: "SofiaSans-SemiBold" },
  description: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
    marginBottom: 6,
  },
  rejectionReason: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 8,
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberCount: { flexDirection: "row", alignItems: "center", gap: 4 },
  memberCountText: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 5,
  },
  joinButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "SofiaSans-Bold",
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 5,
  },
  statusButtonText: { fontSize: 12, fontFamily: "SofiaSans-SemiBold" },
});

export default React.memo(CommunityCard);
