import { Tabs } from 'expo-router';

// Tab order (right → left for RTL layout):
//   Feed | Dictionary | Learn | Search | Profile
//
// Flashcards is no longer a top-level tab — it is accessible from
// the Dictionary screen via a "Flashcards" button.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="feed"       options={{ title: 'פיד' }} />
      <Tabs.Screen name="dictionary" options={{ title: 'מילון' }} />
      <Tabs.Screen name="learn"      options={{ title: 'למידה' }} />
      <Tabs.Screen name="search"     options={{ title: 'חיפוש' }} />
      <Tabs.Screen name="profile"    options={{ title: 'פרופיל' }} />
      {/* Flashcards: keep route registered but hidden from tab bar */}
      <Tabs.Screen name="flashcards" options={{ href: null }} />
    </Tabs>
  );
}
