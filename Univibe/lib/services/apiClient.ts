// lib/utils/handleApiError.ts

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

  // ACCOUNT_BANNED - silently clear data, no alert (AuthContext handles it)
  if (data.code === "ACCOUNT_BANNED") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
    router.replace("/(auth)/login");
    return true;
  }

  // ACCOUNT_SUSPENDED - silently handle, no alert (AuthContext handles it)
  if (data.code === "ACCOUNT_SUSPENDED") {
    return true;
  }

  // TOKEN_VERSION_MISMATCH - silently clear data, no alert (AuthContext handles it)
  if (data.code === "TOKEN_VERSION_MISMATCH") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
    router.replace("/(auth)/login");
    return true;
  }

  // USER_NOT_FOUND - silently clear data, no alert
  if (data.code === "USER_NOT_FOUND") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
    router.replace("/(auth)/login");
    return true;
  }

  return false;
};
