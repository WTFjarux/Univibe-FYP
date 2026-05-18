/**
 * Authentication Context
 * Manages user authentication state, token handling, profile data, and socket connection
 * Handles force logout for banned/suspended users in real-time
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import socketService from "../services/socketService";
import { jwtDecode } from "jwt-decode";
import { AppState, AppStateStatus, Alert, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { profileService } from "../services/profileService";
import { API_BASE_URL } from "../../constants/ipConstants";
import { handleAuthError } from "../utils/handleApiError";

// ============================================
// TYPES
// ============================================

interface CustomJwtPayload {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  tokenVersion?: number;
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

interface ForceLogoutData {
  message: string;
  code: string;
  reason?: string;
  timestamp?: string;
  immediate?: boolean;
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
  handleTokenVersionMismatch: (data: any) => Promise<boolean>;
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
  const socketConnectedRef = useRef(false);
  const accountCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isLoggingOut = useRef(false);

  // ============================================
  // SOCKET CONNECTION MANAGEMENT
  // ============================================

  const connectSocket = useCallback(async () => {
    if (socketConnectedRef.current) return;

    const currentToken = token || (await SecureStore.getItemAsync("authToken"));
    if (!currentToken) return;

    try {
      let userId = user?.id;
      if (!userId && currentToken) {
        try {
          const decoded = jwtDecode<CustomJwtPayload>(currentToken);
          userId = decoded.id;
        } catch (e) {
          // silent
        }
      }

      const socket = await socketService.connect();
      if (socket) {
        socketConnectedRef.current = true;
        if (userId) {
          socketService.emit("join_room", {
            roomId: `user_${userId}`,
            type: "notification",
          });
        }
      }
    } catch (error) {
      console.error("Failed to connect socket:", error);
    }
  }, [token, user?.id]);

  const disconnectSocket = useCallback(() => {
    socketService.disconnect();
    socketConnectedRef.current = false;
  }, []);

  // ============================================
  // CLEAR AUTH DATA
  // ============================================

  const clearAuthData = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("profile_complete");
    } catch (error) {
      console.error("Error clearing token:", error);
    }
    setToken(null);
    setUser(null);
    setProfile(null);
  }, []);

  // ============================================
  // STOP PERIODIC CHECK
  // Declared before handleForceLogout and startAccountStatusCheck
  // to avoid "used before declaration" errors
  // ============================================

  const stopAccountStatusCheck = useCallback(() => {
    if (accountCheckIntervalRef.current) {
      clearInterval(accountCheckIntervalRef.current);
      accountCheckIntervalRef.current = null;
    }
  }, []);

  // ============================================
  // FORCE LOGOUT HANDLER
  // ============================================

  const handleForceLogout = useCallback(
    async (data: ForceLogoutData) => {
      if (isLoggingOut.current) return;
      isLoggingOut.current = true;

      // Stop periodic checks immediately
      stopAccountStatusCheck();

      const title =
        data.code === "ACCOUNT_BANNED" ? "Account Banned" : "Account Suspended";

      if (Platform.OS !== "web") {
        Alert.alert(
          title,
          data.message || "Your account has been actioned by an administrator.",
          [
            {
              text: "OK",
              onPress: async () => {
                await disconnectSocket();
                await clearAuthData();
                isLoggingOut.current = false;
              },
            },
          ],
          { cancelable: false },
        );
      } else {
        await disconnectSocket();
        await clearAuthData();
        isLoggingOut.current = false;
      }
    },
    [disconnectSocket, clearAuthData, stopAccountStatusCheck],
  );

  // ============================================
  // PERIODIC ACCOUNT STATUS CHECK
  // ============================================

  const startAccountStatusCheck = useCallback(() => {
    if (accountCheckIntervalRef.current) return;

    accountCheckIntervalRef.current = setInterval(async () => {
      if (isLoggingOut.current) return;

      const currentToken =
        token || (await SecureStore.getItemAsync("authToken"));
      if (!currentToken) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();

        if (
          data.code === "ACCOUNT_BANNED" ||
          data.code === "ACCOUNT_SUSPENDED"
        ) {
          if (!isLoggingOut.current) {
            await handleForceLogout({
              message: data.message,
              code: data.code,
            });
          }
        }
      } catch (error) {
        // Silent fail for periodic checks
      }
    }, 15000);
  }, [token, handleForceLogout]);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    checkAuthState();
  }, []);

  // Socket force logout listener
  useEffect(() => {
    const onForceLogout = (data: ForceLogoutData) => {
      handleForceLogout(data);
    };
    const onAccountBanned = (data: any) => {
      handleForceLogout({ ...data, code: "ACCOUNT_BANNED" });
    };
    const onAccountSuspended = (data: any) => {
      handleForceLogout({ ...data, code: "ACCOUNT_SUSPENDED" });
    };

    socketService.on("force_logout", onForceLogout);
    socketService.on("account_banned", onAccountBanned);
    socketService.on("account_suspended", onAccountSuspended);

    return () => {
      socketService.off("force_logout", onForceLogout);
      socketService.off("account_banned", onAccountBanned);
      socketService.off("account_suspended", onAccountSuspended);
    };
  }, [handleForceLogout]);

  // Start/stop periodic checks based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      startAccountStatusCheck();
    } else {
      stopAccountStatusCheck();
    }
    return () => stopAccountStatusCheck();
  }, [isAuthenticated, startAccountStatusCheck, stopAccountStatusCheck]);

  // App state change handler
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active" &&
          token
        ) {
          // Check verification status
          try {
            const response = await fetch(
              `${API_BASE_URL}/api/auth/check-verification`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );
            const data = await response.json();
            if (data.success && data.isEmailVerified) {
              const decoded = jwtDecode<CustomJwtPayload>(token);
              if (!decoded.isEmailVerified) await refreshToken();
            }
          } catch (error) {
            // Silent fail
          }

          // Check account status
          try {
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });
            const data = await response.json();
            if (
              data.code === "ACCOUNT_BANNED" ||
              data.code === "ACCOUNT_SUSPENDED"
            ) {
              await handleForceLogout({
                message: data.message,
                code: data.code,
              });
              return;
            }
          } catch (error) {
            // Silent fail
          }

          if (isAuthenticated) connectSocket();
        }
        appState.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [token, isAuthenticated, connectSocket, handleForceLogout]);

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

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

      if (data.code === "ACCOUNT_BANNED" || data.code === "ACCOUNT_SUSPENDED") {
        await handleForceLogout({ message: data.message, code: data.code });
        return false;
      }

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

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

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

  const hasCompletedProfile = (profileData: any, userData?: any): boolean => {
    if (userData?.profileComplete === true) return true;
    if (profileData?.user?.profileComplete === true) return true;
    if (profileData?.data?.user?.profileComplete === true) return true;
    const p = profileData?.data?.profile || profileData?.profile || profileData;
    if (p?.major && p.major !== "Undecided" && p?.username) return true;
    return false;
  };

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

  const refreshProfile = async () => {
    await fetchUserProfile();
  };

  const loadProfile = async () => {
    if (!token) return;
    await fetchUserProfile();
  };

  // ============================================
  // AUTH STATE MANAGEMENT
  // ============================================

  const checkAuthState = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync("authToken");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      let decoded: CustomJwtPayload;
      try {
        decoded = jwtDecode<CustomJwtPayload>(storedToken);
      } catch (decodeError) {
        await clearAuthData();
        setIsLoading(false);
        return;
      }

      if (!decoded.isEmailVerified) {
        await clearAuthData();
        setIsLoading(false);
        return;
      }

      const currentTime = Date.now() / 1000;
      if (!decoded.exp || decoded.exp <= currentTime) {
        await clearAuthData();
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      setUser({
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        isEmailVerified: decoded.isEmailVerified,
        exp: decoded.exp,
        iat: decoded.iat,
      });

      // Verify account status with server
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();

        if (data.code === "TOKEN_VERSION_MISMATCH") {
          await clearAuthData();
          setIsLoading(false);
          return;
        }

        if (data.code === "ACCOUNT_BANNED") {
          await clearAuthData();
          setIsLoading(false);
          return;
        }

        if (data.code === "ACCOUNT_SUSPENDED") {
        }
      } catch (apiError) {
        // Continue offline
      }

      const profileData = await fetchUserProfile();
      if (hasCompletedProfile(profileData, { profileComplete: false })) {
        setUser((prev) => (prev ? { ...prev, profileComplete: true } : null));
        connectSocket();
      } else {
        setUser((prev) => (prev ? { ...prev, profileComplete: false } : null));
      }
    } catch (error) {
      console.error("Auth state check error:", error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

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
            if (!decoded.isEmailVerified) await refreshToken();
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
      return { isEmailVerified: false };
    }
  };

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

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();

      if (responseData?.code === "ACCOUNT_BANNED") {
        await handleAuthError(responseData);
        throw new Error("ACCOUNT_BANNED");
      }

      if (responseData?.code === "ACCOUNT_SUSPENDED") {
        await handleAuthError(responseData);
        throw new Error("ACCOUNT_SUSPENDED");
      }

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

        if (responseData.user?.profileComplete) {
          connectSocket();
        }
      } else {
        throw new Error("Authentication failed");
      }
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration failed");

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

  const setupProfile = async (profileData: any) => {
    try {
      setIsLoading(true);

      const response = await profileService.setupProfile(profileData);

      if (response?.success === true) {
        await fetchUserProfile();
        setUser((prev) => (prev ? { ...prev, profileComplete: true } : null));
        connectSocket();
        return response;
      }
      throw new Error(response?.message || "Profile creation failed");
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      stopAccountStatusCheck();
      disconnectSocket();
      await clearAuthData();
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const handleTokenVersionMismatch = async (data: any) => {
    if (data?.code === "TOKEN_VERSION_MISMATCH") {
      await disconnectSocket();
      await clearAuthData();
      return true;
    }
    return false;
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
        handleTokenVersionMismatch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
