// app/(auth)/_layout.tsx - SIMPLE VERSION
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="setup-profile" />
    </Stack>
  );
}
