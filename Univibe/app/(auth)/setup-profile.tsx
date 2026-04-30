// app/(auth)/setup-profile.tsx
import React, { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { profileService } from "../../lib/services/profileService";
import { API_BASE_URL } from "../../constants/ipConstants";

// Import shared components and constants
import {
  ScrollableDropdown,
  YearSelector,
  PronounsSelector,
  BioInput,
} from "../components/Profile/FormComponent";
import {
  GRADUATION_YEARS,
  MAJORS,
  COLLEGES,
} from "../../constants/profileConstants";

export default function SetupProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const [formData, setFormData] = useState({
    username: "",
    campus: "",
    major: "",
    year: "",
    graduationYear: String(new Date().getFullYear() + 4),
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

  // Handle campus selection
  const handleCampusSelect = (value: string) => {
    setFormData({ ...formData, campus: value });
  };

  // Handle major selection
  const handleMajorSelect = (value: string) => {
    setFormData({ ...formData, major: value });
  };

  // Handle year selection
  const handleYearSelect = (year: string) => {
    setFormData({ ...formData, year });
  };

  // Handle pronouns selection
  const handlePronounsSelect = (pronouns: string) => {
    setFormData({ ...formData, pronouns });
  };

  // Handle graduation year selection
  const handleGraduationYearSelect = (year: string) => {
    setFormData({ ...formData, graduationYear: year });
  };

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
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await response.json();

        if (response.status === 200 && data.available === true) {
          setUsernameStatus({
            loading: false,
            available: true,
            error: "",
          });
        } else if (response.status === 409 || data.success === false) {
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

    const timer = setTimeout(() => checkUsername(), 500);
    return () => clearTimeout(timer);
  }, [formData.username]);

  const handleSubmit = async () => {
    if (
      !formData.username ||
      !formData.major ||
      !formData.year ||
      !formData.universityEmail ||
      !formData.campus
    ) {
      Alert.alert("Required Fields", "Please fill in all required fields (*)");
      return;
    }

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
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert("Session Expired", "Please log in again to continue.", [
          { text: "OK", onPress: () => router.replace("/(auth)/login") },
        ]);
        return;
      }

      const submitData = {
        username: formData.username,
        campus: formData.campus,
        major: formData.major,
        year: formData.year,
        graduationYear: formData.graduationYear,
        bio: formData.bio,
        pronouns: formData.pronouns,
        universityEmail: formData.universityEmail,
      };

      console.log("📤 Submitting profile data:", submitData);

      const response = await profileService.setupProfile(submitData);

      if (response.success) {
        if (response.data?.user) {
          await SecureStore.setItemAsync(
            "user_data",
            JSON.stringify(response.data.user),
          );
        }
        if (response.data?.profile) {
          await SecureStore.setItemAsync(
            "profile_data",
            JSON.stringify(response.data.profile),
          );
        }
        await SecureStore.setItemAsync("profile_complete", "true");

        Alert.alert(
          "🎉 Profile Complete!",
          "Your profile has been set up successfully!",
          [{ text: "Get Started", onPress: () => router.replace("/(tabs)") }],
        );
      } else {
        Alert.alert(
          "Setup Failed",
          response.message || "Unable to setup profile",
        );
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert("Error", error.message || "Unable to complete profile setup");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
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
      if (!formData.campus) {
        Alert.alert("Campus Required", "Please select your campus");
        return;
      }
    }
    if (activeStep < 2) setActiveStep(activeStep + 1);
  };

  const prevStep = () => {
    if (activeStep > 1) setActiveStep(activeStep - 1);
  };

  const renderUsernameValidation = () => {
    if (!formData.username.trim()) return null;
    if (usernameStatus.loading) {
      return (
        <View style={styles.validationContainer}>
          <ActivityIndicator size="small" color="#4f46e5" />
          <Text style={styles.validationTextLoading}>Checking username...</Text>
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
          <Text style={styles.validationTextSuccess}>Username available!</Text>
        </View>
      );
    }
    return null;
  };

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
                  activeStep >= step && styles.stepNumberActive,
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
        <View style={styles.stepLabelWrapper}>
          <Text
            style={[
              styles.stepLabel,
              activeStep === 1 && styles.stepLabelActive,
            ]}
          >
            Basic Info
          </Text>
          {activeStep === 1 && <View style={styles.activeUnderline} />}
        </View>
        <View style={styles.stepLabelWrapper}>
          <Text
            style={[
              styles.stepLabel,
              activeStep === 2 && styles.stepLabelActive,
            ]}
          >
            Academic Details
          </Text>
          {activeStep === 2 && <View style={styles.activeUnderline} />}
        </View>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={["#f8fafc", "#f1f5f9"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
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

            <StepIndicator />

            <View style={styles.formCard}>
              {activeStep === 1 && (
                <View style={styles.stepContent}>
                  {/* Username */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons
                        name="person-circle-outline"
                        size={20}
                        color="#8b5cf6"
                      />
                      <Text style={styles.label}>
                        Username <Text style={styles.requiredStar}>*</Text>
                      </Text>
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
                      onChangeText={(text: string) =>
                        setFormData({ ...formData, username: text })
                      }
                      autoCapitalize="none"
                      maxLength={20}
                    />
                    {renderUsernameValidation()}
                    <Text style={styles.inputHint}>
                      This will be your unique identifier
                    </Text>
                  </View>

                  {/* Campus / College - Scrollable Dropdown */}
                  <ScrollableDropdown
                    label="Campus / College"
                    value={formData.campus}
                    options={COLLEGES}
                    onSelect={handleCampusSelect}
                    placeholder="Select your campus"
                    required={true}
                    icon={
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color="#8b5cf6"
                      />
                    }
                  />

                  {/* Pronouns Selector */}
                  <PronounsSelector
                    value={formData.pronouns}
                    onSelect={handlePronounsSelect}
                  />

                  {/* Bio Input */}
                  <BioInput
                    value={formData.bio}
                    onChange={(text: string) =>
                      setFormData({ ...formData, bio: text })
                    }
                    maxLength={150}
                  />
                </View>
              )}

              {activeStep === 2 && (
                <View style={styles.stepContent}>
                  {/* University Email */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons name="mail-outline" size={20} color="#8b5cf6" />
                      <Text style={styles.label}>
                        University Email{" "}
                        <Text style={styles.requiredStar}>*</Text>
                      </Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="name@university.edu"
                      placeholderTextColor="#9ca3af"
                      value={formData.universityEmail}
                      onChangeText={(text: string) =>
                        setFormData({ ...formData, universityEmail: text })
                      }
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Major - Scrollable Dropdown */}
                  <ScrollableDropdown
                    label="Major / Department"
                    value={formData.major}
                    options={MAJORS}
                    onSelect={handleMajorSelect}
                    placeholder="Select your major"
                    required={true}
                    icon={
                      <Ionicons
                        name="school-outline"
                        size={20}
                        color="#8b5cf6"
                      />
                    }
                  />

                  {/* Year Selector */}
                  <YearSelector
                    value={formData.year}
                    onSelect={handleYearSelect}
                    required={true}
                  />

                  {/* Graduation Year - Scrollable Dropdown */}
                  <ScrollableDropdown
                    label="Expected Graduation Year"
                    value={formData.graduationYear}
                    options={GRADUATION_YEARS}
                    onSelect={handleGraduationYearSelect}
                    placeholder="Select graduation year"
                    icon={
                      <Ionicons
                        name="today-outline"
                        size={20}
                        color="#8b5cf6"
                      />
                    }
                  />
                </View>
              )}

              <View
                style={[
                  styles.buttonContainer,
                  activeStep > 1 && styles.buttonContainerSpaced,
                ]}
              >
                {activeStep > 1 && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={prevStep}
                    disabled={loading}
                  >
                    <Ionicons name="arrow-back" size={18} color="#8b5cf6" />
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                )}

                {activeStep < 2 ? (
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (!formData.username || !formData.campus) &&
                        styles.disabledButton,
                    ]}
                    onPress={nextStep}
                    disabled={!formData.username || !formData.campus}
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="white" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      loading && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitButtonText}>
                          Complete Profile
                        </Text>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="white"
                        />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

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
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
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
  headerContent: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    fontFamily: "SofiaSans-Bold",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 22,
    fontFamily: "SofiaSans-Regular",
  },
  stepContainer: { alignItems: "center", marginBottom: 40 },
  stepCirclesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  stepWithLine: { flexDirection: "row", alignItems: "center" },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  stepCircleActive: { backgroundColor: "#8b5cf6" },
  stepCircleInactive: { backgroundColor: "#e5e7eb" },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9ca3af",
    fontFamily: "SofiaSans-Bold",
  },
  stepNumberActive: { color: "white" },
  stepLine: { width: 150, height: 3, marginHorizontal: 2 },
  stepLineActive: { backgroundColor: "#8b5cf6" },
  stepLineInactive: { backgroundColor: "#e5e7eb" },
  stepLabelsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  stepLabelWrapper: { alignItems: "center", flex: 1 },
  stepLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Bold",
  },
  stepLabelActive: { color: "#8b5cf6" },
  activeUnderline: {
    width: "80%",
    height: 3,
    backgroundColor: "#8b5cf6",
    borderRadius: 2,
  },
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
  stepContent: { minHeight: 320 },
  inputGroup: { marginBottom: 24 },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    color: "#374151",
  },
  requiredStar: { color: "#ef4444", fontSize: 15 },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    color: "#000000",
  },
  inputError: { borderColor: "#ef4444" },
  inputSuccess: { borderColor: "#10b981" },
  inputHint: { fontSize: 12, color: "#9ca3af", marginTop: 8 },
  validationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  validationTextLoading: { fontSize: 12, color: "#8b5cf6" },
  validationTextError: {
    fontSize: 12,
    color: "#ef4444",
    fontFamily: "SofiaSans-Regular",
  },
  validationTextSuccess: {
    fontSize: 12,
    color: "#10b981",
    fontFamily: "SofiaSans-Regular",
  },
  buttonContainer: { flexDirection: "row", marginTop: 30, gap: 12 },
  buttonContainerSpaced: { justifyContent: "space-between" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    backgroundColor: "white",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8b5cf6",
    marginLeft: 8,
    fontFamily: "SofiaSans-Bold",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#8b5cf6",
    flex: 1,
  },
  disabledButton: { backgroundColor: "#9ca3af" },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginRight: 8,
    fontFamily: "SofiaSans-Bold",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#10b981",
    flex: 1,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginRight: 8,
    fontFamily: "SofiaSans-Bold",
  },
  footer: { alignItems: "center", paddingHorizontal: 20 },
  footerText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    fontFamily: "SofiaSans-Regular",
  },
});
