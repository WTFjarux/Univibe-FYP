// app/_auth-guard.tsx
import { Redirect } from "expo-router";
import { useAuth } from "../lib/AuthContext";
import { View, ActivityIndicator } from "react-native";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export default function AuthGuard({
  children,
  requireAuth = true,
  redirectTo = "/(auth)/login",
}: AuthGuardProps) {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  // If authentication is required but no token exists
  if (requireAuth && !token) {
    return <Redirect href="./landingPage" />;
  }

  // If authentication is NOT required but token exists (already logged in)
  if (!requireAuth && token) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}
