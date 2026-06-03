import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LandingScreen() {
  return (
    <LinearGradient colors={["#faf9f6", "#e8e6e1"]} style={styles.container}>
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
  logoContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  logoText: {
    fontSize: 52,
    color: "#1f2937",
    fontFamily: "Sofia-Regular",
    letterSpacing: 3,
  },
  sloganContainer: {
    alignItems: "center",
  },
  sloganTitle: {
    color: "#4b5563",
    fontSize: 20,
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 5,
  },
  sloganSubtitle: {
    color: "#4b5563",
    fontSize: 20,
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
    fontWeight: "bold",
  },
  buttonsContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 150,
  },
  loginButton: {
    width: "100%",
    padding: 18,
    borderRadius: 30,
    backgroundColor: "#8b5cf6",
    marginBottom: 20,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  signupButton: {
    width: "100%",
    padding: 18,
    borderRadius: 30,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#8b5cf6",
    marginBottom: 30,
  },
  signupButtonText: {
    color: "#8b5cf6",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d1d5db",
  },
  orText: {
    color: "#6b7280",
    fontSize: 16,
    marginHorizontal: 15,
    fontFamily: "Sofia-Regular",
  },
  continueWith: {
    color: "#6b7280",
    fontSize: 15,
    marginBottom: 20,
  },
  socialRow: {
    flexDirection: "row",
    gap: 25,
  },
  socialButton: {
    padding: 10,
  },
});
