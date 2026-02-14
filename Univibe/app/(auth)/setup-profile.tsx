import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { profileService } from "../../lib/profileService";
import { API_BASE_URL } from "../../constants/stringConstants";

export default function SetupProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const [formData, setFormData] = useState({
    username: "",
    major: "",
    year: "",
    graduationYear: String(new Date().getFullYear() + 1),
    bio: "",
    pronouns: "",
    universityEmail: "",
  });

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState({
    loading: false,
    available: false,
    error: "",
  });

  // Debounced username check
  useEffect(() => {
    const checkUsername = async () => {
      if (!formData.username.trim()) {
        setUsernameStatus({
          loading: false,
          available: false,
          error: "",
        });
        return;
      }

      const validUsernameRegex = /^[a-zA-Z0-9_.-]+$/;
      if (!validUsernameRegex.test(formData.username)) {
        setUsernameStatus({
          loading: false,
          available: false,
          error:
            "Only letters, numbers, underscores, dots and hyphens are allowed",
        });
        return;
      }

      // Check length
      if (formData.username.length < 3) {
        setUsernameStatus({
          loading: false,
          available: false,
          error: "Must be at least 3 characters",
        });
        return;
      }

      if (formData.username.length > 20) {
        setUsernameStatus({
          loading: false,
          available: false,
          error: "Must be less than 20 characters",
        });
        return;
      }

      // Check availability via API
      setUsernameStatus((prev) => ({ ...prev, loading: true }));

      try {
        const token = await SecureStore.getItemAsync("authToken");
        if (!token) {
          setUsernameStatus({
            loading: false,
            available: false,
            error: "Authentication required",
          });
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/profile/check-username/${formData.username}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        // ✅ IMPORTANT: Parse the JSON response
        const data = await response.json();

        if (response.status === 200 && data.available === true) {
          // Username is available
          setUsernameStatus({
            loading: false,
            available: true,
            error: "",
          });
        } else if (response.status === 409 || data.success === false) {
          // Username already taken
          setUsernameStatus({
            loading: false,
            available: false,
            error: "Username already taken",
          });
        } else {
          setUsernameStatus({
            loading: false,
            available: false,
            error: data.message || "Failed to check username",
          });
        }
      } catch (error) {
        console.error("Username check error:", error);
        setUsernameStatus({
          loading: false,
          available: false,
          error: "Network error. Please try again.",
        });
      }
    };

    // Debounce the API call
    const timer = setTimeout(() => {
      checkUsername();
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [formData.username]);

  // Handle profile submission
  const handleSubmit = async () => {
    // Validate form
    if (
      !formData.username ||
      !formData.major ||
      !formData.year ||
      !formData.universityEmail
    ) {
      Alert.alert("Required Fields", "Please fill in all required fields (*)");
      return;
    }

    // Validate username
    if (usernameStatus.loading) {
      Alert.alert("Please Wait", "Checking username availability...");
      return;
    }

    if (usernameStatus.error && !usernameStatus.available) {
      Alert.alert("Invalid Username", usernameStatus.error);
      return;
    }

    if (!formData.universityEmail.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      // Check for authentication token
      const token = await SecureStore.getItemAsync("authToken");

      if (!token) {
        Alert.alert("Session Expired", "Please log in again to continue.", [
          { text: "OK", onPress: () => router.replace("/(auth)/login") },
        ]);
        return;
      }

      // Setup profile using profile service
      const response = await profileService.setupProfile({
        ...formData,
        fullName: formData.username,
      });

      // Handle successful response
      if (response.success) {
        // Save user data to SecureStore
        if (response.data?.user) {
          await SecureStore.setItemAsync(
            "user_data",
            JSON.stringify({
              _id: response.data.user._id,
              username: response.data.user.username,
              email: response.data.user.email,
              profileComplete: response.data.user.profileComplete,
            }),
          );
        }

        // Save profile data to SecureStore
        if (response.data?.profile) {
          await SecureStore.setItemAsync(
            "profile_data",
            JSON.stringify(response.data.profile),
          );
        }

        // Mark profile as complete
        await SecureStore.setItemAsync("profile_complete", "true");

        Alert.alert(
          "Profile Complete",
          "Your profile has been set up successfully!",
          [
            {
              text: "Get Started",
              onPress: () => router.replace("../(tabs)"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Setup Failed",
          response.message || "Unable to setup profile",
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Unable to complete profile setup");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    // Validate username before proceeding to step 2
    if (activeStep === 1) {
      if (usernameStatus.loading) {
        Alert.alert("Please Wait", "Checking username availability...");
        return;
      }

      if (usernameStatus.error && !usernameStatus.available) {
        Alert.alert("Invalid Username", usernameStatus.error);
        return;
      }

      if (!formData.username.trim()) {
        Alert.alert("Username Required", "Please enter a username");
        return;
      }
    }

    if (activeStep < 2) setActiveStep(activeStep + 1);
  };

  const prevStep = () => {
    if (activeStep > 1) setActiveStep(activeStep - 1);
  };

  // Username validation indicator
  const renderUsernameValidation = () => {
    if (!formData.username.trim()) return null;

    if (usernameStatus.loading) {
      return (
        <View style={styles.validationContainer}>
          <ActivityIndicator size="small" color="#4f46e5" />
          <Text style={styles.validationTextLoading}>
            Checking username availability...
          </Text>
        </View>
      );
    }

    if (usernameStatus.error) {
      return (
        <View style={styles.validationContainer}>
          <Ionicons name="close-circle" size={16} color="#ef4444" />
          <Text style={styles.validationTextError}>{usernameStatus.error}</Text>
        </View>
      );
    }

    if (usernameStatus.available) {
      return (
        <View style={styles.validationContainer}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.validationTextSuccess}>Username available</Text>
        </View>
      );
    }

    return null;
  };

  // Step indicator component
  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepCirclesContainer}>
        {[1, 2].map((step) => (
          <View key={step} style={styles.stepWithLine}>
            <View
              style={[
                styles.stepCircle,
                activeStep >= step
                  ? styles.stepCircleActive
                  : styles.stepCircleInactive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  activeStep >= step
                    ? styles.stepNumberActive
                    : styles.stepNumberInactive,
                ]}
              >
                {step}
              </Text>
            </View>
            {step < 2 && (
              <View
                style={[
                  styles.stepLine,
                  activeStep > step
                    ? styles.stepLineActive
                    : styles.stepLineInactive,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      <View style={styles.stepLabelsContainer}>
        {[
          { id: 1, label: "Basic Info" },
          { id: 2, label: "Academic Details" },
        ].map((step) => (
          <View key={step.id} style={styles.stepLabelWrapper}>
            <Text
              style={[
                styles.stepLabel,
                activeStep === step.id
                  ? styles.stepLabelActive
                  : styles.stepLabelInactive,
              ]}
            >
              {step.label}
            </Text>
            {activeStep === step.id && <View style={styles.activeUnderline} />}
          </View>
        ))}
      </View>
    </View>
  );

  // Navigation buttons
  const renderButtons = () => (
    <View
      style={[
        styles.buttonContainer,
        { justifyContent: activeStep > 1 ? "space-between" : "flex-end" },
      ]}
    >
      {activeStep > 1 && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={prevStep}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={18} color="#4f46e5" />
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      )}

      {activeStep < 2 ? (
        <TouchableOpacity
          style={[
            styles.primaryButton,
            usernameStatus.error &&
              !usernameStatus.available &&
              styles.disabledButton,
          ]}
          onPress={nextStep}
          disabled={
            loading ||
            (Boolean(usernameStatus.error) && !usernameStatus.available)
          }
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="white" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Complete Profile</Text>
              <Ionicons name="checkmark-circle" size={18} color="white" />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <LinearGradient colors={["#f8fafc", "#f1f5f9"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#4f46e5" />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.title}>Complete Your Profile</Text>
                <Text style={styles.subtitle}>
                  {activeStep === 1 &&
                    "Let's start with your basic information"}
                  {activeStep === 2 && "Tell us about your academic background"}
                </Text>
              </View>
            </View>

            {/* Progress Indicator */}
            <StepIndicator />

            {/* Form */}
            <View style={styles.formCard}>
              {/* Step 1: Basic Info */}
              {activeStep === 1 && (
                <View style={styles.stepContent}>
                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons
                        name="person-circle-outline"
                        size={18}
                        color="#4f46e5"
                      />
                      <Text style={styles.label}>Username *</Text>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        usernameStatus.error && styles.inputError,
                        usernameStatus.available && styles.inputSuccess,
                      ]}
                      placeholder="@ username"
                      placeholderTextColor="#9ca3af"
                      value={formData.username}
                      onChangeText={(text) =>
                        setFormData({ ...formData, username: text })
                      }
                      autoCapitalize="none"
                      returnKeyType="next"
                      maxLength={20}
                    />
                    {renderUsernameValidation()}
                    <Text style={styles.inputHint}>
                      You can not change this later.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <MaterialIcons name="badge" size={18} color="#4f46e5" />
                      <Text style={styles.label}>Pronouns</Text>
                    </View>
                    <View style={styles.pronounContainer}>
                      {["he/him", "she/her", "they/them"].map((pronoun) => (
                        <TouchableOpacity
                          key={pronoun}
                          style={[
                            styles.pronounButton,
                            formData.pronouns === pronoun &&
                              styles.pronounButtonActive,
                          ]}
                          onPress={() =>
                            setFormData({ ...formData, pronouns: pronoun })
                          }
                        >
                          <Text
                            style={[
                              styles.pronounButtonText,
                              formData.pronouns === pronoun &&
                                styles.pronounButtonTextActive,
                            ]}
                          >
                            {pronoun}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color="#4f46e5"
                      />
                      <Text style={styles.label}>Bio (Optional)</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.bioInput]}
                      placeholder="Tell us a bit about yourself..."
                      placeholderTextColor="#9ca3af"
                      value={formData.bio}
                      onChangeText={(text) =>
                        setFormData({ ...formData, bio: text })
                      }
                      multiline
                      numberOfLines={3}
                      maxLength={150}
                      returnKeyType="done"
                    />
                    <Text style={styles.charCount}>
                      {150 - formData.bio.length} characters remaining
                    </Text>
                  </View>
                </View>
              )}

              {/* Step 2: Academic Details */}
              {activeStep === 2 && (
                <View style={styles.stepContent}>
                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons name="mail-outline" size={18} color="#4f46e5" />
                      <Text style={styles.label}>University Email *</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="name@university.edu"
                      placeholderTextColor="#9ca3af"
                      value={formData.universityEmail}
                      onChangeText={(text) =>
                        setFormData({ ...formData, universityEmail: text })
                      }
                      keyboardType="email-address"
                      autoCapitalize="none"
                      returnKeyType="next"
                    />
                    <Text style={styles.inputHint}>
                      Used for verification purposes only
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons
                        name="school-outline"
                        size={18}
                        color="#4f46e5"
                      />
                      <Text style={styles.label}>Major/Department *</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Computer Science"
                      placeholderTextColor="#9ca3af"
                      value={formData.major}
                      onChangeText={(text) =>
                        setFormData({ ...formData, major: text })
                      }
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <MaterialIcons
                        name="calendar-today"
                        size={18}
                        color="#4f46e5"
                      />
                      <Text style={styles.label}>Current Year *</Text>
                    </View>
                    <View style={styles.yearGrid}>
                      {["UPC", "First", "Second", "Third"].map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={[
                            styles.yearCard,
                            formData.year === year && styles.yearCardActive,
                          ]}
                          onPress={() => setFormData({ ...formData, year })}
                        >
                          <Text
                            style={[
                              styles.yearCardText,
                              formData.year === year &&
                                styles.yearCardTextActive,
                            ]}
                          >
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons
                        name="today-outline"
                        size={18}
                        color="#4f46e5"
                      />
                      <Text style={styles.label}>Expected Graduation Year</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 2025"
                      placeholderTextColor="#9ca3af"
                      value={formData.graduationYear.toString()}
                      onChangeText={(text) =>
                        setFormData({ ...formData, graduationYear: text })
                      }
                      keyboardType="number-pad"
                      returnKeyType="done"
                    />
                  </View>
                </View>
              )}

              {/* Navigation Buttons */}
              {renderButtons()}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms of Service and Privacy
                Policy
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Main container styles
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 20,
    marginBottom: 35,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 22,
  },

  // Step indicator styles
  stepContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  stepCirclesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  stepWithLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  stepCircleActive: {
    backgroundColor: "#4f46e5",
  },
  stepCircleInactive: {
    backgroundColor: "#e5e7eb",
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
  },
  stepNumberActive: {
    color: "white",
  },
  stepNumberInactive: {
    color: "#9ca3af",
  },
  stepLine: {
    width: 150,
    height: 3,
    marginHorizontal: 2,
  },
  stepLineActive: {
    backgroundColor: "#4f46e5",
  },
  stepLineInactive: {
    backgroundColor: "#e5e7eb",
  },
  stepLabelsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  stepLabelWrapper: {
    alignItems: "center",
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  stepLabelActive: {
    color: "#4f46e5",
  },
  stepLabelInactive: {
    color: "#9ca3af",
  },
  activeUnderline: {
    width: "80%",
    height: 3,
    backgroundColor: "#4f46e5",
    borderRadius: 2,
  },

  // Form styles
  formCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 30,
  },
  stepContent: {
    minHeight: 320,
  },
  inputGroup: {
    marginBottom: 24,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 8,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#000000",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  inputSuccess: {
    borderColor: "#10b981",
  },
  inputHint: {
    fontSize: 13,
    color: "#848484",
    marginTop: 8,
  },

  // Username validation styles
  validationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  validationTextLoading: {
    fontSize: 13,
    color: "#4f46e5",
  },
  validationTextError: {
    fontSize: 13,
    color: "#ef4444",
  },
  validationTextSuccess: {
    fontSize: 13,
    color: "#10b981",
  },

  // Pronouns selection styles
  pronounContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  pronounButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
  },
  pronounButtonActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  pronounButtonText: {
    fontSize: 14,
    color: "#374151",
  },
  pronounButtonTextActive: {
    color: "white",
    fontWeight: "600",
  },

  // Year selection styles
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  yearCard: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
    alignItems: "center",
  },
  yearCardActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  yearCardText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
  yearCardTextActive: {
    color: "white",
  },

  // Bio input specific styles
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
    marginTop: 6,
  },

  // Button styles
  buttonContainer: {
    flexDirection: "row",
    marginTop: 30,
    gap: 12,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4f46e5",
    backgroundColor: "white",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4f46e5",
    marginLeft: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4f46e5",
  },
  disabledButton: {
    backgroundColor: "#9ca3af",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginRight: 8,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#10b981",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginRight: 8,
  },

  // Footer styles
  footer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
  },
});
