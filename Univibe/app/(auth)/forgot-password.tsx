// app/(auth)/forgot-password.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../../constants/ipConstants";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
  };

  const handleSendOTP = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await response.json();

      if (data.success) {
        setEmailSent(true);
      } else {
        Alert.alert(
          "Error",
          data.message || "Failed to send OTP. Please try again.",
        );
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Email sent state
  if (emailSent) {
    return (
      <LinearGradient colors={["#faf9f6", "#e8e6e1"]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.content}>
              {/* Icon */}
              <View style={styles.iconCircle}>
                <Ionicons name="mail" size={48} color="#8b5cf6" />
              </View>

              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.subtitle}>We've sent a 6-digit OTP to</Text>

              {/* Email Badge */}
              <View style={styles.emailBadge}>
                <Ionicons name="mail" size={16} color="#8b5cf6" />
                <Text style={styles.emailBadgeText}>
                  {email.trim().toLowerCase()}
                </Text>
              </View>

              {/* Info Card */}
              <View style={styles.infoCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#8b5cf6"
                />
                <Text style={styles.infoText}>
                  The OTP is valid for 10 minutes. Check your spam folder if you
                  don't see it.
                </Text>
              </View>

              {/* Enter OTP Button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/verify-otp",
                    params: { email: email.trim().toLowerCase() },
                  })
                }
              >
                <Ionicons
                  name="keypad-outline"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryButtonText}>Enter OTP</Text>
              </TouchableOpacity>

              {/* Resend */}
              <View style={styles.bottomRow}>
                <Text style={styles.bottomText}>Didn't receive the code? </Text>
                <TouchableOpacity onPress={handleSendOTP}>
                  <Text style={styles.linkText}>Resend OTP</Text>
                </TouchableOpacity>
              </View>

              {/* Back */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setEmailSent(false)}
              >
                <Ionicons name="arrow-back" size={16} color="#6b7280" />
                <Text style={styles.backButtonText}>Try a different email</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Email input state
  return (
    <LinearGradient colors={["#faf9f6", "#e8e6e1"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={40} color="#8b5cf6" />
            </View>

            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a 6-digit OTP to reset
              your password.
            </Text>

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
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            {/* Send OTP Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSendOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name="send"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={16} color="#6b7280" />
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    paddingTop: 80,
    alignItems: "center",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    color: "#1f2937",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "SofiaSans-Regular",
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  emailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  emailBadgeText: {
    color: "#4C1D95",
    fontSize: 15,
    fontFamily: "SofiaSans-Medium",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    width: "100%",
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: "#6D28D9",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "SofiaSans-Regular",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "white",
    borderRadius: 30,
    marginBottom: 24,
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
  primaryButton: {
    width: "100%",
    padding: 16,
    borderRadius: 30,
    backgroundColor: "#8b5cf6",
    marginBottom: 20,
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
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "SofiaSans-SemiBold",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  bottomText: {
    color: "#6b7280",
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  linkText: {
    color: "#8b5cf6",
    fontSize: 14,
    fontFamily: "SofiaSans-SemiBold",
    textDecorationLine: "underline",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backButtonText: {
    color: "#6b7280",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
  },
});
