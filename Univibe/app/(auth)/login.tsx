import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import React, { useState } from "react";
import { API_BASE_URL } from "../../constants/stringConstants";
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
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      await login(email, password);
      // Navigate to main app after successful login
      router.replace("../(tabs)");
    } catch (error: any) {
      // Debug logging
      console.log("🔍 Login error:", error.message);

      // Check for email verification error - using case insensitive check
      const errorMsg = error.message || "";
      if (
        errorMsg.toLowerCase().includes("verify your email") ||
        errorMsg.toLowerCase().includes("email not verified") ||
        errorMsg.toLowerCase().includes("verification")
      ) {
        // Show verification modal instead of alert
        setShowVerificationModal(true);
      } else if (
        errorMsg.toLowerCase().includes("invalid email") ||
        errorMsg.toLowerCase().includes("invalid password")
      ) {
        Alert.alert("Login Failed", "Invalid email or password");
      } else {
        Alert.alert("Login Failed", errorMsg || "An error occurred");
      }
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    try {
      setResendingEmail(true);
      setResendSuccess(false);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          "Error",
          data.message || "Failed to resend verification email"
        );
        return;
      }

      setResendSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (error) {
      Alert.alert("Error", "Failed to resend verification email");
    } finally {
      setResendingEmail(false);
    }
  };

  const VerificationModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showVerificationModal}
      onRequestClose={() => setShowVerificationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name="mail-outline" size={60} color="#6C63FF" />
            <Text style={styles.modalTitle}>Email Verification Required</Text>
          </View>

          <Text style={styles.modalText}>
            Please verify your email address before logging in. Check your inbox
            for the verification email we sent to:
          </Text>

          <View style={styles.emailContainer}>
            <Ionicons
              name="mail"
              size={20}
              color="#6C63FF"
              style={styles.emailIcon}
            />
            <Text style={styles.emailText}>{email}</Text>
          </View>

          <Text style={styles.modalSubtext}>
            Can't find the email? Check your spam folder or resend it below.
          </Text>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendVerification}
            disabled={resendingEmail}
          >
            {resendingEmail ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color="#FFF" />
                <Text style={styles.resendButtonText}>
                  Resend Verification Email
                </Text>
              </>
            )}
          </TouchableOpacity>

          {resendSuccess && (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.successText}>
                Verification email sent! Please check your inbox.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowVerificationModal(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <LinearGradient
      colors={["#9f95b6ff", "#17151aff"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.content}>
            {/* LOGO - Using Sofia-Regular */}
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
                  color="white"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={email}
                  onChangeText={setEmail}
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
                  color="white"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.7)"
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
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

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

              {/* OR SECTION */}
              <View style={styles.orContainer}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>

              <Text style={styles.continueWith}>Continue with</Text>

              {/* SOCIAL LOGINS */}
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialButton}>
                  <Ionicons name="logo-google" size={35} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                  <Ionicons name="logo-apple" size={35} color="white" />
                </TouchableOpacity>
              </View>

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

      {/* Verification Modal */}
      <VerificationModal />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "flex-start",
  },
  // Logo
  logoContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  logoText: {
    fontSize: 48,
    color: "white",
    fontFamily: "Sofia-Regular",
    letterSpacing: 2,
  },
  // Slogan
  sloganTitle: {
    marginTop: 10,
    color: "white",
    fontSize: 18,
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
  },
  sloganSubtitle: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "bold",
  },
  // Sign In Title
  signInTitle: {
    color: "white",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 30,
    fontWeight: "bold",
  },
  // Form Container
  formContainer: {
    width: "100%",
    alignItems: "center",
  },
  // Input Fields
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 30,
    marginBottom: 20,
    paddingHorizontal: 20,
    height: 56,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "white",
  },
  eyeButton: {
    padding: 5,
  },
  // Forgot Password
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 25,
  },
  forgotPasswordText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  // Login Button
  loginButton: {
    width: "90%",
    padding: 16,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginBottom: 30,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  // OR Section
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  orText: {
    color: "white",
    fontSize: 16,
    marginHorizontal: 15,
    fontWeight: "500",
  },
  continueWith: {
    color: "white",
    fontSize: 15,
    marginBottom: 20,
  },
  // Social login icons
  socialRow: {
    flexDirection: "row",
    marginBottom: 30,
    gap: 25,
  },
  socialButton: {
    padding: 10,
  },
  // Sign Up Link
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  signUpText: {
    color: "white",
    fontSize: 14,
  },
  signUpLink: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  // Verification Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#2A2840",
    borderRadius: 20,
    padding: 25,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginTop: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 15,
  },
  modalSubtext: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    fontStyle: "italic",
  },
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(108, 99, 255, 0.1)",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(108, 99, 255, 0.3)",
    width: "100%",
  },
  emailIcon: {
    marginRight: 10,
  },
  emailText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6C63FF",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    marginBottom: 15,
    gap: 10,
  },
  resendButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 15,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.3)",
  },
  successText: {
    color: "#4CAF50",
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    width: "100%",
  },
  closeButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
});
