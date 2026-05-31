// app/components/community/CommunitySettingsModal.tsx

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
import { Community } from "../../../lib/types/community";

interface CommunitySettingsModalProps {
  visible: boolean;
  community: Community | null;
  isAdmin: boolean;
  isModerator: boolean;
  isMember: boolean;
  onClose: () => void;
  onEditDetails: () => void;
  onManageMembers: () => void;
  onJoinRequests: () => void;
  onInviteUsers: () => void;
  onLeaveCommunity: () => void;
  onViewRules: () => void;
  onShareCommunity: () => void;
  onReportCommunity: () => void;
  onDeleteCommunity: () => void;
}

const CommunitySettingsModal: React.FC<CommunitySettingsModalProps> = ({
  visible,
  community,
  isAdmin,
  isModerator,
  isMember,
  onClose,
  onEditDetails,
  onManageMembers,
  onJoinRequests,
  onInviteUsers,
  onLeaveCommunity,
  onViewRules,
  onShareCommunity,
  onReportCommunity,
  onDeleteCommunity,
}) => {
  const { colors } = useTheme();
  const canManage = isAdmin || isModerator;
  const isRegularMember = isMember && !canManage;
  const canInvite = isMember || isAdmin || isModerator;

  if (!community) return null;

  const handleLeavePress = useCallback(() => {
    if (isAdmin) {
      Alert.alert(
        "Cannot Leave",
        "You are the admin of this community. Transfer admin role to another member before leaving.",
        [{ text: "OK" }],
      );
      return;
    }
    onClose();
    setTimeout(() => onLeaveCommunity(), 300);
  }, [isAdmin, onClose, onLeaveCommunity]);

  const handleDeletePress = useCallback(() => {
    onClose();
    setTimeout(() => onDeleteCommunity(), 300);
  }, [onClose, onDeleteCommunity]);

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
                Community Settings
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: colors.textSecondary }]}
              >
                {community.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* MANAGEMENT Section (Admins & Moderators) */}
          {canManage && (
            <>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                MANAGEMENT
              </Text>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  setTimeout(onEditDetails, 300);
                }}
              >
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Edit Details
                  </Text>
                  <Text
                    style={[styles.optionDesc, { color: colors.textSecondary }]}
                  >
                    Update name, description, cover photo
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  setTimeout(onManageMembers, 300);
                }}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: "#8b5cf620" }]}
                >
                  <Ionicons name="people-outline" size={22} color="#8b5cf6" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Manage Members
                  </Text>
                  <Text
                    style={[styles.optionDesc, { color: colors.textSecondary }]}
                  >
                    View and manage all members
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  setTimeout(onJoinRequests, 300);
                }}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: "#3b82f620" }]}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={22}
                    color="#3b82f6"
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Join Requests
                  </Text>
                  <Text
                    style={[styles.optionDesc, { color: colors.textSecondary }]}
                  >
                    {community.pendingRequestsCount
                      ? `${community.pendingRequestsCount} pending`
                      : "No pending requests"}
                  </Text>
                </View>
                {community.pendingRequestsCount ? (
                  <View style={[styles.badge, { backgroundColor: "#ef4444" }]}>
                    <Text style={styles.badgeText}>
                      {community.pendingRequestsCount > 9
                        ? "9+"
                        : community.pendingRequestsCount}
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textSecondary}
                  />
                )}
              </TouchableOpacity>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.border || "#e2e8f0" },
                ]}
              />
            </>
          )}

          {/* GENERAL Section */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            GENERAL
          </Text>

          {/* Invite Users */}
          {canInvite && (
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                setTimeout(onInviteUsers, 300);
              }}
            >
              <View
                style={[styles.optionIcon, { backgroundColor: "#10b98120" }]}
              >
                <Ionicons name="mail-outline" size={22} color="#10b981" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  Invite Users
                </Text>
                <Text
                  style={[styles.optionDesc, { color: colors.textSecondary }]}
                >
                  Invite people to join this community
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {/* View Rules */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              setTimeout(onViewRules, 300);
            }}
          >
            <View style={[styles.optionIcon, { backgroundColor: "#f59e0b20" }]}>
              <Ionicons name="list-outline" size={22} color="#f59e0b" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Community Rules
              </Text>
              <Text
                style={[styles.optionDesc, { color: colors.textSecondary }]}
              >
                View community guidelines
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Share Community */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              setTimeout(onShareCommunity, 300);
            }}
          >
            <View style={[styles.optionIcon, { backgroundColor: "#ec489920" }]}>
              <Ionicons name="share-outline" size={22} color="#ec4899" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Share Community
              </Text>
              <Text
                style={[styles.optionDesc, { color: colors.textSecondary }]}
              >
                Share this community with others
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Report Community - for regular members only */}
          {isRegularMember && (
            <>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.border || "#e2e8f0" },
                ]}
              />
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  setTimeout(onReportCommunity, 300);
                }}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: "#ef444420" }]}
                >
                  <Ionicons name="flag-outline" size={22} color="#ef4444" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionTitle, { color: "#ef4444" }]}>
                    Report Community
                  </Text>
                  <Text
                    style={[styles.optionDesc, { color: colors.textSecondary }]}
                  >
                    Report this community for violating guidelines
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </>
          )}

          {/* DANGER ZONE */}
          {canInvite && (
            <>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.border || "#e2e8f0" },
                ]}
              />
              <Text style={[styles.sectionTitle, { color: "#ef4444" }]}>
                DANGER ZONE
              </Text>

              {/* Leave Community */}
              <TouchableOpacity
                style={styles.optionItem}
                onPress={handleLeavePress}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: "#ef444420" }]}
                >
                  <Ionicons name="exit-outline" size={22} color="#ef4444" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionTitle, { color: "#ef4444" }]}>
                    {isAdmin ? "Transfer & Leave" : "Leave Community"}
                  </Text>
                  <Text
                    style={[styles.optionDesc, { color: colors.textSecondary }]}
                  >
                    {isAdmin
                      ? "Transfer admin role to leave"
                      : "Remove yourself from this community"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Delete Community - Admin only */}
              {isAdmin && (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={handleDeletePress}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      { backgroundColor: "#dc262620" },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={22} color="#dc2626" />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionTitle, { color: "#dc2626" }]}>
                      Delete Community
                    </Text>
                    <Text
                      style={[
                        styles.optionDesc,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Permanently delete this community and all its data
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Cancel Button */}
          <TouchableOpacity
            style={[
              styles.cancelButton,
              { backgroundColor: (colors.border || "#e2e8f0") + "40" },
            ]}
            onPress={onClose}
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
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1, marginRight: 12 },
  headerTitle: { fontSize: 18, fontFamily: "SofiaSans-Bold" },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "SofiaSans-SemiBold",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    letterSpacing: 0.5,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: { flex: 1 },
  optionTitle: {
    fontSize: 15,
    fontFamily: "SofiaSans-SemiBold",
    marginBottom: 1,
  },
  optionDesc: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#ffffff", fontSize: 11, fontFamily: "SofiaSans-Bold" },
  divider: { height: 1, marginVertical: 8, marginHorizontal: 20 },
  cancelButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelText: { fontSize: 16, fontFamily: "SofiaSans-SemiBold" },
});

export default React.memo(CommunitySettingsModal);
