import React, { useState, useEffect } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import VerificationModal from "./VerificationModal";

export default function SignUpScreen() {
  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  const {
    signup: authSignup,
    checkVerificationStatus,
    resendVerificationEmail,
  } = useAuth();

  /**
   * Validate form and register new user
   * Shows verification modal on successful registration
   */
  const handleSignUp = async () => {
    // Form validation
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      Alert.alert("Error", "Password must contain at least 1 capital letter");
      return;
    }

    if (!/\d/.test(password)) {
      Alert.alert("Error", "Password must contain at least 1 number");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    try {
      setIsLoading(true);

      // Create user account
      await authSignup(fullName, email, password);

      // Show verification modal
      setVerificationEmail(email);
      setShowVerificationModal(true);
      clearForm();
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear all form fields after successful registration
   */
  const clearForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  /**
   * Check email verification status
   * Only shows alert when manually checked outside modal
   */
  const handleCheckVerification = async () => {
    try {
      setIsCheckingVerification(true);
      const result = await checkVerificationStatus();

      if (result.isEmailVerified) {
        setIsEmailVerified(true);
        // No alert - modal will update to show verified state
      } else {
        setIsEmailVerified(false);
        // Only alert if checking from outside modal
        if (!showVerificationModal) {
          Alert.alert(
            "Not Verified Yet",
            "Your email is still pending verification.",
            [
              { text: "OK", style: "cancel" },
              {
                text: "Resend Email",
                onPress: handleResendVerification,
              },
            ],
          );
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to check verification status");
    } finally {
      setIsCheckingVerification(false);
    }
  };

  /**
   * Resend verification email to user
   */
  const handleResendVerification = async () => {
    try {
      const result = await resendVerificationEmail(verificationEmail);

      if (result.success) {
        Alert.alert("Email Sent", "New verification email sent");
      } else {
        Alert.alert("Error", result.message || "Failed to resend email");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to resend verification email");
    }
  };

  /**
   * Navigate to profile setup if email is verified
   * Shows alert if verification is still pending
   */
  const handleSetupProfile = async () => {
    try {
      setIsCheckingVerification(true);
      const result = await checkVerificationStatus();

      if (!result.isEmailVerified) {
        Alert.alert(
          "Email Verification Required",
          "Please verify your email before setting up your profile.",
          [
            { text: "OK", style: "cancel" },
            {
              text: "Check Status",
              onPress: handleCheckVerification,
            },
            {
              text: "Resend Email",
              onPress: handleResendVerification,
            },
          ],
        );
        return;
      }

      // Verified - proceed to profile setup
      setShowVerificationModal(false);
      router.replace("/(auth)/setup-profile");
    } catch (error) {
      Alert.alert("Error", "Failed to check verification");
    } finally {
      setIsCheckingVerification(false);
    }
  };

  /**
   * Auto-poll verification status while modal is open
   * Silently updates state without alerts
   */
  useEffect(() => {
    let intervalId: any;

    if (showVerificationModal && !isEmailVerified) {
      // Check every 10 seconds for verification
      intervalId = setInterval(async () => {
        try {
          const result = await checkVerificationStatus();
          if (result.isEmailVerified) {
            setIsEmailVerified(true);
            clearInterval(intervalId);
          }
        } catch (error) {
          // Silently fail - user can check manually
        }
      }, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showVerificationModal, isEmailVerified, checkVerificationStatus]);

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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>UNIVIBE</Text>
            </View>

            {/* Slogan */}
            <Text style={styles.sloganTitle}>Your Campus, Your Community,</Text>
            <Text style={styles.sloganSubtitle}>Your Vibe.</Text>

            {/* Form header */}
            <Text style={styles.signUpTitle}>SIGN UP</Text>

            {/* Registration form */}
            <View style={styles.formContainer}>
              {/* Full Name */}
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="white"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              {/* Email */}
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

              {/* Password */}
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
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={22}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="white"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="rgba(255,255,255,0.7)"
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
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>

              {/* Password requirements */}
              <View style={styles.passwordRequirements}>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={
                      password.length >= 6 ? "checkmark-circle" : "close-circle"
                    }
                    size={16}
                    color={password.length >= 6 ? "#4CAF50" : "#FF5252"}
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
                    color={/[A-Z]/.test(password) ? "#4CAF50" : "#FF5252"}
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
                    color={/\d/.test(password) ? "#4CAF50" : "#FF5252"}
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
                        ? "#4CAF50"
                        : "#FF5252"
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

              {/* Terms agreement */}
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  By signing up, you agree to our{" "}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>

              {/* Sign up button */}
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

              {/* Divider */}
              <View style={styles.orContainer}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>

              <Text style={styles.continueWith}>Continue with</Text>

              {/* Social login */}
              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.socialButton}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-google" size={35} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.socialButton}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-apple" size={35} color="white" />
                </TouchableOpacity>
              </View>

              {/* Sign in link */}
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

      {/* Verification Modal */}
      <VerificationModal
        visible={showVerificationModal}
        email={verificationEmail}
        isEmailVerified={isEmailVerified}
        onClose={() => {
          setShowVerificationModal(false);
          setVerificationEmail("");
          setIsEmailVerified(false);
        }}
        onSetupProfile={handleSetupProfile}
        onResendVerification={handleResendVerification}
        isChecking={isCheckingVerification}
      />
    </LinearGradient>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Logo styles
  logoContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  logoText: {
    fontSize: 48,
    color: "white",
    fontFamily: "Sofia-Regular",
    letterSpacing: 2,
  },

  // Slogan styles
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

  // Sign up title
  signUpTitle: {
    color: "white",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "SofiaSans-Bold",
  },

  // Form container
  formContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 40,
  },

  // Input fields
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 30,
    marginBottom: 15,
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

  // Password requirements
  passwordRequirements: {
    width: "100%",
    padding: 15,
    marginBottom: 15,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  requirementText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    marginLeft: 8,
  },
  requirementMet: {
    color: "#4CAF50",
  },

  // Terms agreement
  termsContainer: {
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  termsText: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  termsLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // Sign up button
  signUpButton: {
    width: "90%",
    padding: 16,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderWidth: 1,
    marginBottom: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },

  // OR divider
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
    fontFamily: "Sofia-Regular",
  },
  continueWith: {
    color: "white",
    fontSize: 15,
    marginBottom: 20,
  },

  // Social login buttons
  socialRow: {
    flexDirection: "row",
    marginBottom: 30,
    gap: 25,
  },
  socialButton: {
    padding: 10,
  },

  // Sign in link
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  signInText: {
    color: "white",
    fontSize: 14,
  },
  signInLink: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
