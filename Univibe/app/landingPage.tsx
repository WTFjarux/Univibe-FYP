import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LandingScreen() {
  return (
    <LinearGradient
      colors={["#9f95b6ff", "#17151aff"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>UNIVIBE</Text>
          </View>

          {/* SLOGAN */}
          <View style={styles.sloganContainer}>
            <Text style={styles.sloganTitle}>Your Campus, Your Community,</Text>
            <Text style={styles.sloganSubtitle}>Your Vibe.</Text>
          </View>

          {/* BUTTONS CONTAINER */}
          <View style={styles.buttonsContainer}>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.loginButton}>
                <Text style={styles.loginButtonText}>SIGN IN</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity style={styles.signupButton}>
                <Text style={styles.signupButtonText}>SIGN UP</Text>
              </TouchableOpacity>
            </Link>

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
          </View>
        </View>
      </SafeAreaView>
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
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: "space-between",
    alignItems: "center",
  },
  // Logo
  logoContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  logoText: {
    fontSize: 52,
    color: "white",
    fontFamily: "Sofia-Regular",
    letterSpacing: 3,
  },
  // Slogan
  sloganContainer: {
    alignItems: "center",
  },
  sloganTitle: {
    color: "white",
    fontSize: 20,
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 5,
  },
  sloganSubtitle: {
    color: "white",
    fontSize: 20,
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
    fontWeight: "bold",
  },
  // Buttons Container
  buttonsContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 60,
  },
  // Login Button
  loginButton: {
    width: "100%",
    padding: 18,
    borderRadius: 30,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "white",
    marginBottom: 20,
  },
  loginButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  // Sign Up Button
  signupButton: {
    width: "100%",
    padding: 18,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    marginBottom: 30,
  },
  signupButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 18,
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
    fontFamily: "Sofia-Regular",
  },
  continueWith: {
    color: "white",
    fontSize: 15,
    marginBottom: 20,
  },
  // Social login icons
  socialRow: {
    flexDirection: "row",
    gap: 25,
  },
  socialButton: {
    padding: 10,
  },
});
