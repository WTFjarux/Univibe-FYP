// Univibe/lib/AuthContext.tsx
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
import { profileService } from "./profileService";
import { API_BASE_URL } from "../constants/ipConstants";

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
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupProfile: (profileData: any) => Promise<any>;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  loadProfile: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = !!token;
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    checkAuthState();
  }, []);

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
            // Silently fail
          }
        }

        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [token]);

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
        const updatedUser = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          isEmailVerified: decoded.isEmailVerified,
          exp: decoded.exp,
          iat: decoded.iat,
        };

        setUser(updatedUser);
        await fetchUserProfile();

        return true;
      }

      return false;
    } catch (error) {
      return false;
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
        if (data.isEmailVerified && token) {
          try {
            const decoded = jwtDecode<CustomJwtPayload>(token);
            if (!decoded.isEmailVerified) {
              await refreshToken();
            }
          } catch (err) {
            // Ignore decode errors
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

  const checkAuthState = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync("authToken");

      if (storedToken) {
        try {
          const decoded = jwtDecode<CustomJwtPayload>(storedToken);
          const currentTime = Date.now() / 1000;

          if (decoded.exp && decoded.exp > currentTime) {
            setToken(storedToken);
            setUser({
              id: decoded.id,
              email: decoded.email,
              role: decoded.role,
              isEmailVerified: decoded.isEmailVerified,
              exp: decoded.exp,
              iat: decoded.iat,
            });

            try {
              const response = await fetch(
                `${API_BASE_URL}/api/auth/check-verification`,
                {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${storedToken}`,
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
              // Ignore verification check errors on startup
            }

            await fetchUserProfile();
          } else {
            await clearAuthData();
          }
        } catch (error) {
          await clearAuthData();
        }
      }
    } catch (error) {
      // Ignore auth state errors
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = async () => {
    await SecureStore.deleteItemAsync("authToken");
    setToken(null);
    setUser(null);
    setProfile(null);
  };

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
      setProfile(null);
      return null;
    }
  };

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
          exp: decoded.exp,
          iat: decoded.iat,
        });

        await fetchUserProfile();
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Registration failed");
      }

      const data = await response.json();

      if (data.token) {
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
        setProfile(null);
      } else {
        throw new Error("Registration incomplete");
      }
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

  const logout = async () => {
    try {
      await clearAuthData();
    } catch (error) {
      throw error;
    }
  };

  const refreshProfile = async () => {
    await fetchUserProfile();
  };

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
        refreshToken,
        checkVerificationStatus,
        resendVerificationEmail,
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
