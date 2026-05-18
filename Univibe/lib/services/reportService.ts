// lib/services/reportService.ts

import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

export const reportContent = async (
  targetType: string,
  targetId: string,
  reason: string,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const token = await getAuthToken();
    if (!token) return { success: false, message: "No auth token" };

    const response = await fetch(`${API_BASE_URL}/api/content/report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetType, targetId, reason }),
    });

    return await response.json();
  } catch (error) {
    return { success: false, message: "Failed to report content" };
  }
};

export const reportUser = async (
  userId: string,
  reason: string,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const token = await getAuthToken();
    if (!token) return { success: false, message: "No auth token" };

    const response = await fetch(
      `${API_BASE_URL}/api/profile/report/${userId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      },
    );

    return await response.json();
  } catch (error) {
    return { success: false, message: "Failed to report user" };
  }
};
