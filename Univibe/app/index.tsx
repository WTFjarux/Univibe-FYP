// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "../lib/contexts/AuthContext";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { isLoading, token, user } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#faf9f6",
        }}
      >
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  // No token → landing page
  if (!token) {
    return <Redirect href="/screens/landingPage" />;
  }

  // Has token + verified + profile complete → tabs
  if (user?.isEmailVerified && user?.profileComplete) {
    return <Redirect href="/(tabs)" />;
  }

  // Has token + verified + no profile → setup
  if (user?.isEmailVerified && !user?.profileComplete) {
    return <Redirect href="/(auth)/setup-profile" />;
  }

  // Has token but not verified → login
  return <Redirect href="/(auth)/login" />;
}
