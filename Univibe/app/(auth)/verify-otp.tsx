// app/(auth)/verify-otp.tsx

import React, { useState, useRef, useEffect } from "react";
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

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown((prev) => prev - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (text: string, index: number) => {
    // Only allow digits
    if (text && !/^\d$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError("");

    // Auto-advance to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits entered
    if (text && index === 5) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === 6) {
        setTimeout(() => handleVerifyOTP(fullOtp), 300);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // Move to previous input on backspace if current is empty
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpString?: string) => {
    const otpCode = otpString || otp.join("");

    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const data = await response.json();

      if (data.success && data.resetToken) {
        // Navigate to reset password with token
        router.replace({
          pathname: "/(auth)/reset-password",
          params: { resetToken: data.resetToken },
        });
      } else {
        setError(data.message || "Invalid OTP. Please try again.");
        if (data.code === "OTP_INVALID" || data.code === "OTP_MAX_ATTEMPTS") {
          // Clear OTP on invalid
          setOtp(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (error) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert("OTP Sent", "A new OTP has been sent to your email.");
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert("Error", data.message || "Failed to resend OTP");
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please check your connection.");
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
            {/* Icon */}
            <View style={styles.iconCircle}>
              <Ionicons name="keypad-outline" size={40} color="#8b5cf6" />
            </View>

            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>

            {/* Email Badge */}
            <View style={styles.emailBadge}>
              <Ionicons name="mail" size={16} color="#8b5cf6" />
              <Text style={styles.emailBadgeText}>{email}</Text>
            </View>

            {/* OTP Inputs */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                    error ? styles.otpInputError : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, index)
                  }
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!loading}
                />
              ))}
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={() => handleVerifyOTP()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryButtonText}>Verify OTP</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>Didn't receive the code? </Text>
              {resendCooldown > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend in {resendCooldown}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOTP}>
                  <Text style={styles.linkText}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Back */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={16} color="#6b7280" />
              <Text style={styles.backButtonText}>Change email</Text>
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
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
    marginBottom: 12,
  },
  emailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 10,
  },
  emailBadgeText: {
    color: "#4C1D95",
    fontSize: 15,
    fontFamily: "SofiaSans-Medium",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    fontFamily: "SofiaSans-Bold",
  },
  otpInputFilled: {
    borderColor: "#8b5cf6",
    backgroundColor: "#F5F3FF",
  },
  otpInputError: {
    borderColor: "#ef4444",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: "100%",
    gap: 8,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 13,
    fontFamily: "SofiaSans-Medium",
    flex: 1,
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
  cooldownText: {
    color: "#9ca3af",
    fontSize: 14,
    fontFamily: "SofiaSans-Medium",
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
