// app/(auth)/reset-password.tsx

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
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../constants/ipConstants";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { resetToken } = useLocalSearchParams<{ resetToken: string }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (!resetToken) {
      Alert.alert("Error", "Invalid reset session. Please start over.");
      router.replace("/(auth)/forgot-password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        Alert.alert("Error", data.message || "Failed to reset password");
        if (
          data.code === "RESET_TOKEN_EXPIRED" ||
          data.code === "INVALID_RESET_TOKEN"
        ) {
          router.replace("/(auth)/forgot-password");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <LinearGradient colors={["#faf9f6", "#e8e6e1"]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={styles.content}>
            {/* Success Icon */}
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={60} color="#10b981" />
            </View>

            <Text style={styles.title}>Password Reset!</Text>
            <Text style={styles.subtitle}>
              Your password has been successfully reset. You can now login with
              your new password.
            </Text>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#8b5cf6"
              />
              <Text style={styles.infoText}>
                For security, you've been logged out of all devices. Please
                login again.
              </Text>
            </View>

            {/* Go to Login */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Ionicons
                name="log-in-outline"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Password input state
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
              <Ionicons
                name="shield-checkmark-outline"
                size={40}
                color="#8b5cf6"
              />
            </View>

            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your new password below.</Text>

            {/* New Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#6b7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#9ca3af"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
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

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#6b7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>

            {/* Password Requirements */}
            <View style={styles.requirementsBox}>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={
                    newPassword.length >= 6
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={16}
                  color={newPassword.length >= 6 ? "#10b981" : "#d1d5db"}
                />
                <Text
                  style={[
                    styles.requirementText,
                    newPassword.length >= 6 && styles.requirementMet,
                  ]}
                >
                  At least 6 characters
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={
                    newPassword &&
                    confirmPassword &&
                    newPassword === confirmPassword
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={16}
                  color={
                    newPassword &&
                    confirmPassword &&
                    newPassword === confirmPassword
                      ? "#10b981"
                      : "#d1d5db"
                  }
                />
                <Text
                  style={[
                    styles.requirementText,
                    newPassword &&
                      confirmPassword &&
                      newPassword === confirmPassword &&
                      styles.requirementMet,
                  ]}
                >
                  Passwords match
                </Text>
              </View>
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-outline"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryButtonText}>Reset Password</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Back */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={16} color="#6b7280" />
              <Text style={styles.backButtonText}>Back</Text>
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
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ECFDF5",
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
    marginBottom: 28,
    paddingHorizontal: 10,
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
    marginBottom: 16,
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
  requirementsBox: {
    width: "100%",
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    color: "#9ca3af",
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
  },
  requirementMet: {
    color: "#10b981",
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
