// Univibe/lib/AuthContext.tsx
/**
 * Authentication Context
 * Manages user authentication state, token handling, and profile data
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
import { jwtDecode } from "jwt-decode";
import { AppState, AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import { profileService } from "../services/profileService";
import { API_BASE_URL } from "../../constants/ipConstants";

// ============================================
// TYPES
// ============================================

interface CustomJwtPayload {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  exp?: number;
  iat?: number;
}

interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  role: string;
  isEmailVerified: boolean;
  profileComplete?: boolean;
  exp?: number;
  iat?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  profile: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  setupProfile: (profileData: any) => Promise<any>;
  refreshProfile: () => Promise<void>;
  loadProfile: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  refreshUserProfile: () => Promise<void>;
  checkVerificationStatus: () => Promise<{
    isEmailVerified: boolean;
    email?: string;
    canResend?: boolean;
    tokenExpired?: boolean;
  }>;
  resendVerificationEmail: (email: string) => Promise<{
    success: boolean;
    message?: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// PROVIDER COMPONENT
// ============================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated =
    !!token && !!user?.isEmailVerified && !!user?.profileComplete;
  const appState = useRef(AppState.currentState);

  // Initialize auth state on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  // Monitor app state to refresh verification status when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active" &&
          token
        ) {
          try {
            const decoded = jwtDecode<CustomJwtPayload>(token);
            const response = await fetch(
              `${API_BASE_URL}/api/auth/check-verification`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            const data = await response.json();

            if (
              data.success &&
              data.isEmailVerified &&
              !decoded.isEmailVerified
            ) {
              await refreshToken();
            }
          } catch (error) {
            // Silent fail
          }
        }
        appState.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [token]);

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  /**
   * Refresh authentication token
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      const currentToken =
        token || (await SecureStore.getItemAsync("authToken"));
      if (!currentToken) return false;

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success && data.token) {
        await SecureStore.setItemAsync("authToken", data.token);
        setToken(data.token);

        const decoded = jwtDecode<CustomJwtPayload>(data.token);
        setUser({
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          isEmailVerified: decoded.isEmailVerified,
          exp: decoded.exp,
          iat: decoded.iat,
        });

        await fetchUserProfile();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Refresh token error:", error);
      return false;
    }
  };

  /**
   * Clear all authentication data
   */
  const clearAuthData = async () => {
    try {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("profile_complete");
    } catch (error) {
      console.error("Error clearing token:", error);
    }
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  /**
   * Fetch and update user profile data
   */
  const fetchUserProfile = async () => {
    try {
      const response = await profileService.getProfileDetails();

      if (!response) {
        setProfile(null);
        return null;
      }

      if (response.success === true) {
        if (response.data?.profile) {
          setProfile(response.data.profile);
          return response.data.profile;
        } else if (response.profile) {
          setProfile(response.profile);
          return response.profile;
        }
      }

      if (
        response.success === false &&
        response.message?.includes("not found")
      ) {
        setProfile(null);
        return null;
      }

      if (response._id && response.user) {
        setProfile(response);
        return response;
      }

      setProfile(null);
      return null;
    } catch (error) {
      console.error("Fetch profile error:", error);
      setProfile(null);
      return null;
    }
  };

  /**
   * Check if user has ACTUALLY completed profile setup
   * Default profile has major: "Undecided" - so completed profile won't
   */
  const hasCompletedProfile = (profileData: any, userData?: any): boolean => {
    // Most reliable: user.profileComplete flag from backend
    if (userData?.profileComplete === true) return true;
    if (profileData?.user?.profileComplete === true) return true;
    if (profileData?.data?.user?.profileComplete === true) return true;

    // Fallback: check if profile has been customized
    const p = profileData?.data?.profile || profileData?.profile || profileData;
    if (p?.major && p.major !== "Undecided" && p?.username) return true;

    return false;
  };

  /**
   * Refresh current user's profile data
   */
  const refreshUserProfile = async () => {
    try {
      const currentToken =
        token || (await SecureStore.getItemAsync("authToken"));
      if (!currentToken) return;

      const response = await profileService.getMyProfile();
      if (response.success && response.data) {
        setUser((prev) => ({
          ...prev,
          ...response.data.user,
          id: prev?.id || response.data.user?._id,
          email: prev?.email || response.data.user?.email,
          profileComplete:
            response.data.user?.profileComplete ?? prev?.profileComplete,
        }));
        setProfile(response.data.profile);
      }
    } catch (error) {
      console.error("Refresh user profile error:", error);
    }
  };

  /**
   * Legacy refresh method
   */
  const refreshProfile = async () => {
    await fetchUserProfile();
  };

  /**
   * Load profile if token exists
   */
  const loadProfile = async () => {
    if (!token) return;
    await fetchUserProfile();
  };

  // ============================================
  // AUTH STATE MANAGEMENT
  // ============================================

  /**
   * Check and restore authentication state on app start
   * Keeps token even if profile incomplete (routing layers handle redirection)
   */
  const checkAuthState = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync("authToken");
      console.log("🔐 Checking auth state, token exists:", !!storedToken);

      if (!storedToken) {
        console.log("🔐 No token found, user not authenticated");
        setIsLoading(false);
        return;
      }

      let decoded: CustomJwtPayload;
      try {
        decoded = jwtDecode<CustomJwtPayload>(storedToken);
      } catch (decodeError) {
        console.error("🔐 Invalid token format:", decodeError);
        await clearAuthData();
        setIsLoading(false);
        return;
      }

      // Block unverified users
      if (!decoded.isEmailVerified) {
        console.log("🔐 Email not verified, clearing session");
        await clearAuthData();
        setIsLoading(false);
        return;
      }

      const currentTime = Date.now() / 1000;

      if (decoded.exp && decoded.exp > currentTime) {
        console.log("🔐 Verified session found, restoring...");
        setToken(storedToken);
        setUser({
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          isEmailVerified: decoded.isEmailVerified,
          exp: decoded.exp,
          iat: decoded.iat,
        });

        // Fetch profile to check completion status
        const profileData = await fetchUserProfile();

        if (hasCompletedProfile(profileData, { profileComplete: false })) {
          console.log("🔐 Profile complete, full access granted");
          setUser((prev) => (prev ? { ...prev, profileComplete: true } : null));
        } else {
          console.log("🔐 Profile incomplete, user needs setup");
          setUser((prev) =>
            prev ? { ...prev, profileComplete: false } : null,
          );
        }
      } else {
        console.log("🔐 Token expired, clearing session");
        await clearAuthData();
      }
    } catch (error) {
      console.error("🔐 Auth state check error:", error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if user's email is verified
   */
  const checkVerificationStatus = async () => {
    try {
      const currentToken =
        token || (await SecureStore.getItemAsync("authToken"));
      if (!currentToken) return { isEmailVerified: false };

      const response = await fetch(
        `${API_BASE_URL}/api/auth/check-verification`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        if (data.isEmailVerified && currentToken) {
          try {
            const decoded = jwtDecode<CustomJwtPayload>(currentToken);
            if (!decoded.isEmailVerified) {
              await refreshToken();
            }
          } catch (err) {
            // Silent fail
          }
        }

        return {
          isEmailVerified: data.isEmailVerified,
          email: data.user?.email,
          canResend: data.canResend,
          tokenExpired: data.tokenExpired,
        };
      }

      return { isEmailVerified: false };
    } catch (error) {
      console.error("Check verification error:", error);
      return { isEmailVerified: false };
    }
  };

  /**
   * Resend email verification link
   */
  const resendVerificationEmail = async (email: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      const data = await response.json();
      return { success: data.success, message: data.message };
    } catch (error) {
      return { success: false, message: "Network error" };
    }
  };

  // ============================================
  // AUTHENTICATION ACTIONS
  // ============================================

  /**
   * Login user with email and password
   */
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (responseData.code === "EMAIL_NOT_VERIFIED") {
          throw new Error("EMAIL_NOT_VERIFIED:" + responseData.message);
        }
        throw new Error(responseData.message || "Login failed");
      }

      if (responseData.token) {
        await SecureStore.setItemAsync("authToken", responseData.token);
        setToken(responseData.token);

        const decoded = jwtDecode<CustomJwtPayload>(responseData.token);
        setUser({
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          isEmailVerified: decoded.isEmailVerified,
          profileComplete: responseData.user?.profileComplete ?? false,
          exp: decoded.exp,
          iat: decoded.iat,
        });

        await fetchUserProfile();
        console.log(
          "🔐 Login successful, profileComplete:",
          responseData.user?.profileComplete,
        );
      } else {
        throw new Error("Authentication failed");
      }
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register new user account
   * No token stored - user must verify email first
   */
  const signup = async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      await SecureStore.deleteItemAsync("authToken");
      setToken(null);
      setUser(null);
      setProfile(null);

      return data;
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Complete profile setup after registration
   */
  const setupProfile = async (profileData: any) => {
    try {
      setIsLoading(true);

      const response = await profileService.setupProfile(profileData);

      if (response?.success === true) {
        await fetchUserProfile();
        setUser((prev) => (prev ? { ...prev, profileComplete: true } : null));
        return response;
      } else {
        throw new Error(response?.message || "Profile creation failed");
      }
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user and clear all data
   */
  const logout = async () => {
    try {
      await clearAuthData();
      console.log("🔐 Logout successful");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  // ============================================
  // CONTEXT PROVIDER
  // ============================================

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        isLoading,
        isAuthenticated,
        login,
        signup,
        logout,
        setupProfile,
        refreshProfile,
        loadProfile,
        refreshToken,
        refreshUserProfile,
        checkVerificationStatus,
        resendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// CUSTOM HOOK
// ============================================

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
