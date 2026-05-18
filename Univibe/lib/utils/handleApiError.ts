// lib/utils/handleApiError.ts

import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

interface ApiError {
  success: boolean;
  message?: string;
  code?: string;
  bannedReason?: string;
  suspendedUntil?: string;
  suspendReason?: string;
}

export const handleAuthError = async (error: any): Promise<boolean> => {
  if (!error) return false;

  const data = error as ApiError;

  // Handle account banned - clear data silently, AuthContext shows the alert
  if (data.code === "ACCOUNT_BANNED") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
    // No alert here - AuthContext handleForceLogout shows the alert
    router.replace("/(auth)/login");
    return true;
  }

  // Handle account suspended - AuthContext shows the alert
  if (data.code === "ACCOUNT_SUSPENDED") {
    // No alert here - AuthContext handleForceLogout shows the alert
    return true;
  }

  // Handle force logout (token version mismatch)
  if (data.code === "TOKEN_VERSION_MISMATCH") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");

    Alert.alert(
      "Session Expired",
      data.message || "You have been logged out. Please login again.",
      [
        {
          text: "OK",
          onPress: () => {
            router.replace("/(auth)/login");
          },
        },
      ],
      { cancelable: false },
    );
    return true;
  }

  // Handle user not found
  if (data.code === "USER_NOT_FOUND") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");

    Alert.alert(
      "Account Not Found",
      "Your account may have been deleted.",
      [
        {
          text: "OK",
          onPress: () => {
            router.replace("/(auth)/login");
          },
        },
      ],
      { cancelable: false },
    );
    return true;
  }

  return false;
};
