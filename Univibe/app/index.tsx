// app/index.tsx - CORRECTED
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log("🔍 Checking authentication...");
      const token = await SecureStore.getItemAsync("authToken");
      console.log("Token found:", !!token);

      if (token) {
        const decoded: any = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp && decoded.exp > currentTime) {
          // Token is valid - go to main app
          console.log("✅ Valid token, redirecting to /(tabs)");
          router.replace("/(tabs)"); // CHANGED FROM /(protected)/(tabs)
          return;
        } else {
          // Token expired - clear it
          console.log("❌ Token expired, clearing...");
          await SecureStore.deleteItemAsync("authToken");
        }
      }

      // No token or token expired - go to login
      console.log("ℹ️ No valid token, redirecting to landingPage");
      router.replace("/landingPage");
    } catch (error) {
      console.error("Auth check error:", error);
      router.replace("/landingPage");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return null;
}
