// Stack layout for the flashcards tab.
// index = setup screen; session = the card-swiping experience.
// Having a _layout.tsx here changes the tab route name from
// "flashcards/index" to "flashcards" (Expo Router 6 convention).

import { Stack } from 'expo-router';

export default function FlashcardsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="session" />
    </Stack>
  );
}
