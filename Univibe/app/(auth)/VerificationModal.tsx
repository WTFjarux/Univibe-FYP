// app/(auth)/VerificationModal.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { API_BASE_URL } from "../../constants/stringConstants";

interface CustomJwtPayload {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  exp?: number;
  iat?: number;
}

interface VerificationModalProps {
  visible: boolean;
  email: string;
  token?: string | null;
  isEmailVerified?: boolean;
  onClose: () => void;
  onSetupProfile: () => Promise<void>;
  onResendVerification?: () => Promise<void>;
  onVerificationComplete?: (newToken: string) => void;
  isChecking?: boolean;
}

const VerificationModal: React.FC<VerificationModalProps> = ({
  visible,
  email,
  token,
  isEmailVerified = false,
  onClose,
  onSetupProfile,
  onResendVerification,
  onVerificationComplete,
  isChecking = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [localVerified, setLocalVerified] = useState(isEmailVerified);
  const [hasChecked, setHasChecked] = useState(false);

  // Update local state when prop changes
  useEffect(() => {
    setLocalVerified(isEmailVerified);
  }, [isEmailVerified]);

  // Check verification status once when modal opens
  useEffect(() => {
    if (visible && !localVerified && !hasChecked) {
      checkVerificationStatus();
    }
  }, [visible, localVerified, hasChecked]);

  const checkVerificationStatus = async () => {
    if (!token || hasChecked) return;

    setIsCheckingStatus(true);
    try {
      const decoded = jwtDecode<CustomJwtPayload>(token);

      // If token already shows verified, update state
      if (decoded.isEmailVerified) {
        setLocalVerified(true);
        setHasChecked(true);
        return;
      }

      // Check with backend
      const response = await fetch(
        `${API_BASE_URL}/api/auth/check-verification`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (data.success && data.isEmailVerified) {
        // Email is verified - refresh token
        const refreshResponse = await fetch(
          `${API_BASE_URL}/api/auth/refresh-token`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        const refreshData = await refreshResponse.json();

        if (refreshData.success && refreshData.token) {
          await SecureStore.setItemAsync("authToken", refreshData.token);
          setLocalVerified(true);

          if (onVerificationComplete) {
            onVerificationComplete(refreshData.token);
          }
        }
      }
      setHasChecked(true);
    } catch (error) {
      console.error("Verification check failed:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleResendVerification = async () => {
    if (!onResendVerification) return;

    try {
      await onResendVerification();
      // Reset check flag to allow re-checking after resend
      setHasChecked(false);
    } catch (error) {
      // Error handled by parent
    }
  };

  const handleSetupProfileClick = async () => {
    if (!localVerified) {
      // Re-check before proceeding
      setIsCheckingStatus(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/auth/check-verification`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        const data = await response.json();

        if (data.success && data.isEmailVerified) {
          setLocalVerified(true);
        } else {
          return;
        }
      } catch (error) {
        return;
      } finally {
        setIsCheckingStatus(false);
      }
    }

    setIsProcessing(true);
    try {
      await onSetupProfile();
    } catch (error) {
      // Error handled by parent
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
          {(isCheckingStatus || isChecking) && !localVerified && (
            <View style={styles.checkingOverlay}>
              <ActivityIndicator size="large" color="#6C63FF" />
              <Text style={styles.checkingText}>
                Checking verification status...
              </Text>
            </View>
          )}

          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons
                name={localVerified ? "checkmark-circle" : "mail-open-outline"}
                size={50}
                color={localVerified ? "#4CAF50" : "#6C63FF"}
              />
              {localVerified && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark" size={30} color="#4CAF50" />
                </View>
              )}
            </View>
            <Text style={styles.modalTitle}>
              {localVerified ? "Email Verified!" : "Check Your Email!"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {localVerified
                ? "Your email has been successfully verified!"
                : "We've sent a verification email to:"}
            </Text>
          </View>

          <View
            style={[
              styles.emailContainer,
              localVerified && styles.verifiedEmailContainer,
            ]}
          >
            <Ionicons
              name={localVerified ? "checkmark-circle" : "mail"}
              size={20}
              color={localVerified ? "#4CAF50" : "#6C63FF"}
              style={styles.emailIcon}
            />
            <Text style={styles.emailText}>{email}</Text>
            {localVerified && (
              <Ionicons
                name="checkmark"
                size={16}
                color="#4CAF50"
                style={styles.verifiedBadge}
              />
            )}
          </View>

          {!localVerified ? (
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
                  Return to this screen and click "Setup Profile" after
                  verification
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
                  Click "Setup Profile" to complete your account
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.noteText}>
            {localVerified
              ? "Click the button below to set up your profile"
              : "Profile setup will be available after verification."}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.profileButton,
                (isProcessing || isCheckingStatus) && styles.disabledButton,
              ]}
              onPress={handleSetupProfileClick}
              disabled={isProcessing || isCheckingStatus}
            >
              {isProcessing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={localVerified ? "person" : "person-outline"}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.profileButtonText}>
                    {localVerified ? "Setup Profile Now" : "Setup Profile"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {!localVerified && onResendVerification && (
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the email?</Text>
              <TouchableOpacity onPress={handleResendVerification}>
                <Text style={styles.resendLink}>Resend Verification</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    position: "relative",
  },
  checkingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(42, 40, 64, 0.95)",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  checkingText: {
    color: "white",
    marginTop: 12,
    fontSize: 14,
  },
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
  noteText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 25,
    fontStyle: "italic",
  },
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
