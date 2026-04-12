// app/verify.tsx
import React, { useRef, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, BackHandler } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../lib/contexts/AuthContext";
import { API_BASE_URL } from "../constants/ipConstants";

interface CustomJwtPayload {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  exp?: number;
  iat?: number;
}

export default function VerifyScreen() {
  const router = useRouter();
  const { token: urlToken } = useLocalSearchParams<{ token: string }>();
  const webViewRef = useRef<WebView>(null);
  const { refreshToken, loadProfile } = useAuth();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.back();
        return true;
      },
    );
    return () => backHandler.remove();
  }, []);

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "EMAIL_VERIFIED" && data.token) {
        const decoded = jwtDecode<CustomJwtPayload>(data.token);

        if (decoded.isEmailVerified) {
          await SecureStore.setItemAsync("authToken", data.token);
          await refreshToken();
          router.back();

          setTimeout(async () => {
            await loadProfile();
            router.replace("/(auth)/setup-profile");
          }, 500);
        }
      } else if (data.type === "CLOSE_WEBVIEW") {
        router.back();
      }
    } catch (error) {
      // Silently fail - WebView message parsing error
    }
  };

  if (!urlToken) {
    router.replace("/(auth)/login");
    return null;
  }

  const verificationUrl = `${API_BASE_URL}/verify-email/${urlToken}`;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: verificationUrl }}
        onMessage={handleMessage}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
          </View>
        )}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
