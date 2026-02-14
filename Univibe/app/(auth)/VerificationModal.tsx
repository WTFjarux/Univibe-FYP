// components/VerificationModal.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface VerificationModalProps {
  visible: boolean;
  email: string;
  isEmailVerified?: boolean;
  onClose: () => void;
  onSetupProfile: () => Promise<void>; // Will redirect if verified
  onResendVerification?: () => void;
  isChecking?: boolean;
}

const VerificationModal: React.FC<VerificationModalProps> = ({
  visible,
  email,
  isEmailVerified = false,
  onClose,
  onSetupProfile,
  onResendVerification,
  isChecking = false,
}) => {
  const [showNotVerifiedMessage, setShowNotVerifiedMessage] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Handle setup profile button click
   * Redirects to profile setup if verified, shows message if not verified
   */
  const handleSetupProfileClick = async () => {
    if (!isEmailVerified) {
      // Show message when user tries to setup profile without verification
      setShowNotVerifiedMessage(true);
      // Auto-hide message after 5 seconds
      setTimeout(() => setShowNotVerifiedMessage(false), 5000);
      return;
    }

    // If verified, proceed with setup
    setIsProcessing(true);
    try {
      await onSetupProfile();
    } catch (error) {
      console.error("Setup profile error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ========== HEADER ========== */}
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons
                name={
                  isEmailVerified ? "checkmark-circle" : "mail-open-outline"
                }
                size={50}
                color={isEmailVerified ? "#4CAF50" : "#6C63FF"}
              />
              {isEmailVerified && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark" size={30} color="#4CAF50" />
                </View>
              )}
            </View>
            <Text style={styles.modalTitle}>
              {isEmailVerified ? "Email Verified!" : "Check Your Email!"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {isEmailVerified
                ? "Your email has been successfully verified!"
                : "We've sent a verification email to:"}
            </Text>
          </View>

          {/* ========== EMAIL DISPLAY ========== */}
          <View
            style={[
              styles.emailContainer,
              isEmailVerified && styles.verifiedEmailContainer,
            ]}
          >
            <Ionicons
              name={isEmailVerified ? "checkmark-circle" : "mail"}
              size={20}
              color={isEmailVerified ? "#4CAF50" : "#6C63FF"}
              style={styles.emailIcon}
            />
            <Text style={styles.emailText}>{email}</Text>
            {isEmailVerified && (
              <Ionicons
                name="checkmark"
                size={16}
                color="#4CAF50"
                style={styles.verifiedBadge}
              />
            )}
          </View>

          {/* ========== NOT VERIFIED MESSAGE ========== */}
          {showNotVerifiedMessage && !isEmailVerified && (
            <View style={styles.notVerifiedMessage}>
              <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
              <Text style={styles.notVerifiedText}>
                Please verify your email before setting up your profile
              </Text>
            </View>
          )}

          {/* ========== STATUS INDICATOR ========== */}
          {!isEmailVerified && (
            <View style={styles.statusContainer}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Verification Pending</Text>
            </View>
          )}

          {/* ========== INSTRUCTIONS ========== */}
          {/* Show different instructions based on verification status */}
          {!isEmailVerified ? (
            <View style={styles.instructionContainer}>
              <View style={styles.instructionRow}>
                <View style={styles.instructionIcon}>
                  <Ionicons name="mail" size={18} color="#6C63FF" />
                </View>
                <Text style={styles.instructionText}>
                  Check your email inbox for verification link
                </Text>
              </View>

              <View style={styles.instructionRow}>
                <View style={styles.instructionIcon}>
                  <Ionicons name="link" size={18} color="#4CAF50" />
                </View>
                <Text style={styles.instructionText}>
                  Click the link to verify your email
                </Text>
              </View>

              <View style={styles.instructionRow}>
                <View style={styles.instructionIcon}>
                  <Ionicons name="refresh" size={18} color="#29B6F6" />
                </View>
                <Text style={styles.instructionText}>
                  After verification, click "Setup Profile" again
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.verifiedInstructionContainer}>
              <View style={styles.instructionRow}>
                <View style={styles.instructionIcon}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                </View>
                <Text style={styles.instructionText}>
                  Your email has been verified successfully
                </Text>
              </View>

              <View style={styles.instructionRow}>
                <View style={styles.instructionIcon}>
                  <Ionicons name="person" size={18} color="#6C63FF" />
                </View>
                <Text style={styles.instructionText}>
                  You can now complete your profile setup
                </Text>
              </View>
            </View>
          )}

          {/* ========== NOTE TEXT ========== */}
          <Text style={styles.noteText}>
            {isEmailVerified
              ? "You can now proceed to set up your profile!"
              : "Profile setup will be available after verification."}
          </Text>

          {/* ========== BUTTONS ========== */}
          <View style={styles.buttonContainer}>
            {/* Setup Profile Button - Single button for all states */}
            <TouchableOpacity
              style={[
                styles.profileButton,
                (isChecking || isProcessing) && styles.disabledButton,
              ]}
              onPress={handleSetupProfileClick}
              disabled={isChecking || isProcessing}
            >
              {isChecking || isProcessing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={isEmailVerified ? "person" : "person-outline"}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.profileButtonText}>
                    {isEmailVerified ? "Setup Profile Now" : "Setup Profile"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ========== RESEND SECTION ========== */}
          {/* Only show when email is not verified */}
          {!isEmailVerified && onResendVerification && (
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the email?</Text>
              <TouchableOpacity
                onPress={onResendVerification}
                disabled={isChecking || isProcessing}
              >
                <Text style={styles.resendLink}>
                  {isChecking ? "Sending..." : "Resend Verification"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ========== MODAL OVERLAY ==========
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#2A2840",
    borderRadius: 24,
    padding: 30,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // ========== HEADER STYLES ==========
  modalHeader: {
    alignItems: "center",
    marginBottom: 25,
  },
  modalIconContainer: {
    position: "relative",
    marginBottom: 15,
  },
  checkmarkContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#2A2840",
    borderRadius: 12,
    padding: 3,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },

  // ========== EMAIL CONTAINER ==========
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(108, 99, 255, 0.15)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "rgba(108, 99, 255, 0.4)",
    width: "100%",
  },
  verifiedEmailContainer: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    borderColor: "rgba(76, 175, 80, 0.4)",
  },
  emailIcon: {
    marginRight: 12,
  },
  emailText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  verifiedBadge: {
    marginLeft: 8,
  },

  // ========== NOT VERIFIED MESSAGE ==========
  notVerifiedMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: "#FF6B6B",
    width: "100%",
  },
  notVerifiedText: {
    color: "#FF6B6B",
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },

  // ========== STATUS INDICATOR ==========
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFA726",
    marginRight: 8,
  },
  statusText: {
    color: "#FFA726",
    fontSize: 14,
    fontWeight: "500",
  },

  // ========== INSTRUCTION CONTAINERS ==========
  instructionContainer: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  verifiedInstructionContainer: {
    width: "100%",
    backgroundColor: "rgba(76, 175, 80, 0.08)",
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.2)",
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  instructionIcon: {
    width: 28,
    alignItems: "center",
    marginRight: 12,
  },
  instructionText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    flex: 1,
  },

  // ========== NOTE TEXT ==========
  noteText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 25,
    fontStyle: "italic",
  },

  // ========== BUTTONS ==========
  buttonContainer: {
    width: "100%",
    marginBottom: 20,
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6C63FF",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: "100%",
    gap: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  profileButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // ========== RESEND SECTION ==========
  resendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  resendText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
  },
  resendLink: {
    color: "#6C63FF",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});

export default VerificationModal;
