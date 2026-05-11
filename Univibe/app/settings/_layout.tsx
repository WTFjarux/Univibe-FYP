// app/settings/_layout.tsx

import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="blocked-users" />
      <Stack.Screen name="deleted-posts" />
      <Stack.Screen name="hidden-posts" />
      <Stack.Screen name="muted-users" />
      <Stack.Screen name="saved-posts" />
      <Stack.Screen name="PrivacyPolicy" />
      <Stack.Screen name="TermsOfService" />
      <Stack.Screen name="change-password" />
    </Stack>
  );
}