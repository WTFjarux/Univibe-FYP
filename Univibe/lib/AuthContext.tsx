import React, { createContext, useState, useContext, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import * as SecureStore from "expo-secure-store";
import { profileService } from "./profileService";
import { API_BASE_URL } from "../constants/stringConstants";

interface AuthContextType {
  user: any | null;
  token: string | null;
  profile: any | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupProfile: (profileData: any) => Promise<any>;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  loadProfile: () => Promise<void>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = !!token;

  // Initialize authentication state on app startup
  useEffect(() => {
    checkAuthState();
  }, []);

  /**
   * Check user's email verification status from backend
   * Used to determine if user can access protected features
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
        return {
          isEmailVerified: data.isEmailVerified,
          email: data.user?.email,
          canResend: data.canResend,
          tokenExpired: data.tokenExpired,
        };
      }

      return { isEmailVerified: false };
    } catch (error) {
      console.error("Verification check failed:", error);
      return { isEmailVerified: false };
    }
  };

  /**
   * Request a new verification email for unverified users
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
      console.error("Failed to resend verification:", error);
      return { success: false, message: "Network error" };
    }
  };

  /**
   * Check for valid authentication token on app startup
   * Loads user data if token exists and is valid
   */
  const checkAuthState = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync("authToken");

      if (storedToken) {
        try {
          const decoded = jwtDecode(storedToken);
          const currentTime = Date.now() / 1000;

          // Check token expiration
          if (decoded.exp && decoded.exp > currentTime) {
            setToken(storedToken);
            setUser(decoded);
            await fetchUserProfile(); // Load profile data
          } else {
            // Token expired, clear storage
            await clearAuthData();
          }
        } catch (error) {
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error("Auth state check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear all authentication data from state and storage
   */
  const clearAuthData = async () => {
    await SecureStore.deleteItemAsync("authToken");
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  /**
   * Fetch user profile from backend API
   * Handles multiple response formats and error cases
   */
  const fetchUserProfile = async () => {
    try {
      const response = await profileService.getProfileDetails();

      if (!response) {
        setProfile(null);
        return null;
      }

      // Handle successful profile response
      if (response.success === true) {
        if (response.data?.profile) {
          setProfile(response.data.profile);
          return response.data.profile;
        } else if (response.profile) {
          setProfile(response.profile);
          return response.profile;
        }
      }

      // Handle profile not found
      if (response.success === false) {
        if (response.message?.includes("not found")) {
          setProfile(null);
          return null;
        }
      }

      // Direct profile object
      if (response._id && response.user) {
        setProfile(response);
        return response;
      }

      setProfile(null);
      return null;
    } catch (error) {
      console.error("Profile fetch failed:", error);
      setProfile(null);
      return null;
    }
  };

  /**
   * Authenticate user with email and password
   * Saves token and loads user profile on success
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
        // Handle email verification requirement
        if (responseData.code === "EMAIL_NOT_VERIFIED") {
          throw new Error("EMAIL_NOT_VERIFIED:" + responseData.message);
        }
        throw new Error(responseData.message || "Login failed");
      }

      if (responseData.token) {
        // Save authentication token
        await SecureStore.setItemAsync("authToken", responseData.token);
        setToken(responseData.token);

        // Decode and store user info
        const decoded = jwtDecode(responseData.token);
        setUser(decoded);

        // Load user profile
        await fetchUserProfile();
      } else {
        throw new Error("Authentication failed");
      }
    } catch (error: any) {
      console.error("Login error:", error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register new user account
   * Creates account but leaves profile setup for later
   */
  const signup = async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Registration failed");
      }

      const data = await response.json();

      if (data.token) {
        // Save authentication token
        await SecureStore.setItemAsync("authToken", data.token);
        setToken(data.token);

        // Store user information
        const decoded = jwtDecode(data.token);
        setUser(decoded);
        setProfile(null); // Profile must be setup separately
      } else {
        throw new Error("Registration incomplete");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Complete user profile setup after registration
   */
  const setupProfile = async (profileData: any) => {
    try {
      setIsLoading(true);

      const response = await profileService.setupProfile(profileData);

      if (response?.success === true) {
        // Refresh profile data after setup
        await fetchUserProfile();
        return response;
      } else {
        throw new Error(response?.message || "Profile creation failed");
      }
    } catch (error: any) {
      console.error("Profile setup error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout current user
   * Clears all authentication data
   */
  const logout = async () => {
    try {
      await clearAuthData();
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  /**
   * Force refresh of profile data
   * Useful after profile updates
   */
  const refreshProfile = async () => {
    await fetchUserProfile();
  };

  /**
   * Manual trigger to load profile
   * Used when auto-load fails or is needed
   */
  const loadProfile = async () => {
    if (!token) return;
    await fetchUserProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        login,
        signup,
        logout,
        setupProfile,
        isLoading,
        isAuthenticated,
        refreshProfile,
        loadProfile,
        checkVerificationStatus,
        resendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access authentication context
 * Must be used within AuthProvider component
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
