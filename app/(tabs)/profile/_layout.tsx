// Stack layout for the profile tab.
// Wraps index, settings, and copyright as a standard push-navigation stack
// so Expo Router does not surface them as separate top-level tabs.

import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="copyright" />
    </Stack>
  );
}
