// app/components/community/MemberOptionsModal.tsx

import React, { useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { CommunityMember } from "../../../lib/types/community";

interface MemberOptionsModalProps {
  visible: boolean;
  member: CommunityMember | null;
  isAdmin: boolean;
  currentUserId: string;
  communityId: string;
  onClose: () => void;
  onRemoveMember: (member: CommunityMember) => void;
  onAddModerator: (member: CommunityMember) => void;
  onRemoveModerator: (member: CommunityMember) => void;
  onViewProfile: (member: CommunityMember) => void;
}

const MemberOptionsModal: React.FC<MemberOptionsModalProps> = ({
  visible,
  member,
  isAdmin,
  currentUserId,
  onClose,
  onRemoveMember,
  onAddModerator,
  onRemoveModerator,
  onViewProfile,
}) => {
  const { colors } = useTheme();

  // Safely extract member data with fallbacks
  const memberName = member?.user?.name || "Unknown";
  const memberId = member?.user?._id || "";
  const isCurrentUser = memberId === currentUserId;
  const isMemberAdmin = member?.isAdmin || false;
  const isModerator = member?.role === "moderator";

  // Format joined date
  const formatJoinedDate = (): string => {
    if (!member?.joinedAt) return "Unknown";
    const date = new Date(member.joinedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffDays === 0) return "Joined today";
    if (diffDays === 1) return "Joined yesterday";
    if (diffDays < 7) return `Joined ${diffDays} days ago`;
    if (diffDays < 30) return `Joined ${Math.floor(diffDays / 7)} weeks ago`;
    if (diffMonths < 12)
      return `Joined ${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
    if (diffYears === 1) return "Joined 1 year ago";
    return `Joined ${diffYears} years ago`;
  };

  const formatExactDate = (): string => {
    if (!member?.joinedAt) return "";
    return new Date(member.joinedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ALL hooks must be called unconditionally
  const handleRemoveMember = useCallback(() => {
    if (!member) return;
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${memberName} from the community?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            onClose();
            setTimeout(() => onRemoveMember(member), 300);
          },
        },
      ],
    );
  }, [member, memberName, onClose, onRemoveMember]);

  const handleToggleModerator = useCallback(() => {
    if (!member) return;
    if (isModerator) {
      Alert.alert(
        "Remove Moderator",
        `Remove moderator role from ${memberName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove Role",
            style: "destructive",
            onPress: () => {
              onClose();
              setTimeout(() => onRemoveModerator(member), 300);
            },
          },
        ],
      );
    } else {
      Alert.alert(
        "Make Moderator",
        `Promote ${memberName} to moderator? They will be able to manage members and content.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Promote",
            onPress: () => {
              onClose();
              setTimeout(() => onAddModerator(member), 300);
            },
          },
        ],
      );
    }
  }, [
    isModerator,
    member,
    memberName,
    onClose,
    onAddModerator,
    onRemoveModerator,
  ]);

  const handleViewProfile = useCallback(() => {
    if (!member) return;
    onClose();
    setTimeout(() => onViewProfile(member), 300);
  }, [onClose, onViewProfile, member]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Only render null after ALL hooks have been called
  if (!member) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.card || "#ffffff" },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border || "#e2e8f0" },
            ]}
          >
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {memberName}
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: colors.textSecondary }]}
              >
                @{member?.user?.username || "user"}
                {isModerator && " · Moderator"}
                {isMemberAdmin && " · Admin"}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Joined Date Info */}
          <View
            style={[
              styles.joinedInfo,
              { borderBottomColor: colors.border || "#e2e8f0" },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={20}
              color={colors.textSecondary}
            />
            <View style={styles.joinedTextContainer}>
              <Text style={[styles.joinedDate, { color: colors.text }]}>
                {formatJoinedDate()}
              </Text>
              <Text
                style={[styles.joinedExact, { color: colors.textSecondary }]}
              >
                {formatExactDate()}
              </Text>
            </View>
          </View>

          {/* Remove Member - only for admins on non-admin, non-self members */}
          {isAdmin && !isMemberAdmin && !isCurrentUser && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleRemoveMember}
            >
              <Ionicons
                name="person-remove-outline"
                size={22}
                color="#ef4444"
              />
              <Text style={[styles.optionText, { color: "#ef4444" }]}>
                Remove Member
              </Text>
            </TouchableOpacity>
          )}

          {/* Toggle Moderator - only for admins on non-admin, non-self members */}
          {isAdmin && !isMemberAdmin && !isCurrentUser && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleToggleModerator}
            >
              <Ionicons
                name={isModerator ? "star-outline" : "star"}
                size={22}
                color={isModerator ? "#f59e0b" : "#8b5cf6"}
              />
              <Text
                style={[
                  styles.optionText,
                  { color: isModerator ? "#f59e0b" : "#8b5cf6" },
                ]}
              >
                {isModerator ? "Remove Moderator" : "Make Moderator"}
              </Text>
            </TouchableOpacity>
          )}

          {/* View Profile */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={handleViewProfile}
          >
            <Ionicons
              name="person-outline"
              size={22}
              color={colors.textSecondary}
            />
            <Text style={[styles.optionText, { color: colors.text }]}>
              View Profile
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[
              styles.cancelButton,
              { backgroundColor: (colors.border || "#e2e8f0") + "40" },
            ]}
            onPress={handleClose}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "SofiaSans-Bold",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  joinedInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  joinedTextContainer: {
    flex: 1,
  },
  joinedDate: {
    fontSize: 14,
    fontFamily: "SofiaSans-SemiBold",
  },
  joinedExact: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  cancelButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "SofiaSans-SemiBold",
  },
});

export default React.memo(MemberOptionsModal);
