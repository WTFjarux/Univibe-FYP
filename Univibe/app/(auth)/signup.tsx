// app/(auth)/signup.tsx
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
import { useAuth } from "../../lib/contexts/AuthContext";
import VerificationModal from "./VerificationModal";

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
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  const {
    signup: authSignup,
    token,
    checkVerificationStatus,
    resendVerificationEmail,
    refreshToken,
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
      await authSignup(fullName, email, password);
      setVerificationEmail(email);
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

  const handleCheckVerification = async () => {
    try {
      setIsCheckingVerification(true);
      const result = await checkVerificationStatus();

      if (result.isEmailVerified) {
        setIsEmailVerified(true);
        if (refreshToken) {
          await refreshToken();
        }
      } else {
        setIsEmailVerified(false);
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

  const handleVerificationComplete = async (newToken: string) => {
    try {
      if (refreshToken) {
        await refreshToken();
      }
      setIsEmailVerified(true);
      setShowVerificationModal(false);
      router.replace("/(auth)/setup-profile");
    } catch (error) {
      // Silently fail - user can retry
    }
  };

  const handleSetupProfile = async () => {
    try {
      setIsCheckingVerification(true);

      if (refreshToken) {
        await refreshToken();
      }

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

      setShowVerificationModal(false);
      router.replace("/(auth)/setup-profile");
    } catch (error) {
      Alert.alert("Error", "Failed to check verification");
    } finally {
      setIsCheckingVerification(false);
    }
  };

  useEffect(() => {
    let intervalId: number | null = null;

    if (showVerificationModal && !isEmailVerified) {
      intervalId = setInterval(async () => {
        try {
          const result = await checkVerificationStatus();
          if (result.isEmailVerified) {
            setIsEmailVerified(true);
            if (refreshToken) {
              await refreshToken();
            }
            if (intervalId) clearInterval(intervalId);
          }
        } catch (error) {
          // Silently fail
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    showVerificationModal,
    isEmailVerified,
    checkVerificationStatus,
    refreshToken,
  ]);

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

      <VerificationModal
        visible={showVerificationModal}
        email={verificationEmail}
        token={token}
        isEmailVerified={isEmailVerified}
        onClose={() => {
          setShowVerificationModal(false);
          setVerificationEmail("");
          setIsEmailVerified(false);
        }}
        onSetupProfile={handleSetupProfile}
        onResendVerification={handleResendVerification}
        onVerificationComplete={handleVerificationComplete}
        isChecking={isCheckingVerification}
      />
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
    fontWeight: "bold",
  },
  signUpTitle: {
    color: "#1f2937",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "bold",
  },
  formContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 40,
  },
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
  input: { flex: 1, fontSize: 16, color: "#1f2937" },
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
  },
  requirementMet: { color: "#10b981" },
  termsContainer: { marginBottom: 20, paddingHorizontal: 10 },
  termsText: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  termsLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
    color: "#8b5cf6",
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
    fontWeight: "600",
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
    fontFamily: "Sofia-Regular",
  },
  continueWith: { color: "#6b7280", fontSize: 15, marginBottom: 20 },
  socialRow: { flexDirection: "row", marginBottom: 30, gap: 25 },
  socialButton: { padding: 10 },
  signInContainer: { flexDirection: "row", justifyContent: "center" },
  signInText: { color: "#6b7280", fontSize: 14 },
  signInLink: {
    color: "#8b5cf6",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
