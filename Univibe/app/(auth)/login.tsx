// app/(auth)/login.tsx - Updated with verification check in modal
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/contexts/AuthContext";
import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../../constants/ipConstants";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage("Please fill in all fields");
      return;
    }

    setErrorMessage("");

    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      console.log("🔍 Login error:", error.message);

      const errorMsg = error.message || "";
      if (
        errorMsg.toLowerCase().includes("verify your email") ||
        errorMsg.toLowerCase().includes("email not verified") ||
        errorMsg.toLowerCase().includes("verification")
      ) {
        setIsEmailVerified(false);
        setShowVerificationModal(true);
        setErrorMessage(""); // Clear error for verification flow
      } else if (
        errorMsg.toLowerCase().includes("invalid email") ||
        errorMsg.toLowerCase().includes("invalid password")
      ) {
        setErrorMessage("Invalid email or password");
      } else {
        setErrorMessage(errorMsg || "An error occurred");
      }
    }
  };

  // Auto-check verification status every 3 seconds when modal is open
  useEffect(() => {
    if (showVerificationModal && !isEmailVerified) {
      checkVerificationStatus();

      pollingRef.current = setInterval(() => {
        checkVerificationStatus();
      }, 3000);
    }

    if (isEmailVerified && showVerificationModal) {
      // Close modal and auto-login
      const timer = setTimeout(() => {
        setShowVerificationModal(false);
        handleLogin();
      }, 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [showVerificationModal, isEmailVerified]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkVerificationStatus = async () => {
    try {
      setIsCheckingVerification(true);
      const response = await fetch(
        `${API_BASE_URL}/api/auth/check-verification-by-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      const data = await response.json();

      if (data.success && data.isEmailVerified) {
        setIsEmailVerified(true);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (error) {
      // Silent fail
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResendingEmail(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      const data = await response.json();

      if (data.success) {
        setResendCooldown(60);
        Alert.alert(
          "Email Sent",
          "New verification email sent! Please check your inbox.",
        );
      } else {
        Alert.alert("Error", data.message || "Failed to resend email");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to resend verification email");
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <LinearGradient colors={["#faf9f6", "#e8e6e1"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.content}>
            {/* LOGO */}
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>UNIVIBE</Text>
            </View>

            {/* SLOGAN */}
            <Text style={styles.sloganTitle}>Your Campus, Your Community,</Text>
            <Text style={styles.sloganSubtitle}>Your Vibe.</Text>

            {/* SIGN IN TEXT */}
            <Text style={styles.signInTitle}>SIGN IN</Text>

            {/* LOGIN FORM */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#6b7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrorMessage("");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isLoading}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#6b7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage("");
                  }}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>

              {/* Error Message + Forgot Password Row */}
              <View style={styles.passwordBottomRow}>
                {/* Error Message - Left Side */}
                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={14} color="#ef4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : (
                  <View style={{ flex: 1 }} />
                )}

                {/* Forgot Password - Right Side */}
                <TouchableOpacity
                  style={styles.forgotPassword}
                  onPress={() => router.push("/(auth)/forgot-password")}
                >
                  <Text style={styles.forgotPasswordText}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.disabledButton]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.loginButtonText}>SIGN IN</Text>
                )}
              </TouchableOpacity>


              {/* SIGN UP LINK */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>Don't have an account? </Text>
                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity disabled={isLoading}>
                    <Text style={styles.signUpLink}>Sign Up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Bright Verification Modal with Auto-Check */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showVerificationModal}
        onRequestClose={() => {
          setShowVerificationModal(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.verifyModalContent}>
            {/* Checking indicator */}
            {!isEmailVerified && (
              <View style={styles.checkingRow}>
                <ActivityIndicator size="small" color="#8b5cf6" />
                <Text style={styles.checkingText}>
                  Waiting for email verification...
                </Text>
              </View>
            )}

            {/* Verified state */}
            {isEmailVerified && (
              <View style={styles.verifiedRow}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.verifiedRowText}>
                  Email verified! Logging you in...
                </Text>
              </View>
            )}

            {/* Icon */}
            <View style={styles.verifyIconCircle}>
              <Ionicons
                name={
                  isEmailVerified ? "checkmark-circle" : "mail-open-outline"
                }
                size={48}
                color={isEmailVerified ? "#10b981" : "#8b5cf6"}
              />
            </View>

            {/* Title */}
            <Text style={styles.verifyModalTitle}>
              {isEmailVerified ? "Email Verified!" : "Check Your Email"}
            </Text>

            {/* Email */}
            <View style={styles.verifyEmailBadge}>
              <Ionicons name="mail" size={16} color="#8b5cf6" />
              <Text style={styles.verifyEmailText}>{email}</Text>
            </View>

            {/* Instructions - only show when not verified */}
            {!isEmailVerified && (
              <View style={styles.verifyInstructionsBox}>
                <View style={styles.verifyInstructionItem}>
                  <View style={styles.verifyStepNumber}>
                    <Text style={styles.verifyStepNumberText}>1</Text>
                  </View>
                  <Text style={styles.verifyInstructionText}>
                    Open your email inbox
                  </Text>
                </View>
                <View style={styles.verifyInstructionItem}>
                  <View style={styles.verifyStepNumber}>
                    <Text style={styles.verifyStepNumberText}>2</Text>
                  </View>
                  <Text style={styles.verifyInstructionText}>
                    Click the verification link
                  </Text>
                </View>
                <View style={styles.verifyInstructionItem}>
                  <View style={styles.verifyStepNumber}>
                    <Text style={styles.verifyStepNumberText}>3</Text>
                  </View>
                  <Text style={styles.verifyInstructionText}>
                    Return here - we'll log you in automatically!
                  </Text>
                </View>
              </View>
            )}

            {/* Resend Button */}
            {!isEmailVerified && (
              <TouchableOpacity
                style={[
                  styles.verifyResendBtn,
                  resendCooldown > 0 && styles.disabledButton,
                ]}
                onPress={handleResendVerification}
                disabled={resendCooldown > 0 || resendingEmail}
              >
                {resendingEmail ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <>
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color="#8b5cf6"
                    />
                    <Text style={styles.verifyResendBtnText}>
                      {resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : "Resend Email"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={styles.verifyCloseBtn}
              onPress={() => {
                setShowVerificationModal(false);
                if (pollingRef.current) clearInterval(pollingRef.current);
              }}
            >
              <Text style={styles.verifyCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "flex-start",
  },
  logoContainer: { alignItems: "center", marginTop: 20 },
  logoText: {
    fontSize: 48,
    color: "#1f2937",
    fontFamily: "Sofia-Regular",
    letterSpacing: 2,
  },
  sloganTitle: {
    marginTop: 10,
    color: "#4b5563",
    fontSize: 18,
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
  },
  sloganSubtitle: {
    color: "#4b5563",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "SofiaSans-Bold",
  },
  signInTitle: {
    color: "#1f2937",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "SofiaSans-Bold",
  },
  formContainer: { width: "100%", alignItems: "center" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "white",
    borderRadius: 30,
    marginBottom: 20,
    paddingHorizontal: 20,
    height: 56,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
    fontFamily: "SofiaSans-Regular",
  },
  eyeButton: { padding: 5 },
  //  Password bottom row with error + forgot password
  passwordBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 25,
    paddingHorizontal: 5,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    fontFamily: "SofiaSans-Medium",
    flexShrink: 1,
  },
  forgotPassword: {},
  forgotPasswordText: {
    color: "#8b5cf6",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
  loginButton: {
    width: "90%",
    padding: 16,
    borderRadius: 30,
    backgroundColor: "#8b5cf6",
    marginBottom: 30,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontFamily: "SofiaSans-SemiBold",
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "#d1d5db" },
  orText: {
    color: "#6b7280",
    fontSize: 16,
    marginHorizontal: 15,
    fontFamily: "SofiaSans-Medium",
  },
  continueWith: {
    color: "#6b7280",
    fontSize: 15,
    marginBottom: 20,
    fontFamily: "SofiaSans-Regular",
  },
  socialRow: { flexDirection: "row", marginBottom: 30, gap: 25 },
  socialButton: { padding: 10 },
  signUpContainer: { flexDirection: "row", justifyContent: "center" },
  signUpText: {
    color: "#6b7280",
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  signUpLink: {
    color: "#8b5cf6",
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: "SofiaSans-SemiBold",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  verifyModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  checkingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: "100%",
    gap: 10,
  },
  checkingText: {
    color: "#7C3AED",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: "100%",
    gap: 10,
  },
  verifiedRowText: {
    color: "#059669",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
  verifyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  verifyModalTitle: {
    fontSize: 22,
    color: "#1F2937",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  verifyEmailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  verifyEmailText: {
    color: "#4C1D95",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
  verifyInstructionsBox: {
    width: "100%",
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  verifyInstructionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  verifyStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  verifyStepNumberText: { color: "white", fontSize: 14, fontWeight: "700" },
  verifyInstructionText: {
    color: "#4B5563",
    fontSize: 14,
    flex: 1,
    fontFamily: "SofiaSans-Regular",
  },
  verifyResendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    width: "100%",
    marginBottom: 10,
    backgroundColor: "#F5F3FF",
    gap: 8,
  },
  verifyResendBtnText: {
    color: "#7C3AED",
    fontSize: 15,
    fontFamily: "SofiaSans-SemiBold",
  },
  verifyCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    width: "100%",
  },
  verifyCloseBtnText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    fontFamily: "SofiaSans-Medium",
  },
});
