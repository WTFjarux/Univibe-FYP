// app/profile/_layout.tsx

import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="blocked-users" />
      <Stack.Screen name="deleted-posts" />
      <Stack.Screen name="hidden-posts" />
      <Stack.Screen name="muted-users" />
      <Stack.Screen name="saved-posts" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms-of-service" />
      <Stack.Screen name="connections" />
    </Stack>
  );
}
