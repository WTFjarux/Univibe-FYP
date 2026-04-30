// app/(auth)/signup.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/contexts/AuthContext";
import { API_BASE_URL } from "../../constants/ipConstants";
import * as SecureStore from "expo-secure-store";

export default function SignUpScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedPasswordRef = useRef<string>("");

  const {
    signup: authSignup,
    resendVerificationEmail,
    login: authLogin,
  } = useAuth();

  const validateForm = (): boolean => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return false;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return false;
    }

    if (!/[A-Z]/.test(password)) {
      Alert.alert("Error", "Password must contain at least 1 capital letter");
      return false;
    }

    if (!/\d/.test(password)) {
      Alert.alert("Error", "Password must contain at least 1 number");
      return false;
    }

    if (!email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      // Save password for auto-login after verification
      savedPasswordRef.current = password;

      await authSignup(fullName, email, password);
      setVerificationEmail(email);
      setIsEmailVerified(false);
      setShowVerificationModal(true);
      clearForm();
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  // Auto-login after email verified
  const autoLoginAndProceed = async () => {
    try {
      setIsLoggingIn(true);

      // ✅ Use the AuthContext login function which updates state
      await authLogin(verificationEmail, savedPasswordRef.current);

      // Clean up
      setShowVerificationModal(false);
      savedPasswordRef.current = "";

      // AuthContext now has the token and user state updated
      router.replace("/(auth)/setup-profile");
    } catch (error: any) {
      console.log("🔴 Auto-login error:", error.message);
      Alert.alert("Error", "Failed to authenticate. Please login manually.", [
        {
          text: "Go to Login",
          onPress: () => {
            setShowVerificationModal(false);
            router.replace("/(auth)/login");
          },
        },
      ]);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Auto-check verification status every 3 seconds
  useEffect(() => {
    if (showVerificationModal && !isEmailVerified) {
      checkVerificationStatus();

      pollingRef.current = setInterval(() => {
        checkVerificationStatus();
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [showVerificationModal, isEmailVerified]);

  // When verified, auto-login
  useEffect(() => {
    if (isEmailVerified && showVerificationModal) {
      // Small delay to show the verified state
      const timer = setTimeout(() => {
        autoLoginAndProceed();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isEmailVerified]);

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
      const response = await fetch(
        `${API_BASE_URL}/api/auth/check-verification-by-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: verificationEmail }),
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
      // Silent fail - will retry on next poll
    }
  };

  const handleResendVerification = async () => {
    try {
      const result = await resendVerificationEmail(verificationEmail);

      if (result.success) {
        setResendCooldown(60);
        Alert.alert("Email Sent", "New verification email sent!");
      } else {
        Alert.alert("Error", result.message || "Failed to resend email");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to resend verification email");
    }
  };

  const handleCloseModal = () => {
    setShowVerificationModal(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    savedPasswordRef.current = "";
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return (
    <LinearGradient colors={["#faf9f6", "#e8e6e1"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>UNIVIBE</Text>
            </View>

            <Text style={styles.sloganTitle}>Your Campus, Your Community,</Text>
            <Text style={styles.sloganSubtitle}>Your Vibe.</Text>

            <Text style={styles.signUpTitle}>SIGN UP</Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#6b7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#9ca3af"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

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
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isLoading}
                />
              </View>

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
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={22}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#6b7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#9ca3af"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-outline" : "eye-off-outline"
                    }
                    size={22}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordRequirements}>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={
                      password.length >= 6 ? "checkmark-circle" : "close-circle"
                    }
                    size={16}
                    color={password.length >= 6 ? "#10b981" : "#ef4444"}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      password.length >= 6 && styles.requirementMet,
                    ]}
                  >
                    At least 6 characters
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={
                      /[A-Z]/.test(password)
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={/[A-Z]/.test(password) ? "#10b981" : "#ef4444"}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      /[A-Z]/.test(password) && styles.requirementMet,
                    ]}
                  >
                    At least 1 capital letter
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={
                      /\d/.test(password) ? "checkmark-circle" : "close-circle"
                    }
                    size={16}
                    color={/\d/.test(password) ? "#10b981" : "#ef4444"}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      /\d/.test(password) && styles.requirementMet,
                    ]}
                  >
                    At least 1 number
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={
                      password &&
                      confirmPassword &&
                      password === confirmPassword
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      password &&
                      confirmPassword &&
                      password === confirmPassword
                        ? "#10b981"
                        : "#ef4444"
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      password &&
                        confirmPassword &&
                        password === confirmPassword &&
                        styles.requirementMet,
                    ]}
                  >
                    Passwords match
                  </Text>
                </View>
              </View>

              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  By signing up, you agree to our{" "}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.signUpButton,
                  isLoading && styles.disabledButton,
                ]}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.signUpButtonText}>SIGN UP</Text>
                )}
              </TouchableOpacity>

              <View style={styles.orContainer}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>

              <Text style={styles.continueWith}>Continue with</Text>

              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.socialButton}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-google" size={35} color="#4b5563" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.socialButton}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-apple" size={35} color="#4b5563" />
                </TouchableOpacity>
              </View>

              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity disabled={isLoading}>
                    <Text style={styles.signInLink}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Bright Modern Verification Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showVerificationModal}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Loading Indicator */}
            {!isEmailVerified && !isLoggingIn && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#8b5cf6" />
                <Text style={styles.loadingText}>
                  Waiting for email verification...
                </Text>
              </View>
            )}

            {/* Logging in state */}
            {isLoggingIn && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={[styles.loadingText, { color: "#10b981" }]}>
                  Setting up your account...
                </Text>
              </View>
            )}

            {/* Icon */}
            <View style={styles.iconCircle}>
              <Ionicons
                name={
                  isEmailVerified
                    ? "checkmark-circle"
                    : isLoggingIn
                      ? "hourglass-outline"
                      : "mail-outline"
                }
                size={48}
                color={
                  isEmailVerified
                    ? "#10b981"
                    : isLoggingIn
                      ? "#8b5cf6"
                      : "#8b5cf6"
                }
              />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>
              {isEmailVerified
                ? "Email Verified!"
                : isLoggingIn
                  ? "Almost there..."
                  : "Check Your Email"}
            </Text>

            {/* Email display */}
            <View style={styles.emailBadge}>
              <Ionicons name="mail" size={16} color="#8b5cf6" />
              <Text style={styles.emailBadgeText}>{verificationEmail}</Text>
            </View>

            {/* Instructions */}
            {!isEmailVerified && !isLoggingIn && (
              <View style={styles.instructionsBox}>
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.instructionItemText}>
                    Open your email inbox
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.instructionItemText}>
                    Click the verification link
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.instructionItemText}>
                    Come back here - we'll take care of the rest!
                  </Text>
                </View>
              </View>
            )}

            {/* Verified message */}
            {isEmailVerified && !isLoggingIn && (
              <View style={styles.verifiedBox}>
                <Ionicons name="sparkles" size={20} color="#10b981" />
                <Text style={styles.verifiedText}>
                  Redirecting you to profile setup...
                </Text>
              </View>
            )}

            {/* Resend Button */}
            {!isEmailVerified && !isLoggingIn && (
              <TouchableOpacity
                style={[
                  styles.resendBtn,
                  resendCooldown > 0 && styles.disabledButton,
                ]}
                onPress={handleResendVerification}
                disabled={resendCooldown > 0}
              >
                <Ionicons name="refresh-outline" size={18} color="#8b5cf6" />
                <Text style={styles.resendBtnText}>
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend Email"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleCloseModal}
            >
              <Text style={styles.closeBtnText}>Close</Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: { alignItems: "center", marginTop: 10 },
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
  signUpTitle: {
    color: "#1f2937",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "SofiaSans-Bold",
  },
  formContainer: { width: "100%", alignItems: "center", marginBottom: 40 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "white",
    borderRadius: 30,
    marginBottom: 15,
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
  passwordRequirements: { width: "100%", padding: 15, marginBottom: 15 },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  requirementText: {
    color: "#6b7280",
    fontSize: 13,
    marginLeft: 8,
    fontFamily: "SofiaSans-Regular",
  },
  requirementMet: { color: "#10b981" },
  termsContainer: { marginBottom: 20, paddingHorizontal: 10 },
  termsText: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    fontFamily: "SofiaSans-Regular",
  },
  termsLink: {
    textDecorationLine: "underline",
    color: "#8b5cf6",
    fontFamily: "SofiaSans-SemiBold",
  },
  signUpButton: {
    width: "90%",
    padding: 16,
    borderRadius: 30,
    backgroundColor: "#8b5cf6",
    marginBottom: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: { opacity: 0.6 },
  signUpButtonText: {
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
  signInContainer: { flexDirection: "row", justifyContent: "center" },
  signInText: {
    color: "#6b7280",
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  signInLink: {
    color: "#8b5cf6",
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: "SofiaSans-SemiBold",
  },
  // Modal Styles - Bright & Modern
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
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
  loadingRow: {
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
  loadingText: {
    color: "#7C3AED",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    color: "#1F2937",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  emailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  emailBadgeText: {
    color: "#4C1D95",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
  instructionsBox: {
    width: "100%",
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  instructionItemText: {
    color: "#4B5563",
    fontSize: 14,
    flex: 1,
    fontFamily: "SofiaSans-Regular",
  },
  verifiedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: "100%",
    gap: 8,
  },
  verifiedText: {
    color: "#059669",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
  resendBtn: {
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
  resendBtnText: {
    color: "#7C3AED",
    fontSize: 15,
    fontFamily: "SofiaSans-SemiBold",
  },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    width: "100%",
  },
  closeBtnText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    fontFamily: "SofiaSans-Medium",
  },
});
